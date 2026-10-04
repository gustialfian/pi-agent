---
name: verification-maintain
description: Audit project verification docs and feature maps through sequential source review and live checks.
disable-model-invocation: true
argument-hint: <directory>
---

# Maintain a verification skill

Audit the verification guide and feature map created by `/skill:verification-create`, or equivalent project-local verification docs. Review source for every mapped feature and exercise every feature live. You do not need to run every documented action.

## Required directory argument

Invoke with `/skill:verification-maintain <directory>`, for example `/skill:verification-maintain verifier` or `/skill:verification-maintain tools/verification`.

Require one directory argument. If it is missing or ambiguous, ask for it before inspecting or changing the project. Resolve a relative path against the target repository root. Maintain only the supplied target. Do not choose a default or switch to another location without approval.

## Outcomes

Pick one, and say which:

- **clean** — every feature got source and live coverage; nothing worth shipping. No branch, no PR.
- **changed** — one PR ships proven doc, harness, or map corrections.
- **blocked** — coverage could not finish or a proven fix could not ship safely. Say exactly what blocked it.

## Edit scope

Only edit the verification guide, its feature map, and tools it owns within the supplied directory. Report needed corrections to external tools without editing them. Never edit product code during a run. Distinguish outdated docs from product regressions. Correct outdated docs and report product regressions rather than changing docs to hide them.

## Pass

0. **Locate the target.** Read `README.md` and `features/README.md` within the supplied directory. Identify the documented launch and drive instructions and the tools the guide owns. If the guide or map is missing, stop and report the missing paths. Point at `/skill:verification-create <directory>` using the same directory rather than inventing a target.

1. **Index hygiene.** Read the feature map README and glob its sibling files. Fix missing, extra, duplicate, or dead entries. Lightweight; no generated inventory.

2. **Source review.** Review each feature file sequentially yourself. For each feature, explain how its user-facing behavior works from source, flag likely doc drift with source citations, and write one concise live-verification recipe. Do not drive the app or edit files during this step. Record a feature summary, source entry points, likely drift or none, and one recipe.

3. **Reconcile.** Confirm every feature file has a source-review summary. Merge overlapping recipes into as few app states as practical. Spot-check cited drift; don't re-prove clean claims. Sweep recent churn for user-facing surfaces missing from the map — require a concrete source path before calling one missing.

4. **Live pass.** Required even when source looks clean. The coordinator owns all driving; follow the verification guide's own launch model — one long-lived instance driven serially for servers and UIs, or a fresh isolated session per drive for short-lived CLIs (the guide's Launch section decides, not this one). Exercise every feature at least once, and hold three invariants the whole pass, whatever the failure: (1) never drive an instance you haven't health-checked since it last did something surprising — doctor before first drive, doctor on each fresh session where sessions are the unit, doctor again after any failed drive, and where doctor can't see the failure (a wedged UI state on a healthy process), reset to a known state or relaunch rather than hoping; (2) evidence captured so far survives every cleanup, checked at its named location, not assumed; (3) nothing a drive started outlives that drive's usefulness — failed-iteration residue is cleaned whether the session is stuck, exited, or shared (for a shared instance, clean the residue, not the instance). A doctor failure caused by outdated verification instructions is doc or tool drift. Fix it under edit scope and retry once — restart whatever the fix invalidated, nothing more — before calling the pass `blocked`. A feature that can't be reached is `verified-unreachable` only with the concrete prerequisite (auth, entitlement, OS, external state) and the route attempted; if the map omits that prerequisite, that's drift. Any harness fix from triage gets re-driven live before it ships. Final teardown happens after the last drive of the run — including those re-proofs — so nothing outlives the run (evidence stays, per the skill).

5. **Triage.** Wrong or missing user-POV description → doc drift, fix it. Working behavior the harness can't drive → harness gap, fix it; a harness fix follows the same helpers rule as generation (scripts executable, invocation documented in the verification guide). App behavior that's actually broken → product gap; record it for the user, keep it out of this PR.

6. **Ship or stop.** For changed: one PR of proven corrections, re-read every changed file first. For clean or blocked: no PR, report the outcome and the coverage honestly.

Keep concise run notes (features covered, unreachable prerequisites, confirmed drift, outcome) in a scratch location; don't commit them.
