# Event Design Reference

## Event Design Principles

### 1. Events Are Past-Tense Facts

Events describe something that **already happened**. They are never instructions.

```
✅ OrderPlaced       ❌ PlaceOrder
✅ PaymentReceived   ❌ ProcessPayment
✅ ItemShipped       ❌ ShipItem
✅ AccountSuspended  ❌ SuspendAccount
```

### 2. Events Belong to a Domain, Not a Technology

Events must use **ubiquitous language** from the business domain.

```
✅ MembershipUpgraded   ❌ UserTableRowUpdated
✅ FundsWithdrawn       ❌ BalanceDecremented
✅ QuoteExpired         ❌ TTLExceeded
```

### 3. Events Are Immutable

Once written, an event is permanent. You never update or delete events.
If something was done in error, you add a compensating event:

```
OrderPlaced        (version 1)
OrderItemAdded     (version 2)
OrderCancelled     (version 3)  ← compensates, doesn't erase
```

---

## Event Anatomy

Every event should carry:

```typescript
interface DomainEvent {
  // Identity
  eventId: string;           // Unique ID for this event occurrence
  eventType: string;         // e.g. "OrderPlaced"
  
  // Stream placement
  aggregateId: string;       // Which aggregate instance this belongs to
  aggregateType: string;     // e.g. "Order"
  version: number;           // Position within this aggregate's stream
  
  // Timing
  occurredAt: Date;          // When it happened in the domain
  recordedAt: Date;          // When it was persisted (may differ)
  
  // Causality (optional but highly recommended)
  causationId?: string;      // ID of command/event that caused this
  correlationId?: string;    // Traces a whole business process
  
  // Payload
  data: Record<string, unknown>;  // The actual domain data
  
  // Schema
  schemaVersion: number;     // For upcasting — always include this
}
```

### What Goes in `data`?

**Include only what changed, plus enough context to understand why.**

```typescript
// ✅ Good — captures the meaningful change
{
  eventType: "PriceAdjusted",
  data: {
    productId: "prod-123",
    previousPrice: 49.99,
    newPrice: 39.99,
    reason: "SEASONAL_SALE",
    adjustedBy: "user-456"
  }
}

// ❌ Bad — dumps entire entity state
{
  eventType: "ProductUpdated",
  data: {
    productId: "prod-123",
    name: "Widget",
    description: "A widget",
    price: 39.99,
    stock: 100,
    category: "widgets",
    tags: ["sale", "widget"],
    // ... 30 more fields that didn't change
  }
}
```

---

## Event Granularity

### Too Coarse (avoid)
```typescript
OrderUpdated { orderId, entireOrderSnapshot }
// Loses meaning — what changed? Why?
```

### Too Fine (avoid)
```typescript
OrderShippingStreetChanged { ... }
OrderShippingCityChanged { ... }
OrderShippingZipChanged { ... }
// Splits a single business action into noise
```

### Just Right
```typescript
OrderShippingAddressUpdated {
  orderId,
  newAddress: { street, city, zip, country },
  previousAddress: { ... },  // include if useful for projections
  updatedBy,
  reason?
}
```

**Rule of thumb**: One business action = one event. If a user clicks "Update Shipping", that's one event — even if multiple fields change.

---

## Event Categories

### Domain Events
Core business facts. Emitted by aggregates.
```typescript
OrderPlaced, PaymentReceived, ItemShipped, MembershipExpired
```

### Integration Events
Published to other services/bounded contexts. May be a subset of domain events,
or translated versions. Often have a stable public contract.
```typescript
// Internal domain event
OrderFulfilled { orderId, items, warehouseId, packedBy }

// Integration event published externally (trimmed, stable API)
OrderShipped { orderId, trackingNumber, estimatedDelivery }
```

### System Events (use sparingly)
Infrastructure or lifecycle events not directly from the domain.
```typescript
SnapshotCreated, StreamArchived
```

---

## Common Event Modeling Mistakes

### Mistake: Event per field change
```typescript
// ❌ This is a CRUD mindset, not event sourcing
UserEmailUpdated { userId, email }
UserNameUpdated { userId, name }
UserPhoneUpdated { userId, phone }
```
Instead, ask: "What business action happened?"
```typescript
// ✅
UserContactInfoUpdated { userId, email?, name?, phone?, changedFields }
// or even
UserRegistered { userId, email, name, phone }
UserProfileEdited { userId, changes: Partial<Profile>, editedBy }
```

### Mistake: Embedding commands in events
```typescript
// ❌ This encodes intent, not fact
OrderShouldBeShipped { orderId }
// ✅
OrderShipped { orderId, trackingNumber, shippedAt, shippedBy }
```

### Mistake: No schema version
```typescript
// ❌ Will break when you need to evolve this event
{ eventType: "OrderPlaced", data: { ... } }

// ✅
{ eventType: "OrderPlaced", schemaVersion: 1, data: { ... } }
```

---

## Event Naming Conventions

| Pattern | Example | Use for |
|---------|---------|---------|
| `NounVerbed` | `OrderPlaced` | Most domain events |
| `NounVerbFailed` | `PaymentFailed` | Failure outcomes |
| `NounVerbedBy` | `OrderCancelledByCustomer` | When actor matters |
| `NounExpired` | `SessionExpired` | Time-based events |
| `NounNounChanged` | `OrderStatusChanged` | State transitions |

Keep names in your **domain's language**, not your implementation language.
