# Code Examples

## TypeScript: Full Working Example (Order Domain)

### Domain Events

```typescript
// events.ts
export interface DomainEvent {
  eventId: string;
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  version: number;
  occurredAt: Date;
  schemaVersion: number;
  data: Record<string, unknown>;
}

export interface OrderPlaced extends DomainEvent {
  eventType: "OrderPlaced";
  data: {
    orderId: string;
    customerId: string;
    channel: "WEB" | "MOBILE" | "API";
  };
}

export interface OrderItemAdded extends DomainEvent {
  eventType: "OrderItemAdded";
  data: {
    orderId: string;
    productId: string;
    quantity: number;
    unitPriceCents: number;
  };
}

export interface OrderSubmitted extends DomainEvent {
  eventType: "OrderSubmitted";
  data: {
    orderId: string;
    totalCents: number;
    submittedAt: string;
  };
}

export interface OrderCancelled extends DomainEvent {
  eventType: "OrderCancelled";
  data: {
    orderId: string;
    reason: string;
    cancelledBy: string;
  };
}
```

### Aggregate Root Base

```typescript
// aggregate.ts
import { randomUUID } from "crypto";

export abstract class AggregateRoot {
  readonly id: string;
  private _version = 0;
  private _uncommitted: DomainEvent[] = [];

  constructor(id: string) {
    this.id = id;
  }

  get version() { return this._version; }

  protected raise(event: Omit<DomainEvent, "eventId" | "occurredAt" | "version">): void {
    const full: DomainEvent = {
      ...event,
      eventId: randomUUID(),
      occurredAt: new Date(),
      version: this._version + 1,
    };
    this.apply(full);
    this._version++;
    this._uncommitted.push(full);
  }

  rehydrate(events: DomainEvent[]): void {
    for (const e of events) {
      this.apply(e);
      this._version = e.version;
    }
  }

  getUncommittedEvents(): DomainEvent[] { return [...this._uncommitted]; }
  markCommitted(): void { this._uncommitted = []; }

  protected abstract apply(event: DomainEvent): void;
}
```

### Order Aggregate

```typescript
// order.ts
import { AggregateRoot } from "./aggregate";

type OrderStatus = "DRAFT" | "SUBMITTED" | "CANCELLED";

interface OrderItem {
  productId: string;
  quantity: number;
  unitPriceCents: number;
}

export class Order extends AggregateRoot {
  private status: OrderStatus = "DRAFT";
  private items: OrderItem[] = [];
  private customerId!: string;
  private channel!: string;

  static place(customerId: string, channel: "WEB" | "MOBILE" | "API"): Order {
    const order = new Order(randomUUID());
    order.raise({
      eventType: "OrderPlaced",
      aggregateId: order.id,
      aggregateType: "Order",
      schemaVersion: 1,
      data: { orderId: order.id, customerId, channel },
    });
    return order;
  }

  addItem(productId: string, quantity: number, unitPriceCents: number): void {
    this.assertStatus("DRAFT", "add items to");

    if (quantity <= 0) throw new Error("Quantity must be positive");
    if (unitPriceCents <= 0) throw new Error("Price must be positive");
    if (this.items.length >= 50) throw new Error("Order cannot exceed 50 items");

    this.raise({
      eventType: "OrderItemAdded",
      aggregateId: this.id,
      aggregateType: "Order",
      schemaVersion: 1,
      data: { orderId: this.id, productId, quantity, unitPriceCents },
    });
  }

  submit(): void {
    this.assertStatus("DRAFT", "submit");
    if (this.items.length === 0) throw new Error("Cannot submit an empty order");

    const total = this.items.reduce(
      (sum, i) => sum + i.quantity * i.unitPriceCents, 0
    );

    this.raise({
      eventType: "OrderSubmitted",
      aggregateId: this.id,
      aggregateType: "Order",
      schemaVersion: 1,
      data: { orderId: this.id, totalCents: total, submittedAt: new Date().toISOString() },
    });
  }

  cancel(reason: string, cancelledBy: string): void {
    if (this.status === "CANCELLED") throw new Error("Already cancelled");

    this.raise({
      eventType: "OrderCancelled",
      aggregateId: this.id,
      aggregateType: "Order",
      schemaVersion: 1,
      data: { orderId: this.id, reason, cancelledBy },
    });
  }

  protected apply(event: DomainEvent): void {
    switch (event.eventType) {
      case "OrderPlaced":
        this.customerId = event.data.customerId as string;
        this.channel = event.data.channel as string;
        this.status = "DRAFT";
        break;
      case "OrderItemAdded":
        this.items.push({
          productId: event.data.productId as string,
          quantity: event.data.quantity as number,
          unitPriceCents: event.data.unitPriceCents as number,
        });
        break;
      case "OrderSubmitted":
        this.status = "SUBMITTED";
        break;
      case "OrderCancelled":
        this.status = "CANCELLED";
        break;
    }
  }

  private assertStatus(expected: OrderStatus, action: string): void {
    if (this.status !== expected)
      throw new Error(`Cannot ${action} an order in status ${this.status}`);
  }
}
```

### In-Memory Event Store (for testing)

```typescript
// eventstore.ts
export class InMemoryEventStore {
  private streams = new Map<string, DomainEvent[]>();

  async append(
    streamId: string,
    events: DomainEvent[],
    expectedVersion: number | null
  ): Promise<void> {
    const existing = this.streams.get(streamId) ?? [];
    const currentVersion = existing.length;

    if (expectedVersion !== null && currentVersion !== expectedVersion) {
      throw new Error(
        `Concurrency conflict: expected version ${expectedVersion}, got ${currentVersion}`
      );
    }

    this.streams.set(streamId, [...existing, ...events]);
  }

  async load(streamId: string, fromVersion = 0): Promise<DomainEvent[]> {
    return (this.streams.get(streamId) ?? []).filter(e => e.version > fromVersion);
  }
}
```

### Repository

```typescript
// order-repository.ts
export class OrderRepository {
  constructor(private store: InMemoryEventStore) {}

  async save(order: Order): Promise<void> {
    const events = order.getUncommittedEvents();
    if (!events.length) return;

    await this.store.append(
      `order-${order.id}`,
      events,
      order.version - events.length  // expected version before these events
    );
    order.markCommitted();
  }

  async load(orderId: string): Promise<Order> {
    const events = await this.store.load(`order-${orderId}`);
    if (!events.length) throw new Error(`Order ${orderId} not found`);

    const order = new Order(orderId);
    order.rehydrate(events);
    return order;
  }
}
```

### Usage

```typescript
// Usage
const store = new InMemoryEventStore();
const repo = new OrderRepository(store);

// Create order
const order = Order.place("customer-123", "WEB");
order.addItem("product-abc", 2, 1999);
order.addItem("product-xyz", 1, 4999);
order.submit();
await repo.save(order);

// Load and cancel
const loaded = await repo.load(order.id);
loaded.cancel("CUSTOMER_REQUEST", "customer-123");
await repo.save(loaded);
```

