/**
 * Request extension - Command handlers
 * Register commands with pi extension
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import {
  createRequest,
  formatStatus,
  getAutocompleteForPrefix,
  listRequests,
  parseRequestMetadata,
  readRequestFile,
  writeRequestFile,
  REQUEST_DIR,
  REQUEST_FILE,
  INTERVIEW_FILE,
  LOG_FILE,
  PLAN_FILE,
  SKILL_GRILL_ME,
  SKILL_PRD_TO_PLAN,
  saveSessionCwd,
  type RequestMetadata,
} from "./lib";

import {
  formatInterviewTemplate,
  formatLogTemplate,
  formatAnalyzeMessage,
  formatPlanMessage,
  formatImplMessage,
  renderStatusTemplate,
  type StatusContext,
} from "./templates";

// === Helper to format request list ===
function formatRequestList(requests: RequestMetadata[]): string {
  return requests.map((r) => `${formatStatus(r.status)} ${r.id} - ${r.title}`).join("\n");
}

// === Command: /req log ===
export function registerReqLog(pi: ExtensionAPI): void {
  pi.registerCommand("req-log", {
    description: "Log a new request/idea: /req log \"your idea\"",
    getArgumentCompletions: () => null,
    handler: async (args, ctx) => {
      saveSessionCwd(pi, ctx.cwd);
      if (!args?.trim()) {
        ctx.ui.notify("Usage: /req log \"your idea title\"", "warning");
        return;
      }
      const id = await createRequest(ctx.cwd, args.trim());
      ctx.ui.notify(`Created request: ${id}`, "info");
    },
  });
}

// === Command: /req list ===
export function registerReqList(pi: ExtensionAPI): void {
  pi.registerCommand("req-list", {
    description: "List all requests",
    handler: async (_args, ctx) => {
      saveSessionCwd(pi, ctx.cwd);
      const requests = await listRequests(ctx.cwd);
      if (requests.length === 0) {
        ctx.ui.notify("No requests yet. Use /req log \"title\" to create one.", "info");
        return;
      }
      pi.sendMessage({
        customType: "req-list",
        content: formatRequestList(requests),
        display: true,
      }, { deliverAs: "steer" });
    },
  });
}

// === Command: /req analyze ===
export function registerReqAnalyze(pi: ExtensionAPI): void {
  pi.registerCommand("req-analyze", {
    description: "Analyze/refine a request using grill-me: /req analyze <id>",
    getArgumentCompletions: async (prefix: string) =>
      getAutocompleteForPrefix(process.cwd(), prefix, () => true),
    handler: async (args, ctx) => {
      saveSessionCwd(pi, ctx.cwd);
      if (!args?.trim()) {
        ctx.ui.notify("Usage: /req analyze <id>", "warning");
        return;
      }

      const id = args.trim();
      const content = await readRequestFile(ctx.cwd, id, REQUEST_FILE);
      if (!content) {
        ctx.ui.notify(`Request not found: ${id}`, "error");
        return;
      }

      const updated = content.replace(/^status:.*$/m, "status: analyzing");
      await writeRequestFile(ctx.cwd, id, REQUEST_FILE, updated);

      const interviewContent = formatInterviewTemplate({ id });
      await writeRequestFile(ctx.cwd, id, INTERVIEW_FILE, interviewContent);

      ctx.ui.notify(`Starting analysis session for: ${id}`, "info");
      await ctx.waitForIdle();

      const message = formatAnalyzeMessage({
        skillPath: SKILL_GRILL_ME,
        id,
        content,
        requestDir: REQUEST_DIR,
      });

      pi.sendUserMessage(message, { deliverAs: "steer" });
    },
  });
}

// === Command: /req plan ===
export function registerReqPlan(pi: ExtensionAPI): void {
  pi.registerCommand("req-plan", {
    description: "Create implementation plan for a request: /req plan <id>",
    getArgumentCompletions: async (prefix: string) =>
      getAutocompleteForPrefix(process.cwd(), prefix, (r) => ["idea", "analyzing", "planned"].includes(r.status)),
    handler: async (args, ctx) => {
      saveSessionCwd(pi, ctx.cwd);
      if (!args?.trim()) {
        ctx.ui.notify("Usage: /req plan <id>", "warning");
        return;
      }

      const id = args.trim();
      const requestContent = await readRequestFile(ctx.cwd, id, REQUEST_FILE);
      const interviewContent = await readRequestFile(ctx.cwd, id, INTERVIEW_FILE);

      if (!requestContent) {
        ctx.ui.notify(`Request not found: ${id}`, "error");
        return;
      }

      const updated = requestContent.replace(/^status:.*$/m, "status: planned");
      await writeRequestFile(ctx.cwd, id, REQUEST_FILE, updated);

      ctx.ui.notify(`Starting planning session for: ${id}`, "info");
      await ctx.waitForIdle();

      const message = formatPlanMessage({
        skillPath: SKILL_PRD_TO_PLAN,
        id,
        requestContent,
        interviewContent: interviewContent ?? undefined,
        requestDir: REQUEST_DIR,
      });

      pi.sendUserMessage(message, { deliverAs: "steer" });
    },
  });
}

// === Command: /req impl ===
export function registerReqImpl(pi: ExtensionAPI): void {
  pi.registerCommand("req-impl", {
    description: "Start implementation for a request: /req impl <id>",
    getArgumentCompletions: async (prefix: string) =>
      getAutocompleteForPrefix(process.cwd(), prefix, (r) => r.status === "planned"),
    handler: async (args, ctx) => {
      saveSessionCwd(pi, ctx.cwd);
      if (!args?.trim()) {
        ctx.ui.notify("Usage: /req impl <id>", "warning");
        return;
      }

      const id = args.trim();
      const requestContent = await readRequestFile(ctx.cwd, id, REQUEST_FILE);
      const prdContent = await readRequestFile(ctx.cwd, id, "prd.md");
      const interviewContent = await readRequestFile(ctx.cwd, id, INTERVIEW_FILE);
      const planContent = await readRequestFile(ctx.cwd, id, PLAN_FILE);

      if (!requestContent) {
        ctx.ui.notify(`Request not found: ${id}`, "error");
        return;
      }

      if (!planContent) {
        ctx.ui.notify(`No plan found for ${id}. Run /req plan ${id} first.`, "error");
        return;
      }

      const logContent = formatLogTemplate({ id, requestDir: REQUEST_DIR });
      await writeRequestFile(ctx.cwd, id, LOG_FILE, logContent);

      const updated = requestContent.replace(/^status:.*$/m, "status: implementing");
      await writeRequestFile(ctx.cwd, id, REQUEST_FILE, updated);

      ctx.ui.notify(`Starting implementation for: ${id}`, "info");
      await ctx.waitForIdle();

      const message = formatImplMessage({
        id,
        requestContent,
        prdContent: prdContent ?? undefined,
        interviewContent: interviewContent ?? undefined,
        planContent,
        requestDir: REQUEST_DIR,
      });

      pi.sendUserMessage(message, { deliverAs: "steer" });
    },
  });
}

// === Command: /req status ===
export function registerReqStatus(pi: ExtensionAPI): void {
  pi.registerCommand("req-status", {
    description: "Show status of a request: /req status <id>",
    getArgumentCompletions: async (prefix: string) =>
      getAutocompleteForPrefix(process.cwd(), prefix, () => true),
    handler: async (args, ctx) => {
      saveSessionCwd(pi, ctx.cwd);
      const id = args?.trim();
      if (!id) {
        ctx.ui.notify("Usage: /req status <id>", "warning");
        return;
      }

      const requestContent = await readRequestFile(ctx.cwd, id, REQUEST_FILE);
      const planContent = await readRequestFile(ctx.cwd, id, PLAN_FILE);
      const logContent = await readRequestFile(ctx.cwd, id, LOG_FILE);
      const interviewContent = await readRequestFile(ctx.cwd, id, INTERVIEW_FILE);

      if (!requestContent) {
        ctx.ui.notify(`Request not found: ${id}`, "error");
        return;
      }

      const meta = await parseRequestMetadata(ctx.cwd, id);
      const prdContent = await readRequestFile(ctx.cwd, id, "prd.md");

      const statusContext: StatusContext = {
        id,
        title: meta?.title || "Unknown",
        created: meta?.timestamp ? new Date(meta.timestamp).toISOString() : "Unknown",
        statusIcon: formatStatus(meta?.status || "idea").split(" ")[0],
        status: meta?.status || "idea",
        requestDir: REQUEST_DIR,
        prdExists: !!prdContent,
        prdMissing: !prdContent,
        interviewExists: !!interviewContent,
        interviewMissing: !interviewContent,
        planExists: !!planContent,
        planMissing: !planContent,
        logExists: !!logContent,
        logMissing: !logContent,
      };

      const summary = renderStatusTemplate(statusContext);
      pi.sendMessage({ customType: "req-status", content: summary, display: true });
    },
  });
}

// === Command: /req done ===
export function registerReqDone(pi: ExtensionAPI): void {
  pi.registerCommand("req-done", {
    description: "Mark a request as done: /req done <id>",
    getArgumentCompletions: async (prefix: string) =>
      getAutocompleteForPrefix(process.cwd(), prefix, (r) => r.status === "implementing"),
    handler: async (args, ctx) => {
      saveSessionCwd(pi, ctx.cwd);
      if (!args?.trim()) {
        ctx.ui.notify("Usage: /req done <id>", "warning");
        return;
      }

      const id = args.trim();
      const content = await readRequestFile(ctx.cwd, id, REQUEST_FILE);
      if (!content) {
        ctx.ui.notify(`Request not found: ${id}`, "error");
        return;
      }

      const updated = content.replace(/^status:.*$/m, "status: done");
      await writeRequestFile(ctx.cwd, id, REQUEST_FILE, updated);

      const logContent = await readRequestFile(ctx.cwd, id, LOG_FILE);
      if (logContent) {
        const completedLog = logContent
          .replace(/## Progress/, `## Progress\n\n- [x] Implementation complete!`)
          .replace(/### Checkpoint 1:/, `### Completed: ${new Date().toISOString()}\n\n### Checkpoint 1:`);
        await writeRequestFile(ctx.cwd, id, LOG_FILE, completedLog);
      }

      ctx.ui.notify(`Request marked as done: ${id}`, "info");
    },
  });
}

// === Command: /req (router) ===
export function registerReq(pi: ExtensionAPI): void {
  pi.registerCommand("req", {
    description: "Request workflow manager",
    handler: async (args, ctx) => {
      saveSessionCwd(pi, ctx.cwd);
      const parts = args?.trim().split(/\s+/) || [];
      const subcommand = parts[0]?.toLowerCase();
      const subargs = parts.slice(1).join(" ");

      if (!subcommand) {
        ctx.ui.notify(
          "Usage:\n" +
          "/req log \"title\"    - Create new request\n" +
          "/req list           - List all requests\n" +
          "/req analyze <id>   - Analyze with grill-me\n" +
          "/req plan <id>      - Create plan with prd-to-plan\n" +
          "/req impl <id>      - Start implementation\n" +
          "/req status <id>    - Show request status\n" +
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
          const id = await createRequest(ctx.cwd, subargs.trim());
          ctx.ui.notify(`Created: ${id}`, "info");
          break;

        case "list": {
          const requests = await listRequests(ctx.cwd);
          if (requests.length === 0) {
            ctx.ui.notify("No requests yet.", "info");
            return;
          }
          pi.sendMessage({
            customType: "req-list",
            content: formatRequestList(requests),
            display: true,
          }, { deliverAs: "steer" });
          break;
        }

        case "analyze":
        case "plan":
        case "impl":
        case "status":
        case "done":
          pi.sendUserMessage(`/req-${subcommand} ${subargs}`, { deliverAs: "followUp" });
          break;

        default:
          ctx.ui.notify(`Unknown subcommand: ${subcommand}`, "error");
      }
    },
  });
}

// === Register message renderer ===
export function registerMessageRenderer(pi: ExtensionAPI): void {
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
}
