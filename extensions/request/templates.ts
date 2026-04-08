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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TemplateContextRecord = Record<string, any>;

// Conditional markers for templates: {{?key}} shows content if key is truthy
function interpolate(template: string, context: TemplateContextRecord): string {
  // First pass: handle conditionals {{?key}}content{{/key}}
  let result = template.replace(/\{\{\?(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (_, key, content) => {
    const value = context[key];
    return value ? content : "";
  });
  
  // Second pass: handle simple replacements {{key}}
  result = result.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const value = context[key];
    if (value === undefined) return `{{${key}}}`;
    if (typeof value === "boolean") return value ? "✅" : "⬜";
    return String(value);
  });
  
  return result;
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

## Architectural decisions

Durable decisions that apply across all phases:

- **Routes**: ...
- **Schema**: ...
- **Key models**: ...
- (add/remove sections as appropriate)

---

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

// === Analyze message (sent to agent) ===
export const analyzeMessageTemplate = `/skill:{{skillPath}}

---

## Request to Analyze

\`{{requestDir}}/{{id}}/request.md\`

---

Please analyze this request using the grill-me framework.

After the interview is complete:
1. Fill in the Interview template at: \`{{requestDir}}/{{id}}/interview.md\`
2. Fill in the PRD template at: \`{{requestDir}}/{{id}}/prd.md\`

The PRD template and Interview template has been created. Fill in each section with the results.`;

export function formatAnalyzeMessage(context: TemplateContext): string {
  return interpolate(analyzeMessageTemplate, context);
}

// === Plan message (sent to agent) ===
export const planMessageTemplate = `/skill:{{skillPath}}

---

## Request: {{id}}

### Original Request
\`{{requestDir}}/{{id}}/request.md\`

### Interview
\`{{requestDir}}/{{id}}/interview.md\`

### PRD
\`{{requestDir}}/{{id}}/prd.md\`

---

Please create a phased implementation plan using tracer bullet vertical slices.

Fill in the plan template at: \`{{requestDir}}/{{id}}/plan.md\`

The plan template has been created. Fill in each phase with the implementation details.`;

export function formatPlanMessage(context: TemplateContext): string {
  return interpolate(planMessageTemplate, {
    prdContent: context.prdContent || "_No PRD found. Run /req analyze first._",
    interviewContent: context.interviewContent || "_No interview conducted yet. Run /req analyze first._",
    ...context,
  });
}

// === Implementation message (sent to agent) ===
export const implMessageTemplate = `## Implementation Session for: {{id}}

### Original Request
\`{{requestDir}}/{{id}}/request.md\`

### Interview
\`{{requestDir}}/{{id}}/interview.md\`

### PRD
\`{{requestDir}}/{{id}}/prd.md\`

### Implementation Plan
\`{{requestDir}}/{{id}}/plan.md\`

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
{{?prdExists}}- ✅ PRD
{{?prdMissing}}- ⬜ PRD (none)
{{?interviewExists}}- ✅ Interview
{{?interviewMissing}}- ⬜ Interview (none)
{{?planExists}}- ✅ Plan
{{?planMissing}}- ⬜ Plan (none)
{{?logExists}}- 🔨 Log
{{?logMissing}}- ⬜ Log (none)`;

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
  return interpolate(statusTemplate, context);
}
