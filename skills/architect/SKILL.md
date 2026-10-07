---
name: architect
description: "Sketch types, signatures, and module structure before implementation. Use for /architect, 'architect this', or 'design this'."
disable-model-invocation: true
---

# Architect

Design before implementing. The current agent grounds the problem, explores distinct shapes sequentially, and synthesizes a chosen design. Alternatives are design exploration, not independent model opinions.

Track progress with a short checklist: Ground, Sketch, Agree, and Implement (when authorized). Redesign is a conditional loop.

## Phase A: Ground

Read and apply `../how/SKILL.md` to the relevant subsystems. Produce its traced mental model, not just a list of files. Capture integration points, dependency directions, existing types, caller compatibility, and invariants from code, tests, and documentation. Mark undocumented rationale as unknown.

Skip grounding only for genuinely greenfield work with no surrounding system to integrate. Finish when the affected flows and constraints are identified, with gaps recorded.

## Phase B: Sketch

Read `references/sketch-guide.md` and `references/rationale-template.md`. For applicable decisions, read these installed principles:

- Core types and sequencing: `../principle-foundational-thinking/SKILL.md`.
- Integrating new requirements: `../principle-redesign-from-first-principles/SKILL.md`.
- Simplifying before construction: `../principle-subtract-before-you-add/SKILL.md`.
- Replacing internal APIs when callers can migrate together and no external or mixed-version compatibility is required: `../principle-migrate-callers-then-delete-legacy-apis/SKILL.md`.
- Encoding recurring corrections and invariants: `../principle-encode-lessons-in-structure/SKILL.md`.
- Validation and adapters: `../principle-boundary-discipline/SKILL.md`.
- Reducing code and indirection: `../principle-laziness-protocol/SKILL.md`.

Produce at least two structurally distinct candidate sketches sequentially. Variations of the same shape do not count. If constraints rule out an alternative, record the concrete constraint that makes it nonviable.

Write caller usage first, then derive types, signatures, and module boundaries. Keep candidate notes concise; the chosen design gets the full rationale.

Read `references/design-red-flags.md` and screen each candidate. Revise or reject shallow modules, information leakage, temporal decomposition, and pass-through methods. Compare viable candidates by interface depth: capability hidden behind the public surface relative to its size, rather than implementation simplicity alone.

Synthesize one design, recording the base candidate, adaptations, rejected choices, and tradeoffs. Finish when usage and signatures agree, all candidates have been screened, and unresolved risks are explicit.

## Phase C: Agree

Respect the request's scope:

- **Design-only or `/architect` alone:** present the chosen sketch and rationale, then stop.
- **Explicit implementation request:** proceed after synthesis within the authorized scope.
- **Requested checkpoint:** present the design and pause for approval before implementation.

Keep sketches in the response or agreed documentation files. Write placeholder bodies into production source only when implementation is authorized. Commit only when requested. Keep existing checks passing; any temporary breakage requires explicit agreement on scope and recovery.

If unresolved questions affect correctness, safety, or compatibility, ask before implementing. Human pushback on the shape becomes new grounding evidence: return to Phase A, then Phase B.

## Phase D: Implement

Fill in the chosen sketch within the authorized scope. Treat it as the contract, but surface meaningful deviations. If a new parameter or special case is needed, determine whether the sketch missed a requirement or the implementation is overreaching.

Finish when the intended behavior is implemented, relevant static and runtime checks have run, results and remaining gaps are reported, and the rationale reflects material changes.

## Conditional loop: Redesign

Repeated friction can expose a wrong architecture. Signals include:

- Similar workarounds across unrelated code.
- Independent edge cases requiring the same special-case branches.
- Types needing escape hatches or misleading optional fields.
- Shared writes where the sketch assumed independent state.
- Callers needing internal knowledge to use the abstraction.
- Two or more independent implementation deviations of the same shape.

Distinguish intrinsic problem complexity from design complexity. A single edge case does not condemn a design.

When the pattern is structural, re-run `how` over the affected implementation. Apply redesign-from-first-principles to the newly discovered constraints and subtract-before-you-add to remove obsolete structure. Return to Phase B; follow Phase C's authorization rules again. Preserve unrelated user changes.

## Outputs

For small work, provide a usage sketch plus types and signatures. For larger work, add a module map and data flow. Ship the chosen rationale alongside, using `references/rationale-template.md`. Keep exploration notes separate from the final design.
