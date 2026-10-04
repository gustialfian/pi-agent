# Sketch guide

Use this guide for each candidate during Phase B. Carry forward the task and grounding constraints. Explore candidates sequentially, giving each a genuinely different organizing structure rather than cosmetically changing the first.

## Design discipline

- **Caller usage first.** Write README-style usage and two or three realistic call sites before types. Derive the sketch from usage and reconcile disagreements in favor of the required caller experience.
- **Data structures first.** Trace dominant access patterns through the proposed types. Account for necessary indexes and ownership now rather than promising to add them later.
- **Interface depth.** Hide meaningful complexity behind a small public surface. Parse transport, storage, and framework representations into domain concepts behind the boundary.
- **Visible boundaries.** Use signatures, intent and invariant comments, placeholder bodies, and short pseudocode to make input-to-output flow traceable. Place sketches in the response or agreed documentation; production scaffolds require implementation authorization.
- **Structural invariants.** Prefer hard-to-misuse types over runtime checks and prose. Keep one source of truth per invariant; derive instead of synchronizing duplicated state.
- **Boundary validation.** Validate external inputs at boundaries and use typed domain data internally. Keep business logic in pure functions and framework wiring thin.
- **Concurrent writes.** When multiple actors might write, first consider independent owned state merged at a read boundary. If one canonical mutable object is essential, specify structural coordination.
- **Retries and partial failure.** Where state changes are involved, explain what happens if an operation runs twice or crashes halfway and how recovery converges.
- **Reader load.** Keep call chains short and mutable state narrowly scoped. Each layer should hide a meaningful decision or change the abstraction, not forward identical arguments.
- **Observed needs.** Remove obsolete structure before adding new machinery. Avoid speculative options, validators, and abstractions.

## Candidate notes

Record usage, core types and signatures, module ownership, data flow, interface depth, tradeoffs, and unresolved risks. Screen against `design-red-flags.md` before comparing candidates.

After comparison, produce one chosen design package using `rationale-template.md`. Record why the base won, what was adapted, and what was rejected. These alternatives reflect one agent's exploration, not independent validation.
