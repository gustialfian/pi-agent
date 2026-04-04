import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { Text } from "@mariozechner/pi-tui";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";

const REQUEST_DIR = ".pi/request";

// File names inside request directory
const REQUEST_FILE = "request.md";
const INTERVIEW_FILE = "interview.md";
const PRD_FILE = "prd.md";
const PLAN_FILE = "plan.md";
const LOG_FILE = "log.md";

// Store cwd for autocomplete - will be set on session start
let sessionCwd = "";

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

function generateId(timestamp: number, slug: string): string {
  return `${timestamp}-${slug}`;
}

function parseId(id: string): { timestamp: number; slug: string } | null {
  const match = id.match(/^(\d+)-(.+)$/);
  if (!match) return null;
  return { timestamp: Number(match[1]), slug: match[2] };
}

function getRequestDir(cwd: string, id: string): string {
  return join(cwd, REQUEST_DIR, id);
}

function getRequestFilePath(cwd: string, id: string): string {
  return join(getRequestDir(cwd, id), REQUEST_FILE);
}

function getInterviewFilePath(cwd: string, id: string): string {
  return join(getRequestDir(cwd, id), INTERVIEW_FILE);
}

function getPrdFilePath(cwd: string, id: string): string {
  return join(getRequestDir(cwd, id), PRD_FILE);
}

function getPlanFilePath(cwd: string, id: string): string {
  return join(getRequestDir(cwd, id), PLAN_FILE);
}

function getLogFilePath(cwd: string, id: string): string {
  return join(getRequestDir(cwd, id), LOG_FILE);
}

async function ensureRequestDir(cwd: string, id: string): Promise<string> {
  const dir = getRequestDir(cwd, id);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

async function getRequestDirs(cwd: string): Promise<string[]> {
  const dir = join(cwd, REQUEST_DIR);
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
  // Filter for directories (request IDs)
  const dirs: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = await import("node:fs/promises").then(fs => fs.stat(fullPath));
    if (stat.isDirectory()) {
      dirs.push(entry);
    }
  }
  return dirs.sort().reverse();
}

async function readRequestFile(cwd: string, id: string): Promise<string | null> {
  const file = getRequestFilePath(cwd, id);
  if (!existsSync(file)) return null;
  return readFile(file, "utf-8");
}

async function writeRequestFile(cwd: string, id: string, content: string): Promise<void> {
  const file = getRequestFilePath(cwd, id);
  await writeFile(file, content, "utf-8");
}

async function readPlanFile(cwd: string, id: string): Promise<string | null> {
  const file = getPlanFilePath(cwd, id);
  if (!existsSync(file)) return null;
  return readFile(file, "utf-8");
}

async function readLogFile(cwd: string, id: string): Promise<string | null> {
  const file = getLogFilePath(cwd, id);
  if (!existsSync(file)) return null;
  return readFile(file, "utf-8");
}

async function readInterviewFile(cwd: string, id: string): Promise<string | null> {
  const file = getInterviewFilePath(cwd, id);
  if (!existsSync(file)) return null;
  return readFile(file, "utf-8");
}

async function readPrdFile(cwd: string, id: string): Promise<string | null> {
  const file = getPrdFilePath(cwd, id);
  if (!existsSync(file)) return null;
  return readFile(file, "utf-8");
}

async function writeLogFile(cwd: string, id: string, content: string): Promise<void> {
  await ensureRequestDir(cwd, id);
  const file = getLogFilePath(cwd, id);
  await writeFile(file, content, "utf-8");
}

async function writeInterviewFile(cwd: string, id: string, content: string): Promise<void> {
  await ensureRequestDir(cwd, id);
  const file = getInterviewFilePath(cwd, id);
  await writeFile(file, content, "utf-8");
}

async function writePlanFile(cwd: string, id: string, content: string): Promise<void> {
  await ensureRequestDir(cwd, id);
  const file = getPlanFilePath(cwd, id);
  await writeFile(file, content, "utf-8");
}

interface RequestMetadata {
  id: string;
  title: string;
  timestamp: number;
  status: "idea" | "analyzing" | "planned" | "implementing" | "done";
}

async function parseRequestMetadata(cwd: string, id: string): Promise<RequestMetadata | null> {
  const content = await readRequestFile(cwd, id);
  if (!content) return null;

  const parsed = parseId(id);
  if (!parsed) return null;

  // Extract title from frontmatter or first heading
  let title = parsed.slug.replace(/-/g, " ");
  
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  // Check status in frontmatter
  let status: RequestMetadata["status"] = "idea";
  const statusMatch = content.match(/^status:\s*(.+)$/m);
  if (statusMatch) {
    const s = statusMatch[1].trim().toLowerCase();
    if (["idea", "analyzing", "planned", "implementing", "done"].includes(s)) {
      status = s as RequestMetadata["status"];
    }
  }

  return {
    id,
    title,
    timestamp: parsed.timestamp,
    status,
  };
}

async function listRequests(cwd: string): Promise<RequestMetadata[]> {
  const dirs = await getRequestDirs(cwd);
  const requests: RequestMetadata[] = [];
  
  for (const id of dirs) {
    const meta = await parseRequestMetadata(cwd, id);
    if (meta) requests.push(meta);
  }
  
  return requests;
}

async function createRequest(cwd: string, title: string): Promise<string> {
  const timestamp = Date.now();
  const slug = slugify(title);
  const id = generateId(timestamp, slug);
  
  await ensureRequestDir(cwd, id);
  
  const content = `---
id: ${id}
title: ${title}
created: ${new Date(timestamp).toISOString()}
status: idea
---

# ${title}

## Problem Statement

<!-- What problem does this solve? -->

## Notes

<!-- Initial thoughts, context, ideas -->

## Interview Results

<!-- Filled by /req analyze session -->

`;

  await writeRequestFile(cwd, id, content);
  return id;
}

function formatStatus(status: RequestMetadata["status"]): string {
  const icons: Record<string, string> = {
    idea: "💡",
    analyzing: "🔍",
    planned: "📋",
    implementing: "🔨",
    done: "✅",
  };
  return `${icons[status] || "📝"} ${status}`;
}

// Helper for async autocomplete
async function getAutocompleteForPrefix(prefix: string, filterFn: (r: RequestMetadata) => boolean): Promise<AutocompleteItem[]> {
  const cwd = sessionCwd || process.cwd();
  const requests = await listRequests(cwd);
  return requests
    .filter((r) => r.id.startsWith(prefix))
    .filter(filterFn)
    .map((r) => ({ value: r.id, label: `${r.id} - ${r.title}` }));
}

export default function (pi: ExtensionAPI) {
  // Set session cwd on startup
  pi.on("session_start", async (_event, ctx) => {
    sessionCwd = ctx.cwd;
  });

  // Register custom renderer for req-list messages
  pi.registerMessageRenderer("req-list", (message, _options, theme) => {
    const content = typeof message.content === "string" 
      ? message.content 
      : message.content
          .filter((c): c is { type: "text"; text: string } => c.type === "text")
          .map(c => c.text)
          .join("\n");
    const lines = content.split("\n").map((line: string) => 
      theme.fg("accent", line)
    );
    return new Text(lines.join("\n"), 0, 0);
  });

  // === /req log "title" ===
  pi.registerCommand("req-log", {
    description: "Log a new request/idea: /req log \"your idea\"",
    getArgumentCompletions: () => null,
    handler: async (args, ctx) => {
      if (!args || !args.trim()) {
        ctx.ui.notify("Usage: /req log \"your idea title\"", "warning");
        return;
      }

      const title = args.trim();
      const id = await createRequest(ctx.cwd, title);
      
      ctx.ui.notify(`Created request: ${id}`, "info");
    },
  });

  // === /req list ===
  pi.registerCommand("req-list", {
    description: "List all requests",
    handler: async (_args, ctx) => {
      const requests = await listRequests(ctx.cwd);
      
      if (requests.length === 0) {
        ctx.ui.notify("No requests yet. Use /req log \"title\" to create one.", "info");
        return;
      }

      const lines = requests.map((r) => 
        `${formatStatus(r.status)} ${r.id} - ${r.title}`
      );
      
      // Show in chat log
      pi.sendMessage({
        customType: "req-list",
        content: lines.join("\n"),
        display: true,
      }, { deliverAs: "steer" });
    },
  });

  // === /req analyze <id> ===
  pi.registerCommand("req-analyze", {
    description: "Analyze/refine a request using grill-me: /req analyze <id>",
    getArgumentCompletions: async (prefix: string) => {
      return getAutocompleteForPrefix(prefix, () => true);
    },
    handler: async (args, ctx) => {
      if (!args || !args.trim()) {
        ctx.ui.notify("Usage: /req analyze <id>", "warning");
        return;
      }

      const id = args.trim();
      const content = await readRequestFile(ctx.cwd, id);
      
      if (!content) {
        ctx.ui.notify(`Request not found: ${id}`, "error");
        return;
      }

      // Update status to analyzing
      const updated = content.replace(/^status:.*$/m, "status: analyzing");
      await writeRequestFile(ctx.cwd, id, updated);

      ctx.ui.notify(`Starting analysis session for: ${id}`, "info");
      
      // Wait for agent to finish current processing, then send messages
      await ctx.waitForIdle();
      
      // Send the grill-me skill prompt with the request content
      const skillPath = "/home/alfian/.pi/agent/skills/grill-me/SKILL.md";
      
      // Combine skill invocation with context in one message
      const message = `/skill:${skillPath}
      
---

## Request to Analyze

${content}

---

Please analyze this request using the grill-me framework.

After the interview is complete:
1. Append the final refined understanding to the "## Interview Results" section in: \`${REQUEST_DIR}/${id}/request.md\`
2. Save the full interview transcript to: \`${REQUEST_DIR}/${id}/interview.md\`
3. Write a complete PRD to: \`${REQUEST_DIR}/${id}/prd.md\`

Use the following PRD template:

## Problem Statement
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
      
      pi.sendUserMessage(message, { deliverAs: "steer" });
    },
  });

  // === /req plan <id> ===
  pi.registerCommand("req-plan", {
    description: "Create implementation plan for a request: /req plan <id>",
    getArgumentCompletions: async (prefix: string) => {
      return getAutocompleteForPrefix(prefix, (r) => 
        ["idea", "analyzing", "planned"].includes(r.status)
      );
    },
    handler: async (args, ctx) => {
      if (!args || !args.trim()) {
        ctx.ui.notify("Usage: /req plan <id>", "warning");
        return;
      }

      const id = args.trim();
      const requestContent = await readRequestFile(ctx.cwd, id);
      const interviewContent = await readInterviewFile(ctx.cwd, id);
      
      if (!requestContent) {
        ctx.ui.notify(`Request not found: ${id}`, "error");
        return;
      }

      // Update status to planned
      const updated = requestContent.replace(/^status:.*$/m, "status: planned");
      await writeRequestFile(ctx.cwd, id, updated);

      ctx.ui.notify(`Starting planning session for: ${id}`, "info");

      // Wait for agent to finish current processing
      await ctx.waitForIdle();
      
      // Use prd-to-plan skill
      const skillPath = "/home/alfian/.pi/agent/skills/prd-to-plan/SKILL.md";
      
      // Build context with request and interview results
      const context = `## Request: ${id}

### Original Request
${requestContent}

### Interview Results (from /req analyze)
${interviewContent || "_No interview conducted yet. Consider running /req analyze first._"}

---

Please create a phased implementation plan using tracer bullet vertical slices.

**Important output path**: \`${REQUEST_DIR}/${id}/plan.md\`

The plan should be written directly to this path instead of the default \`./docs/plans/\`.`;

      // Combine skill invocation with context in one message
      const message = `/skill:${skillPath}\n\n---\n\n${context}`;
      
      pi.sendUserMessage(message, { deliverAs: "steer" });
    },
  });

  // === /req impl <id> ===
  pi.registerCommand("req-impl", {
    description: "Start implementation for a request: /req impl <id>",
    getArgumentCompletions: async (prefix: string) => {
      return getAutocompleteForPrefix(prefix, (r) => r.status === "planned");
    },
    handler: async (args, ctx) => {
      if (!args || !args.trim()) {
        ctx.ui.notify("Usage: /req impl <id>", "warning");
        return;
      }

      const id = args.trim();
      const requestContent = await readRequestFile(ctx.cwd, id);
      const planContent = await readPlanFile(ctx.cwd, id);
      
      if (!requestContent) {
        ctx.ui.notify(`Request not found: ${id}`, "error");
        return;
      }

      if (!planContent) {
        ctx.ui.notify(`No plan found for ${id}. Run /req plan ${id} first.`, "error");
        return;
      }

      // Initialize the log file
      const logContent = `# Implementation Log: ${id}

## Started: ${new Date().toISOString()}

## Request
\`${REQUEST_DIR}/${id}/request.md\`

## Plan
\`${REQUEST_DIR}/${id}/plan.md\`

## Progress

- [ ] Implementation tasks...

## Checkpoints

### Checkpoint 1: ${new Date().toISOString()}
<!-- Document progress at this point -->

---
*Update this log file to track progress. This allows pausing and resuming.*

`;
      await writeLogFile(ctx.cwd, id, logContent);

      // Update status to implementing
      const updated = requestContent.replace(/^status:.*$/m, "status: implementing");
      await writeRequestFile(ctx.cwd, id, updated);

      ctx.ui.notify(`Starting implementation for: ${id}`, "info");

      // Wait for agent to finish current processing
      await ctx.waitForIdle();

      // Send implementation context to start working
      const implMessage = `## Implementation Session for: ${id}

### Original Request

${requestContent}

### Implementation Plan

${planContent}

---

### Progress Log

Track progress in: \`${REQUEST_DIR}/${id}/log.md\`

**Workflow:**
1. Work on implementation tasks from the plan
2. Update the log file with checkpoints as you progress
3. When done, use \`/req done ${id}\` to mark completion

Keep the log file updated to allow pausing and resuming without losing context.`;
      
      pi.sendUserMessage(implMessage, { deliverAs: "steer" });
    },
  });

  // === /req status <id> ===
  pi.registerCommand("req-status", {
    description: "Show status of a request: /req status <id>",
    getArgumentCompletions: async (prefix: string) => {
      return getAutocompleteForPrefix(prefix, () => true);
    },
    handler: async (args, ctx) => {
      const id = args?.trim();
      
      if (!id) {
        ctx.ui.notify("Usage: /req status <id>", "warning");
        return;
      }

      const requestContent = await readRequestFile(ctx.cwd, id);
      const planContent = await readPlanFile(ctx.cwd, id);
      const logContent = await readLogFile(ctx.cwd, id);
      const interviewContent = await readInterviewFile(ctx.cwd, id);

      if (!requestContent) {
        ctx.ui.notify(`Request not found: ${id}`, "error");
        return;
      }

      const meta = await parseRequestMetadata(ctx.cwd, id);
      const prdContent = await readPrdFile(ctx.cwd, id);
      const summary = [
        `Request: ${id}`,
        `Status: ${formatStatus(meta?.status || "idea")}`,
        `Title: ${meta?.title || "Unknown"}`,
        `Created: ${meta?.timestamp ? new Date(meta.timestamp).toISOString() : "Unknown"}`,
        "",
        "Files:",
        `- Request: ${REQUEST_DIR}/${id}/request.md`,
        prdContent ? `- ✅ PRD` : `- ⬜ PRD (none)`,
        interviewContent ? `- ✅ Interview` : `- ⬜ Interview (none)`,
        planContent ? `- ✅ Plan` : `- ⬜ Plan (none)`,
        logContent ? `- 🔨 Log` : `- ⬜ Log (none)`,
      ].join("\n");

      pi.sendMessage({ customType: "req-status", content: summary, display: true });
    },
  });

  // === /req done <id> ===
  pi.registerCommand("req-done", {
    description: "Mark a request as done: /req done <id>",
    getArgumentCompletions: async (prefix: string) => {
      return getAutocompleteForPrefix(prefix, (r) => r.status === "implementing");
    },
    handler: async (args, ctx) => {
      if (!args || !args.trim()) {
        ctx.ui.notify("Usage: /req done <id>", "warning");
        return;
      }

      const id = args.trim();
      const content = await readRequestFile(ctx.cwd, id);
      
      if (!content) {
        ctx.ui.notify(`Request not found: ${id}`, "error");
        return;
      }

      // Update status to done
      const updated = content.replace(/^status:.*$/m, "status: done");
      await writeRequestFile(ctx.cwd, id, updated);

      // Update log if exists
      const logContent = await readLogFile(ctx.cwd, id);
      if (logContent) {
        const completedLog = logContent.replace(
          /## Progress/,
          `## Progress\n\n- [x] Implementation complete!`
        ).replace(
          /### Checkpoint 1:/,
          `### Completed: ${new Date().toISOString()}\n\n### Checkpoint 1:`
        );
        await writeLogFile(ctx.cwd, id, completedLog);
      }

      ctx.ui.notify(`Request marked as done: ${id}`, "info");
    },
  });

  // === Main /req command router ===
  pi.registerCommand("req", {
    description: "Request workflow manager",
    handler: async (args, ctx) => {
      const parts = args?.trim().split(/\s+/) || [];
      const subcommand = parts[0]?.toLowerCase();
      const subargs = parts.slice(1).join(" ");

      if (!subcommand) {
        ctx.ui.notify(
          "Usage:\n" +
          "/req log \"title\"    - Create new request\n" +
          "/req list           - List all requests\n" +
          "/req analyze <id>   - Analyze with grill-me\n" +
          "/req plan <id>     - Create plan with prd-to-plan\n" +
          "/req impl <id>      - Start implementation\n" +
          "/req status <id>   - Show request status\n" +
          "/req done <id>      - Mark as done",
          "info"
        );
        return;
      }

      switch (subcommand) {
        case "log":
          if (!subargs) {
            ctx.ui.notify("Usage: /req log \"your idea title\"", "warning");
            return;
          }
          const title = subargs.trim();
          const newId = await createRequest(ctx.cwd, title);
          ctx.ui.notify(`Created: ${newId}`, "info");
          break;

        case "list":
          const allRequests = await listRequests(ctx.cwd);
          if (allRequests.length === 0) {
            ctx.ui.notify("No requests yet.", "info");
            return;
          }
          const reqLines = allRequests.map((r) => 
            `${formatStatus(r.status)} ${r.id} - ${r.title}`
          );
          pi.sendMessage({
            customType: "req-list",
            content: reqLines.join("\n"),
            display: true,
          }, { deliverAs: "steer" });
          break;

        case "analyze":
          if (!subargs) {
            ctx.ui.notify("Usage: /req analyze <id>", "warning");
            return;
          }
          pi.sendUserMessage(`/req-analyze ${subargs}`, { deliverAs: "followUp" });
          break;

        case "plan":
          if (!subargs) {
            ctx.ui.notify("Usage: /req plan <id>", "warning");
            return;
          }
          pi.sendUserMessage(`/req-plan ${subargs}`, { deliverAs: "followUp" });
          break;

        case "impl":
          if (!subargs) {
            ctx.ui.notify("Usage: /req impl <id>", "warning");
            return;
          }
          pi.sendUserMessage(`/req-impl ${subargs}`, { deliverAs: "followUp" });
          break;

        case "status":
          if (!subargs) {
            ctx.ui.notify("Usage: /req status <id>", "warning");
            return;
          }
          pi.sendUserMessage(`/req-status ${subargs}`, { deliverAs: "followUp" });
          break;

        case "done":
          if (!subargs) {
            ctx.ui.notify("Usage: /req done <id>", "warning");
            return;
          }
          pi.sendUserMessage(`/req-done ${subargs}`, { deliverAs: "followUp" });
          break;

        default:
          ctx.ui.notify(`Unknown subcommand: ${subcommand}`, "error");
      }
    },
  });
}
