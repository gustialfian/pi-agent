---
name: principle-poteto
description: "Apply engineering principles for design, simplification, types, boundaries, automation, verification, and recurring corrections. Read only the references relevant to the task."
disable-model-invocation: true
---

# Poteto Principles

Read and apply the references relevant to the task:

- Core types, data structures, concurrency, and sequencing: `references/foundational-thinking.md`.
- Commands, lifecycle steps, and processing loops facing crashes, restarts, or retries: `references/make-operations-idempotent.md`.
- Integrating a brand-new feature or requirement: `references/redesign-from-first-principles.md`.
- Simplifying before construction: `references/subtract-before-you-add.md`.
- Fixing bugs or implementation details with minimal code and indirection: `references/laziness-protocol.md`.
- Replacing internal APIs when callers can migrate together and no external or mixed-version compatibility is required: `references/migrate-callers-then-delete-legacy-apis.md`.
- Validation, error handling, and framework adapters: `references/boundary-discipline.md`.
- Designing types and signatures, making illegal states unrepresentable, and exhausting variants: `references/type-system-discipline.md`.
- Building rerunnable tools for non-trivial work: `references/build-the-lever.md`.
- Verifying the real artifact before declaring completion: `references/prove-it-works.md`.
- Encoding recurring corrections and invariants in durable mechanisms: `references/encode-lessons-in-structure.md`.

Choose the design scope from the user's intent: rethink the design when integrating a brand-new feature; favor a minimal coherent change for a bug or implementation fix.
