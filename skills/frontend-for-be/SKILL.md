---
name: frontend-for-be
description: Guides an AI coding agent through a domain- and stack-agnostic, specs-first workflow for designing and building frontend web apps. Use when the user wants a reproducible FE workflow, especially with stop-and-wait approval gates, iterative implementation, human visual review, and durable frontend planning docs.
disable-model-invocation: true
---

# Frontend Agentic Workflow

Use this skill when helping the user design, plan, build, review, or iterate on a frontend web application.

This skill is intentionally **domain-agnostic** and **technology-stack-agnostic**. Do not assume React, Vue, Angular, Svelte, Next.js, Nuxt, Tailwind, component libraries, API strategy, testing tools, or product domain unless the project already establishes them or the user explicitly chooses them.

## Core Operating Mode

Be strict about process and flexible about implementation details.

The workflow prioritizes:

- reproducibility
- explicit decisions
- frontend learning for backend-leaning developers
- small reviewable increments
- durable project documentation
- human-controlled visual review
- stop-and-wait approval gates

## Non-Negotiable Rules

1. **Ask one question at a time during discovery and planning.**
   - Do not send a large questionnaire.
   - For each question, provide your recommended answer and a short reason.
   - Wait for the user's answer before continuing.

2. **Inspect the codebase instead of asking when the answer can be discovered.**
   - Check existing files, package manifests, routes, framework conventions, styling setup, component libraries, tests, and docs before asking.

3. **Do not implement before approval.**
   - Produce and summarize the relevant plan/spec first.
   - Stop and wait for explicit approval before writing or changing application code.

4. **Use stop-and-wait gates.**
   - After each major phase or implementation increment, stop and ask for review/approval.
   - Do not continue automatically into the next phase.

5. **Use ephemeral iteration plans, not a permanent implementation plan.**
   - For each implementation cycle, propose a concise plan in chat.
   - Wait for approval.
   - Implement that increment.
   - Update durable docs only when lasting product/design/component decisions change.

6. **Human owns visual review unless explicitly delegated.**
   - The user reviews screenshots/browser output.
   - If browser automation is available and the user asks, you may help capture screenshots, but approval still comes from the user.

7. **Do not add an accessibility QA gate by default.**
   - Include accessibility only if the user asks for it or the project already requires it.

## Default Durable Docs

Prefer this default documentation structure:

```txt
docs/frontend/
  product-brief.md
  page-specs.md
  design-direction.md
  component-map.md
  review-checklist.md
  decisions.md
```

Create or update these docs only after the relevant phase summary is approved. Do not churn docs after every individual answer.

### `product-brief.md`

Capture:

- product/domain summary
- target users
- user goals
- business/product goals
- in-scope features
- non-goals
- assumptions

### `page-specs.md`

Capture:

- routes/pages/screens
- purpose of each page
- primary user actions
- data displayed or collected
- loading/empty/error states when relevant
- navigation between pages

### `design-direction.md`

Capture:

- visual style
- layout density
- desktop/mobile/responsive target
- design references if any
- styling approach
- component library/design system choices
- visual constraints and non-goals

### `component-map.md`

Capture:

- page-to-component decomposition
- reusable components
- layout/app-shell components
- ownership boundaries between components
- props/data responsibilities when useful

### `review-checklist.md`

Capture:

- what the user should manually review
- visual review checkpoints
- agreed automated checks such as typecheck, lint, build, unit tests, or e2e tests
- known skipped checks, such as accessibility, if intentionally excluded

### `decisions.md`

Capture durable decisions, for example:

- chosen tech stack
- package manager
- routing strategy
- state management strategy
- styling/component library choices
- mock data vs API integration
- test level
- responsive target
- approval/review rules
- important trade-offs and rejected options

## Workflow Phases

### Phase 0: Codebase Reconnaissance

Before asking setup questions, inspect the repository when files exist.

Look for:

- `package.json`, lockfiles, framework config
- existing app structure
- routes/pages
- styling setup
- component library
- test setup
- docs
- README or product notes

Then summarize what is known and ask the next missing decision question.

### Phase 1: Discovery

Determine the project context one question at a time.

Typical decisions include:

- app/domain type
- target users
- primary user workflows
- pages/screens
- tech stack preference or existing stack
- data source: mocked, local, API, hybrid
- desktop/mobile/responsive target
- visual quality target
- component library/design system
- form/table/chart needs
- testing/check level
- review gates
- explicit non-goals

For each question:

1. Ask exactly one question.
2. Provide a recommended answer.
3. Explain briefly why.
4. Wait.

### Phase 2: Product Brief Gate

Summarize the proposed product brief in chat.

Ask:

> Do you approve this product brief so I can write `docs/frontend/product-brief.md`?

Only after approval, write/update the doc.

### Phase 3: Page Specs Gate

Summarize pages/routes/screens and key behavior.

Ask for approval before writing/updating `docs/frontend/page-specs.md`.

### Phase 4: Design Direction Gate

Summarize the visual/design direction.

Include only decisions that apply to this project, such as:

- desktop-only vs responsive
- layout style
- density
- color/theme direction
- component library
- styling method

Ask for approval before writing/updating `docs/frontend/design-direction.md` and `docs/frontend/decisions.md` if needed.

### Phase 5: Component Map Gate

Propose a component decomposition.

Keep it useful, not pixel-level. Include page-level and reusable components.

Ask for approval before writing/updating `docs/frontend/component-map.md`.

### Phase 6: Review Checklist Gate

Propose the review process.

Include:

- manual visual review checkpoints owned by the user
- automated commands the agent should run
- intentionally skipped concerns

Ask for approval before writing/updating `docs/frontend/review-checklist.md`.

### Phase 7: Iterative Implementation

For each implementation increment:

1. Propose a short iteration plan in chat.
2. Include files likely to be created/changed.
3. Include expected visible result.
4. Include checks to run.
5. Stop and wait for approval.
6. Implement only the approved increment.
7. Run agreed checks.
8. Summarize changes and check results.
9. Ask the user to perform visual review.
10. Stop and wait for approval or requested changes.

Good increments include:

- project scaffolding
- app shell/layout
- one page at a time
- table/data view
- form and validation
- chart/data visualization
- polish pass
- refactor pass

### Phase 8: Iteration Changes

When the user requests adjustments:

1. Restate the requested change.
2. Identify whether durable docs need updating.
3. Propose a short iteration plan.
4. Wait for approval unless the change is trivial and the user explicitly asked you to directly apply it.
5. Implement, check, summarize, and stop.

When the user asks for a prototype:

- Create it at a new route prefix matching `/prototype-*`.
- Do not add prototype routes to the primary navigation or app navigation menus.
- Treat prototypes as isolated iteration artifacts unless the user explicitly asks to promote them into the main app flow.

### Phase 9: Finalization

At the end of a feature or app build:

- run agreed final checks
- summarize completed scope
- summarize known limitations
- update durable docs if decisions changed
- suggest next possible increments only after the user asks or after stopping for final approval

## Recommended Behavior for Backend-Leaning Users

When the user has less frontend experience:

- explain frontend decisions briefly, using backend analogies when useful
- prefer conventional patterns over clever custom UI architecture
- make state/data flow explicit
- clarify component boundaries
- clarify validation, form state, table state, and routing decisions
- avoid overwhelming the user with CSS minutiae unless relevant

## Output Style

Be concise but explicit.

During grilling/discovery, use this shape:

```md
Question N: <single decision question>

Recommended answer:
> <recommendation>

Why:
- <short reason>

Do you agree?
```

During implementation gates, use this shape:

```md
Proposed iteration: <name>

Plan:
1. ...
2. ...

Likely files:
- ...

Expected result:
- ...

Checks:
- ...

Approve this iteration?
```
