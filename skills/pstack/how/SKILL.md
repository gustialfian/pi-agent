---
name: how
description: "Use for \"how does X work\", code walkthroughs before changing something, and placement / ownership / layering questions (\"where should this live\", \"which package owns this\", \"is this the right layer\"). Explains subsystem architecture, runtime flow, onboarding mental models. Use why for motivation."
disable-model-invocation: true
---

# How

Explore the codebase to answer "how does X work?" questions. Produce architectural explanations at the level of a senior engineer onboarding onto a subsystem, enough to build a working mental model, not so much that it reads like annotated source code.

The current agent performs both roles: **explorer** gathers evidence, then **explainer** turns it into a working mental model. Use the available file-search and reading tools. Keep codebase exploration read-only.

## Step 1. Assess Complexity

If the scope is ambiguous, state your interpretation and explore. The user can redirect.

- **Simple** (a single module, a small utility, a narrow question such as "how does function X work"): use one focused exploration angle.
- **Complex** (a subsystem spanning multiple files or services, a cross-cutting feature, a full architectural overview): decompose the question into 2 to 4 distinct exploration angles.

When in doubt, take the simple path.

## Step 2. Explore

Read `references/explorer-prompt.md` and apply it to each angle in turn, using the user's question and the current angle in place of the placeholders. Reuse evidence across angles instead of rereading unchanged code.

Keep working findings for each angle in the reference's output structure; these are notes for synthesis, not the user-facing answer. For a simple question, keep them brief.

Finish when each angle has an evidence-backed flow, relevant components and boundaries, and explicitly recorded gaps. For ownership or layering questions, also identify the existing dependency direction and comparable implementations.

## Step 3. Synthesize

Read `references/explainer-prompt.md` and apply it using the original question and all exploration findings. Switch to the explainer role, reconcile overlaps, and check the code where findings conflict or evidence is missing.

## Step 4. Present

Present the synthesized explanation, not the exploration notes. Distinguish observed behavior from recommendations when answering placement or layering questions.

## Output Format

The explanation uses the sections defined in `references/explainer-prompt.md`, dropping any that do not apply: Overview, Key Concepts, How It Works, Where Things Live, Gotchas.
