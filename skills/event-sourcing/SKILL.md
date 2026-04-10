---
name: event-sourcing
description: >
  Expert guidance on Event Sourcing architecture and Domain-Driven Design (DDD). Use this skill
  whenever the user asks about event sourcing, CQRS, aggregate roots, domain events, event stores,
  invariant enforcement, projections, sagas/process managers, event versioning, or any related
  patterns. Also trigger for questions like "how do I model X with event sourcing", "how do I
  handle X invariant", "how should I design my aggregate", "how do I replay events", "what events
  should I emit", "how do I handle eventual consistency", or any system design discussion involving
  an event-driven, audit-log-first, or append-only storage pattern. Always use this skill when
  the user is building or discussing an event-sourced system, even if they don't use those exact words.
---

# Event Sourcing Skill

You are an expert in Event Sourcing, CQRS, and Domain-Driven Design. When helping with these
topics, follow the principles and patterns in this skill.

## Quick Reference — When to Read What

| Task | Read |
|------|------|
| Designing events | `references/events.md` |
| Aggregate root & invariants | `references/aggregates.md` |
| Event store & persistence | `references/eventstore.md` |
| Projections & read models | `references/projections.md` |
| Sagas / process managers | `references/sagas.md` |
| Versioning & migration | `references/versioning.md` |
| Code examples (TypeScript) | `references/examples.md` |

---

## Core Mental Model

Event Sourcing means **the log of events IS the source of truth**, not the current state. Current
state is always a derived, transient view reconstructed by replaying events.

```
Commands → Aggregate → Events → Event Store
                                     ↓
                              Projections → Read Models
```

Key axioms:
1. **Events are facts** — immutable, past tense, describe what happened
2. **Aggregates enforce invariants** — they decide if a command is valid
3. **State is derived** — never stored directly; always rebuilt from events
4. **Commands can fail; events cannot** — if an event was stored, it happened

---

## Decision Tree for Common Questions

### "What should be an event?"
→ Read `references/events.md` → Section: Event Design Principles

### "How do I prevent X from happening twice / enforce a business rule?"
→ Read `references/aggregates.md` → Section: Invariant Enforcement

### "How do I query current state?"
→ Read `references/projections.md` → Section: Read Models

### "How do I coordinate across multiple aggregates?"
→ Read `references/sagas.md`

### "My event schema changed — what now?"
→ Read `references/versioning.md`

### "Show me working code"
→ Read `references/examples.md`

---

## Anti-Patterns to Always Flag

When you see these in user code or designs, proactively call them out:

- ❌ **Storing state instead of events** — the whole point is the log
- ❌ **Fat events** — dumping entire entity state into every event
- ❌ **Anemic aggregates** — business logic leaking outside the aggregate
- ❌ **Querying the event store for reads** — use projections
- ❌ **Cross-aggregate transactions** — use sagas/process managers instead
- ❌ **Mutable events** — events must be immutable once written
- ❌ **Technical events** ("UserRowUpdated") — events must be domain language ("OrderPlaced")
- ❌ **Missing aggregate version** — without optimistic concurrency you'll get lost updates

---

## Glossary (quick reference)

| Term | Definition |
|------|-----------|
| **Aggregate** | Cluster of domain objects treated as a unit; enforces invariants |
| **Aggregate Root** | The entry point to an aggregate; the only object external code touches |
| **Event** | Immutable record of something that happened in the domain |
| **Command** | Intent to change state; may be rejected |
| **Event Store** | Append-only log of events, partitioned by stream (aggregate ID) |
| **Projection** | Reads events and builds a read model / view |
| **Saga / Process Manager** | Coordinates long-running processes across aggregate boundaries |
| **Snapshot** | Optimization: cached state at a point in time to avoid full replay |
| **Upcaster** | Transforms old event versions to new schema on read |
| **Optimistic Concurrency** | Using expected version numbers to detect concurrent writes |

---

## Response Style

When answering event sourcing questions:
1. **Show the domain language first** — name events and aggregates in business terms
2. **Show invariants explicitly** — make it clear what the aggregate is protecting
3. **Provide code** — TypeScript or Python unless user specifies otherwise
4. **Explain the why** — event sourcing has a learning curve; explain tradeoffs
5. **Flag anti-patterns** if present in the user's existing design
6. **Be opinionated** — recommend specific patterns; don't just list options

Always load the relevant reference file(s) before answering a detailed question.
