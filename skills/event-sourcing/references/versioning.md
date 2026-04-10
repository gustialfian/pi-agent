# Event Versioning & Migration Reference

## Why Versioning Is Non-Negotiable

Events are **permanent**. You can never change an event that's been stored.
But your domain model will change. Versioning is how you manage this.

**Always include `schemaVersion` in every event from day one.**

---

## Strategies

### 1. Upcasting (recommended for most changes)

Transform old event versions to the new shape at **read time**.
The event store is never modified.

```typescript
class OrderPlacedUpcaster {
  // v1 → v2: added "channel" field (default: "WEB")
  upcast(event: RawEvent): DomainEvent {
    if (event.schemaVersion === 1) {
      return {
        ...event,
        schemaVersion: 2,
        data: {
          ...event.data,
          channel: "WEB",  // default for old events
        }
      };
    }
    return event;
  }
}

// Upcaster chain (apply in order)
class UpcasterChain {
  upcast(event: RawEvent): DomainEvent {
    let current = event;
    for (const upcaster of this.upcasters) {
      if (upcaster.handles(current)) {
        current = upcaster.upcast(current);
      }
    }
    return current as DomainEvent;
  }
}
```

### 2. Event Versioning (rename the event type)

When changes are too large for upcasting, create a new version:

```
OrderPlacedV1  { ... old shape ... }  ← still in the store, still handled
OrderPlacedV2  { ... new shape ... }  ← new events use this
```

Your aggregate handles both:
```typescript
protected apply(event: DomainEvent): void {
  switch (event.eventType) {
    case "OrderPlacedV1":
      // legacy handling
      this.channel = "WEB";
      this.customerId = event.data.userId;  // old field name
      break;
    case "OrderPlacedV2":
      this.channel = event.data.channel;
      this.customerId = event.data.customerId;  // new field name
      break;
  }
}
```

### 3. Copy-Transform (for large-scale migrations)

Write a migration script that reads all old events and writes new events
to a new stream (or new event store). Run in parallel during migration.

Use for: major structural changes, splitting bounded contexts, migrating stores.

---

## What Changes Are Safe vs Breaking?

### Safe changes (backwards compatible)
- ✅ Adding a new **optional** field with a default
- ✅ Adding a new **event type**
- ✅ Removing a field that projections don't use
- ✅ Renaming a field **via an upcaster**

### Breaking changes (require versioning strategy)
- ❌ Removing a field that projections use
- ❌ Changing a field's type (e.g., string → int)
- ❌ Renaming an event without an upcaster
- ❌ Changing the meaning of a field
- ❌ Splitting one event into two

---

## Projection Migration

When an event schema changes, projections may need rebuilding.

```typescript
// Step 1: Deploy new projection code that handles both V1 and V2 events
// Step 2: Rebuild the projection (replay all events from scratch)
// Step 3: Blue/green swap: route reads to new projection
// Step 4: Decommission old projection

class OrderSummaryProjectionV2 {
  handle(event: DomainEvent): void {
    switch (event.eventType) {
      // Handle both versions:
      case "OrderPlacedV1":
        this.handleOrderPlacedV1(event);
        break;
      case "OrderPlacedV2":
        this.handleOrderPlacedV2(event);
        break;
    }
  }
}
```

---

## Contract Testing for Events

Treat your integration events as a **public API**. Use contract tests:

```typescript
// Consumer-driven contract test
describe("OrderShipped event contract", () => {
  it("must have orderId, trackingNumber, estimatedDelivery", () => {
    const event = eventStore.getLatestOfType("OrderShipped");
    expect(event.data).toMatchSchema({
      orderId: expect.any(String),
      trackingNumber: expect.any(String),
      estimatedDelivery: expect.any(String),  // ISO date
    });
  });
});
```

---

## Versioning Checklist

Before deploying a schema change:

- [ ] Added `schemaVersion` to the event (if not already there)
- [ ] Written an upcaster OR versioned the event type (e.g., V2)
- [ ] Projection handles both old and new schema
- [ ] Tested by replaying historical events through new code
- [ ] Consumer contracts updated (if integration event)
- [ ] Migration runbook written (if copy-transform needed)
