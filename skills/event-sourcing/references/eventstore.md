# Event Store Reference

## What Is an Event Store?

An event store is an **append-only log** partitioned into **streams**, where each stream
holds the events for one aggregate instance.

```
Stream: order-abc123
  version 1: OrderPlaced       { ... }
  version 2: OrderItemAdded    { ... }
  version 3: PaymentReceived   { ... }
  version 4: OrderShipped      { ... }

Stream: order-xyz789
  version 1: OrderPlaced       { ... }
  version 2: OrderCancelled    { ... }
```

---

## Core Operations

### Append to stream
```typescript
interface EventStore {
  appendToStream(
    streamId: string,
    events: DomainEvent[],
    expectedVersion: number | "NO_STREAM" | "ANY"
  ): Promise<AppendResult>;

  loadStream(
    streamId: string,
    fromVersion?: number
  ): Promise<DomainEvent[]>;

  subscribeToAll(
    handler: (event: DomainEvent) => Promise<void>,
    fromPosition?: GlobalPosition
  ): Subscription;
}
```

`expectedVersion` semantics:
- `number` — optimistic concurrency; throws if current version differs
- `"NO_STREAM"` — stream must not exist yet (for creation)
- `"ANY"` — skip concurrency check (use carefully)

---

## Implementation Options

### EventStoreDB (recommended for production)
Purpose-built for event sourcing. First-class streams, subscriptions, projections.
```typescript
import { EventStoreDBClient, jsonEvent } from "@eventstore/db-client";

const client = EventStoreDBClient.connectionString("esdb://localhost:2113?tls=false");

await client.appendToStream("order-123", [
  jsonEvent({ type: "OrderPlaced", data: { ... } })
], { expectedRevision: NO_STREAM });
```

### PostgreSQL (good for most teams)
Use a single `events` table with optimistic concurrency enforced by a unique constraint.

```sql
CREATE TABLE events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stream_id   TEXT NOT NULL,
  version     INTEGER NOT NULL,
  event_type  TEXT NOT NULL,
  data        JSONB NOT NULL,
  metadata    JSONB NOT NULL DEFAULT '{}',
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (stream_id, version)  -- enforces optimistic concurrency
);

CREATE INDEX idx_events_stream ON events (stream_id, version);
CREATE INDEX idx_events_global ON events (recorded_at, id);  -- for projections
```

Append with optimistic concurrency:
```sql
INSERT INTO events (stream_id, version, event_type, data)
VALUES ($1, $2, $3, $4)
-- The UNIQUE constraint will throw if version already exists
```

### Other Options
- **DynamoDB**: Use `stream_id + version` as composite key; conditional writes for concurrency
- **Kafka**: Good for integration events but lacks per-stream concurrency; not ideal as primary store
- **MongoDB**: Append with `{ $push: { events: newEvent } }` and optimistic version in document

---

## Snapshots

Snapshots are a **performance optimization** — never a correctness requirement.

Use snapshots when:
- An aggregate's stream exceeds ~500 events
- Replay time is causing latency issues

```typescript
interface SnapshotStore {
  save(aggregateId: string, version: number, state: unknown): Promise<void>;
  load(aggregateId: string): Promise<Snapshot | null>;
}

// Loading with snapshot support
async load(id: string): Promise<Order> {
  const snapshot = await this.snapshotStore.load(id);
  
  const events = await this.eventStore.loadStream(
    `order-${id}`,
    snapshot ? snapshot.version + 1 : 0  // load only events after snapshot
  );

  const order = new Order(id);
  
  if (snapshot) {
    order.restoreFromSnapshot(snapshot.state);
    order.setVersion(snapshot.version);
  }
  
  order.rehydrate(events);
  return order;
}
```

**Snapshot strategy**: Take a snapshot every N events (e.g., every 100). Store asynchronously —
snapshots are hints, never required for correctness.

---

## Global Position & Ordering

Every event has two positions:
1. **Stream position (version)**: Position within its aggregate stream (starts at 1)
2. **Global position**: Monotonically increasing position across ALL streams (used by projections)

```
Global Pos │ Stream       │ Version │ Type
───────────┼──────────────┼─────────┼──────────────
1          │ order-abc    │ 1       │ OrderPlaced
2          │ customer-xyz │ 1       │ CustomerRegistered
3          │ order-abc    │ 2       │ OrderItemAdded
4          │ order-def    │ 1       │ OrderPlaced
```

Projections use global position as a **checkpoint** to resume after restart.

---

## Tombstoning / Soft Deletes

You never delete events. If an account is deleted (e.g., GDPR):

```typescript
// Option A: Encrypt PII fields; store encryption key separately; delete the key
{
  eventType: "OrderPlaced",
  data: {
    orderId: "123",
    customerName: "ENCRYPTED:x7fGH...",   // encrypted at rest
  }
}
// Deleting the encryption key = cryptographic erasure

// Option B: Emit a tombstone event
{
  eventType: "CustomerAccountDeleted",
  data: { customerId: "xyz", reason: "GDPR_REQUEST", deletedAt: "..." }
}
// Projections handle this by removing or anonymizing customer data in read models
```
