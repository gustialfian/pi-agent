# Projections & Read Models Reference

## What Is a Projection?

A projection **listens to events** and builds a **read model** (query-optimized view).
This is the "Q" in CQRS (Command Query Responsibility Segregation).

```
Event Store ──subscribe──► Projection ──writes──► Read Model (DB table, cache, etc.)
                                                        ▲
                                                        │
                                                 Query API reads from here
```

**Key properties:**
- Projections are **disposable** — you can always rebuild from the event log
- Projections are **eventually consistent** — there's a lag between event written and read model updated
- Multiple projections can consume the same events for different purposes

---

## Projection Types

### 1. Inline Projection (simplest)
Rebuild state on every command by replaying the aggregate's own stream.
This is just "loading an aggregate" — no separate read model needed.
```typescript
// Already covered in aggregates.md — this is the aggregate's own rehydration
```

### 2. Synchronous Projection
Update a read model in the same transaction as writing events.
Only feasible with a relational DB where both live in the same database.

```typescript
// In a single DB transaction:
// 1. Append events
// 2. Update the read model table
// This gives strong consistency but couples write and read stores
```

### 3. Asynchronous Projection (recommended for most cases)
A separate process subscribes to the event stream and updates read models.
```typescript
class OrderSummaryProjection {
  async handle(event: DomainEvent): Promise<void> {
    switch (event.eventType) {
      case "OrderPlaced":
        await this.db.insert("order_summaries", {
          id: event.data.orderId,
          customerId: event.data.customerId,
          status: "PLACED",
          itemCount: 0,
          total: 0,
          placedAt: event.occurredAt,
        });
        break;

      case "OrderItemAdded":
        await this.db.update("order_summaries",
          { id: event.data.orderId },
          {
            $inc: { itemCount: 1, total: event.data.price },
          }
        );
        break;

      case "OrderShipped":
        await this.db.update("order_summaries",
          { id: event.data.orderId },
          { status: "SHIPPED", shippedAt: event.occurredAt }
        );
        break;
    }
  }
}
```

---

## Projection Runner Pattern

```typescript
class ProjectionRunner {
  async start(): Promise<void> {
    // Load last processed position (checkpoint) from storage
    const checkpoint = await this.checkpointStore.load(this.projectionName);

    // Subscribe from that position (replay any missed events on restart)
    const subscription = this.eventStore.subscribeToAll(
      async (event) => {
        await this.projection.handle(event);
        await this.checkpointStore.save(this.projectionName, event.globalPosition);
      },
      checkpoint?.position
    );
  }
}
```

**Critical**: Save the checkpoint **after** successfully processing the event.
If you save it before, and processing crashes, you skip events.

---

## Idempotency

Projections must handle **duplicate delivery** (at-least-once semantics).

```typescript
async handle(event: DomainEvent): Promise<void> {
  // Check if already processed
  const alreadyProcessed = await this.db.exists("processed_events", { eventId: event.eventId });
  if (alreadyProcessed) return;

  // Process...
  await this.applyEvent(event);

  // Mark as processed
  await this.db.insert("processed_events", { eventId: event.eventId });
}
```

Or use **upsert** patterns that are naturally idempotent:
```sql
INSERT INTO order_summaries (id, status, placed_at)
VALUES ($1, $2, $3)
ON CONFLICT (id) DO NOTHING;  -- idempotent creation
```

---

## Rebuilding Projections

The killer feature of event sourcing: **you can always rebuild any read model**.

```typescript
async rebuild(projectionName: string): Promise<void> {
  // 1. Clear the existing read model
  await this.db.truncate("order_summaries");

  // 2. Reset the checkpoint
  await this.checkpointStore.reset(projectionName);

  // 3. Replay ALL events from the beginning
  // The projection runner will now process every event from position 0
  await this.projectionRunner.start();
}
```

When to rebuild:
- You fixed a bug in projection logic
- You're adding a new projection
- You changed the read model schema

**Blue/green projection strategy**: Build a new projection to a new table while the old one
serves reads. Once caught up, swap the read API to the new table.

---

## Common Read Model Patterns

### Flat summary table (most common)
```sql
CREATE TABLE order_summaries (
  id TEXT PRIMARY KEY,
  customer_id TEXT,
  status TEXT,
  item_count INT,
  total_cents BIGINT,
  placed_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ
);
```

### Document store (flexible schema)
```typescript
// MongoDB/DynamoDB — good when read model shape varies
{
  _id: "order-123",
  customer: { id: "cust-456", name: "Alice" },
  status: "SHIPPED",
  items: [
    { productId: "p1", name: "Widget", qty: 2, price: 19.99 }
  ],
  timeline: [
    { event: "placed", at: "2024-01-01" },
    { event: "shipped", at: "2024-01-03" }
  ]
}
```

### Event-sourced projection (for complex aggregations)
Keep a mini event log per "view entity" for complex timeline or audit views.

---

## CQRS Structure

```
Commands side:                      Queries side:
──────────────                      ─────────────
API → CommandHandler                API → QueryHandler
         ↓                                   ↓
     Aggregate                         Read Model
         ↓                           (ProjectionDB)
     EventStore ──────subscribe──► Projection
```

Commands and queries **never share the same model**.
- Command side: rich domain model, aggregates, invariants
- Query side: flat, denormalized, query-optimized tables

This enables independent scaling, different storage engines, and independent evolution.
