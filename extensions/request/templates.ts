/**
 * Request extension templates
 * Extract prompts and message templates from logic for easy customization
 */

export interface TemplateContext {
  id: string;
  title?: string;
  content?: string;
  requestContent?: string;
  prdContent?: string;
  interviewContent?: string;
  planContent?: string;
  skillPath?: string;
  requestDir?: string;
  created?: string;
  status?: string;
  timestamp?: number;
  started?: string;
}

function interpolate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = context[key as keyof TemplateContext];
    return value !== undefined ? String(value) : `{{${key}}}`;
  });
}

// === Request file template ===
export const requestTemplate = `---
id: {{id}}
title: {{title}}
created: {{created}}
status: idea
---

# {{title}}

## Problem Statement

<!-- What problem does this solve? -->

## Notes

<!-- Initial thoughts, context, ideas -->

`;

export function formatRequestTemplate(context: TemplateContext): string {
  return interpolate(requestTemplate, {
    created: new Date().toISOString(),
    status: "idea",
    ...context,
  });
}

// === Interview file template ===
export const interviewTemplate = `# Interview: {{id}}

## Transcript

<!-- Q&A session goes here -->

---

## Refined Understanding

<!-- Summary of key insights, decisions, and open questions -->

`;

export function formatInterviewTemplate(context: TemplateContext): string {
  return interpolate(interviewTemplate, context);
}

// === Log file template ===
export const logTemplate = `# Implementation Log: {{id}}

## Started: {{started}}

## Request
\`{{requestDir}}/{{id}}/request.md\`

## Plan
\`{{requestDir}}/{{id}}/plan.md\`

## Progress

- [ ] Implementation tasks...

## Checkpoints

### Checkpoint 1: {{started}}
<!-- Document progress at this point -->

---
*Update this log file to track progress. This allows pausing and resuming.*

`;

export function formatLogTemplate(context: TemplateContext): string {
  return interpolate(logTemplate, {
    started: new Date().toISOString(),
    ...context,
  });
}

// === PRD file template ===
export const prdTemplate = `## Problem Statement
The problem from the user's perspective.

## Solution
The solution from the user's perspective.

## User Stories
A numbered list of user stories in format:
1. As an <actor>, I want <feature>, so that <benefit>

## Implementation Decisions
- Modules to build/modify
- Interfaces changes
- Technical clarifications
- Architectural decisions

## Testing Decisions
- What makes a good test
- Which modules will be tested

## Out of Scope
Things not included in this PRD.

## Further Notes
Additional notes about the feature.`;

export function formatPrdTemplate(context: TemplateContext): string {
  return interpolate(prdTemplate, context);
}

// === Plan file template ===
export const planTemplate = `# Plan: {{title}}

> Source PRD: {{requestDir}}/{{id}}/prd.md

## Phase 1: [Title]

<!-- What to build -->

### Acceptance criteria
- [ ] 

## Phase 2: [Title]

<!-- What to build -->

### Acceptance criteria
- [ ] `;

export function formatPlanTemplate(context: TemplateContext): string {
  return interpolate(planTemplate, {
    title: context.title || "Feature",
    ...context,
  });
}

// === Analyze message (sent to agent) ===
export const analyzeMessageTemplate = `/skill:{{skillPath}}

---

## Request to Analyze

{{content}}

---

Please analyze this request using the grill-me framework.

After the interview is complete:
1. Save the full interview transcript to: \`{{requestDir}}/{{id}}/interview.md\`
2. Fill in the PRD template at: \`{{requestDir}}/{{id}}/prd.md\`

The PRD template has been created. Fill in each section with the analysis results.`;

export function formatAnalyzeMessage(context: TemplateContext): string {
  return interpolate(analyzeMessageTemplate, context);
}

// === Plan message (sent to agent) ===
export const planMessageTemplate = `/skill:{{skillPath}}

---

## Request: {{id}}

### Original Request
{{requestContent}}

### Interview
{{interviewContent}}

---

Please create a phased implementation plan using tracer bullet vertical slices.

Fill in the plan template at: \`{{requestDir}}/{{id}}/plan.md\`

The plan template has been created. Fill in each phase with the implementation details.`;

export function formatPlanMessage(context: TemplateContext): string {
  return interpolate(planMessageTemplate, {
    interviewContent: context.interviewContent || "_No interview conducted yet. Run /req analyze first._",
    ...context,
  });
}

// === Implementation message (sent to agent) ===
export const implMessageTemplate = `## Implementation Session for: {{id}}

### Original Request

{{requestContent}}

### PRD (Product Requirements)

{{prdContent}}

### Interview Notes

{{interviewContent}}

### Implementation Plan

{{planContent}}

---

### Progress Log

Track progress in: \`{{requestDir}}/{{id}}/log.md\`

**Workflow:**
1. Work on implementation tasks from the plan
2. Update the log file with checkpoints as you progress
3. When done, use \`/req done {{id}}\` to mark completion

Keep the log file updated to allow pausing and resuming without losing context.`;

export function formatImplMessage(context: TemplateContext): string {
  return interpolate(implMessageTemplate, {
    prdContent: context.prdContent || "_No PRD found. Run /req analyze first._",
    interviewContent: context.interviewContent || "_No interview conducted yet. Run /req analyze first._",
    ...context,
  });
}

// === Status summary ===
export const statusTemplate = `Request: {{id}}
Status: {{statusIcon}} {{status}}
Title: {{title}}
Created: {{created}}

Files:
- Request: {{requestDir}}/{{id}}/request.md
{{prdExists}}- ✅ PRD
{{prdMissing}}- ⬜ PRD (none)
{{interviewExists}}- ✅ Interview
{{interviewMissing}}- ⬜ Interview (none)
{{planExists}}- ✅ Plan
{{planMissing}}- ⬜ Plan (none)
{{logExists}}- 🔨 Log
{{logMissing}}- ⬜ Log (none)`;

export interface StatusContext extends TemplateContext {
  statusIcon?: string;
  title: string;
  created: string;
  prdExists?: boolean;
  prdMissing?: boolean;
  interviewExists?: boolean;
  interviewMissing?: boolean;
  planExists?: boolean;
  planMissing?: boolean;
  logExists?: boolean;
  logMissing?: boolean;
}

export function renderStatusTemplate(context: StatusContext): string {
  return interpolate(statusTemplate, context)
    .replace("{{prdExists}}- ✅ PRD\n", "")
    .replace("{{prdMissing}}- ⬜ PRD (none)\n", "")
    .replace("{{interviewExists}}- ✅ Interview\n", "")
    .replace("{{interviewMissing}}- ⬜ Interview (none)\n", "")
    .replace("{{planExists}}- ✅ Plan\n", "")
    .replace("{{planMissing}}- ⬜ Plan (none)\n", "")
    .replace("{{logExists}}- 🔨 Log\n", "")
    .replace("{{logMissing}}- ⬜ Log (none)\n", "");
}
