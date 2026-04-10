# Sagas & Process Managers Reference

## When Do You Need a Saga?

Use a saga when you need to **coordinate multiple aggregates** across a business process.

```
Order aggregate alone can't:
- Confirm payment (Payment aggregate)
- Reserve inventory (Warehouse aggregate)
- Trigger shipment (Shipping aggregate)

A saga orchestrates the whole flow.
```

---

## Saga vs Process Manager

Both coordinate multi-step processes; terminology differs by community:

| | Saga | Process Manager |
|--|------|----------------|
| Style | Choreography (event-driven) | Orchestration (explicit state machine) |
| State | Stateless (react to events) | Stateful (tracks where it is in the flow) |
| Complexity | Simple linear flows | Complex flows with branches and timeouts |

In practice, most implementations are **process managers with explicit state**.

---

## Process Manager Pattern

```typescript
class OrderFulfillmentProcess {
  private orderId: string;
  private state: FulfillmentState = FulfillmentState.Started;
  private paymentId?: string;
  private reservationId?: string;

  // Handles events from other aggregates
  handle(event: DomainEvent): Command[] {
    switch (event.eventType) {
      case "OrderPlaced":
        return [
          new ReserveInventory({ orderId: event.data.orderId, items: event.data.items }),
          new InitiatePayment({ orderId: event.data.orderId, amount: event.data.total })
        ];

      case "InventoryReserved":
        this.reservationId = event.data.reservationId;
        this.state = FulfillmentState.InventoryReserved;
        return this.tryAdvance();

      case "PaymentConfirmed":
        this.paymentId = event.data.paymentId;
        this.state = FulfillmentState.PaymentConfirmed;
        return this.tryAdvance();

      case "PaymentFailed":
        return [new CancelOrder({ orderId: this.orderId, reason: "PAYMENT_FAILED" })];

      case "InventoryReservationFailed":
        return [
          new CancelPayment({ paymentId: this.paymentId }),
          new CancelOrder({ orderId: this.orderId, reason: "OUT_OF_STOCK" })
        ];
    }
    return [];
  }

  private tryAdvance(): Command[] {
    if (this.state === FulfillmentState.InventoryReserved &&
        this.paymentId) {
      return [new ShipOrder({ orderId: this.orderId, reservationId: this.reservationId })];
    }
    return [];
  }
}
```

---

## Compensating Transactions

Sagas use **compensating transactions** instead of two-phase commit.
If a step fails, undo completed steps in reverse order.

```
Forward flow:         Compensation (on failure at step 3):
Step 1: ReserveInventory    ← Undo: ReleaseInventoryReservation
Step 2: ChargePayment       ← Undo: RefundPayment
Step 3: ShipOrder (fails)   ← No undo needed (didn't happen)
```

Always design compensating actions when designing forward actions:

| Forward | Compensating |
|---------|-------------|
| ReserveInventory | ReleaseReservation |
| ChargePayment | RefundPayment |
| SendEmail | (not compensatable — notify instead) |
| PlaceOrder | CancelOrder |

**Some actions are not compensatable** (sending emails, external API calls).
Design for this: use idempotency, accept "best effort", or send a follow-up notification.

---

## Saga State Storage

Sagas are themselves event-sourced (or stored as projections):

```typescript
// Option A: Saga as aggregate (recommended)
class OrderFulfillmentSaga extends AggregateRoot {
  // Store saga state as events in its own stream
  // Stream: saga-fulfillment-{orderId}
}

// Option B: Saga state as a projected document
// Listen to business events → update a saga_state table
// Re-dispatch commands from the saga_state
```

---

## Timeouts and Scheduling

Sagas often need to handle time-based steps.

```typescript
// Pattern: Emit a "scheduled event" when saga starts
class OrderFulfillmentSaga {
  start(order: Order): void {
    this.raise(new FulfillmentStarted({ orderId: order.id }));

    // Schedule a timeout
    this.scheduler.scheduleAt(
      new Date(Date.now() + 24 * 60 * 60 * 1000),  // 24h
      new FulfillmentTimedOut({ orderId: order.id })
    );
  }

  handle(event: FulfillmentTimedOut): Command[] {
    if (this.state !== FulfillmentState.Completed) {
      return [new CancelOrder({ orderId: this.orderId, reason: "TIMEOUT" })];
    }
    return [];
  }
}
```

---

## Choreography vs Orchestration

### Choreography (event-driven, no central coordinator)
```
OrderPlaced ──► Inventory listens ──► InventoryReserved
                                            │
                              Payment listens ──► PaymentCharged
                                                        │
                                        Shipping listens ──► OrderShipped
```
✅ Loose coupling  
❌ Hard to see the full flow  
❌ Hard to handle failures consistently  

### Orchestration (saga/process manager)
```
OrderPlaced ──► FulfillmentSaga ──► ReserveInventory command
                     │◄── InventoryReserved
                     │──► ChargePayment command
                     │◄── PaymentCharged
                     └──► ShipOrder command
```
✅ Explicit flow, easy to trace  
✅ Centralized failure/compensation logic  
❌ Saga becomes a bottleneck if not designed well  

**Recommendation**: Use orchestration (process managers) for complex flows.
Use choreography for simple reactive flows between independent bounded contexts.

---

## Saga Design Checklist

- [ ] Defined the start event (what triggers the saga?)
- [ ] Defined the end states (success and all failure paths)
- [ ] Every forward action has a compensating action
- [ ] Saga is idempotent (can handle duplicate events)
- [ ] Timeouts are handled
- [ ] Saga state is persisted (not in memory only)
- [ ] Saga has a unique correlation ID linking all its events
