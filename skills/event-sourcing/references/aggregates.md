# Aggregate Root & Invariants Reference

## What Is an Aggregate Root?

An **Aggregate** is a cluster of domain objects (entities + value objects) that must always be
consistent with each other. The **Aggregate Root** is the single entry point — all external
interactions go through it.

```
       External Code
            │
            ▼
    ┌───────────────┐
    │  Order (Root) │  ← The aggregate root
    │               │
    │  ┌─────────┐  │
    │  │OrderItem│  │  ← Internal entity (not accessed directly)
    │  └─────────┘  │
    │  ┌─────────┐  │
    │  │Discount │  │  ← Value object
    │  └─────────┘  │
    └───────────────┘
```

**Rules:**
- External objects only hold a reference to the root's ID, never to internal entities
- All mutations go through the root's methods
- The root ensures the whole cluster is always consistent

---

## Aggregate Structure in Event Sourcing

In event sourcing, an aggregate:
1. **Receives a command** (a method call)
2. **Validates** the command against current state (enforces invariants)
3. **Emits events** if valid, raises an error if not
4. **Applies events** to update its own internal state

```typescript
class Order extends AggregateRoot {
  private status: OrderStatus;
  private items: OrderItem[];
  private customerId: string;

  // ---- Command Handler ----
  addItem(productId: string, quantity: number, price: Money): void {
    // 1. Enforce invariants
    this.enforceNotCancelled();
    this.enforceNotSubmitted();
    if (quantity <= 0) throw new DomainError("Quantity must be positive");
    if (this.items.length >= 50) throw new DomainError("Order item limit reached");

    // 2. Emit the event
    this.raise(new OrderItemAdded({
      orderId: this.id,
      productId,
      quantity,
      price: price.amount,
      currency: price.currency
    }));
  }

  // ---- Event Applier (state mutation ONLY here) ----
  protected apply(event: DomainEvent): void {
    switch (event.eventType) {
      case "OrderItemAdded":
        this.items.push(new OrderItem(event.data));
        break;
      case "OrderCancelled":
        this.status = OrderStatus.Cancelled;
        break;
      // ...
    }
  }
}
```

**Key separation:**
- Command handlers: validate + emit
- Apply methods: mutate state, no logic, no side effects

---

## Invariant Enforcement

An **invariant** is a business rule that must **always** be true for an aggregate to be valid.

### Types of Invariants

#### 1. Simple validation invariants
```typescript
placeOrder(): void {
  if (this.items.length === 0)
    throw new DomainError("Cannot place an empty order");

  if (!this.shippingAddress)
    throw new DomainError("Shipping address required");

  this.raise(new OrderPlaced({ ... }));
}
```

#### 2. State machine invariants
```typescript
ship(): void {
  if (this.status !== OrderStatus.Paid)
    throw new DomainError(`Cannot ship order in status ${this.status}`);

  this.raise(new OrderShipped({ ... }));
}
```

Always model valid state transitions explicitly:
```
Draft → Submitted → Paid → Shipped → Delivered
         ↓
      Cancelled
```

#### 3. Aggregate-scoped count/limit invariants
```typescript
addItem(item: OrderItem): void {
  if (this.items.length >= this.maxItems)
    throw new DomainError("Maximum items exceeded");
  // ...
}
```

#### 4. Value constraint invariants
```typescript
applyDiscount(percent: number): void {
  if (percent < 0 || percent > 100)
    throw new DomainError("Discount must be 0-100");

  const newTotal = this.total.applyDiscount(percent);
  if (newTotal.isNegative())
    throw new DomainError("Discount cannot make order total negative");

  this.raise(new DiscountApplied({ orderId: this.id, percent, newTotal }));
}
```

### Cross-Aggregate Invariants (the hard problem)

**You cannot enforce a cross-aggregate invariant synchronously.**
This is a fundamental constraint of the pattern.

Example: "A customer cannot have more than 5 active orders"

Wrong approach:
```typescript
// ❌ Aggregate cannot query the database
placeOrder(customerId: string): void {
  const activeOrders = db.query("SELECT COUNT(*)...");  // NEVER do this
}
```

Correct approaches:

**Option A: Set-based validation via a domain service (at command handling time)**
```typescript
// In your command handler / application service
class PlaceOrderHandler {
  async handle(cmd: PlaceOrderCommand): Promise<void> {
    const activeCount = await this.orderRepo.countActiveForCustomer(cmd.customerId);
    if (activeCount >= 5) throw new DomainError("Order limit reached");

    const order = Order.place(cmd);
    await this.orderRepo.save(order);
  }
}
// Note: There's still a race condition here — see "Optimistic Concurrency" below
```

**Option B: Saga / process manager for eventual consistency**
```typescript
// React to OrderPlaced events across the system
// Cancel or flag orders that exceed the limit reactively
```

**Option C: Redesign aggregates** — if you frequently need cross-aggregate invariants,
your aggregate boundaries may be wrong. Consider merging them.

---

## Optimistic Concurrency

Always pass an **expected version** when saving to prevent lost updates.

```typescript
// Load aggregate — note current version
const order = await repo.load(orderId);
// order.version === 7

// Make changes
order.addItem(item);
// Internally: emits OrderItemAdded, increments version to 8

// Save — pass expected version
await repo.save(order, { expectedVersion: 7 });
// If someone else already wrote version 8, this throws ConcurrencyException
```

On `ConcurrencyException`:
- Reload the aggregate (it now has the latest events)
- Re-apply the command
- Retry (with a limit)

---

## Aggregate Design Heuristics

### 1. Design aggregates around invariants, not data
Ask: "What data must change together to stay consistent?"
Not: "What data is related?"

### 2. Keep aggregates small
Large aggregates = high contention = poor performance.
If an aggregate has 20+ fields, it's probably too big.

### 3. Reference other aggregates by ID only
```typescript
class Order {
  customerId: string;     // ✅ ID reference
  customer: Customer;     // ❌ Direct reference
}
```

### 4. Prefer eventual consistency between aggregates
If business allows a few seconds of inconsistency between two things,
they should probably be separate aggregates connected by events/sagas.

### 5. Name aggregates in domain language
```
✅ Order, Shipment, Invoice, Subscription, Reservation
❌ OrderManager, DataProcessor, UserContainer
```

---

## Base Aggregate Class Pattern

```typescript
abstract class AggregateRoot {
  readonly id: string;
  private _version: number = 0;
  private _uncommittedEvents: DomainEvent[] = [];

  get version(): number { return this._version; }

  protected raise(event: DomainEvent): void {
    this.apply(event);          // Apply to self immediately
    this._uncommittedEvents.push(event);
    this._version++;
  }

  // Called when loading from the event store
  rehydrate(events: DomainEvent[]): void {
    for (const event of events) {
      this.apply(event);
      this._version++;
    }
  }

  getUncommittedEvents(): DomainEvent[] {
    return [...this._uncommittedEvents];
  }

  markEventsAsCommitted(): void {
    this._uncommittedEvents = [];
  }

  protected abstract apply(event: DomainEvent): void;
}
```

---

## Loading & Saving Pattern

```typescript
class OrderRepository {
  async load(id: string): Promise<Order> {
    const events = await this.eventStore.loadStream(`order-${id}`);
    if (events.length === 0) throw new NotFoundError(`Order ${id} not found`);

    const order = new Order(id);
    order.rehydrate(events);
    return order;
  }

  async save(order: Order, options?: { expectedVersion?: number }): Promise<void> {
    const events = order.getUncommittedEvents();
    if (events.length === 0) return;

    await this.eventStore.appendToStream(
      `order-${order.id}`,
      events,
      options?.expectedVersion
    );
    order.markEventsAsCommitted();
  }
}
```
