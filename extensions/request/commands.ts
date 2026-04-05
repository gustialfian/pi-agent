/**
 * Request extension - Command handlers
 * Register commands with pi extension
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import {
  createRequest,
  formatStatus,
  getAutocompleteForPrefix,
  handleAnalyze,
  handleDone,
  handleImpl,
  handlePlan,
  handleStatus,
  listRequests,
  type RequestMetadata,
} from "./lib";

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
      getAutocompleteForPrefix(prefix, () => true),
    handler: async (args, ctx) => {
      if (!args?.trim()) {
        ctx.ui.notify("Usage: /req analyze <id>", "warning");
        return;
      }
      await handleAnalyze(ctx, args.trim(), (msg, opts) => pi.sendUserMessage(msg, opts));
    },
  });
}

// === Command: /req plan ===
export function registerReqPlan(pi: ExtensionAPI): void {
  pi.registerCommand("req-plan", {
    description: "Create implementation plan for a request: /req plan <id>",
    getArgumentCompletions: async (prefix: string) =>
      getAutocompleteForPrefix(prefix, (r) => ["idea", "analyzing", "planned"].includes(r.status)),
    handler: async (args, ctx) => {
      if (!args?.trim()) {
        ctx.ui.notify("Usage: /req plan <id>", "warning");
        return;
      }
      await handlePlan(ctx, args.trim(), (msg, opts) => pi.sendUserMessage(msg, opts));
    },
  });
}

// === Command: /req impl ===
export function registerReqImpl(pi: ExtensionAPI): void {
  pi.registerCommand("req-impl", {
    description: "Start implementation for a request: /req impl <id>",
    getArgumentCompletions: async (prefix: string) =>
      getAutocompleteForPrefix(prefix, (r) => r.status === "planned"),
    handler: async (args, ctx) => {
      if (!args?.trim()) {
        ctx.ui.notify("Usage: /req impl <id>", "warning");
        return;
      }
      await handleImpl(ctx, args.trim(), (msg, opts) => pi.sendUserMessage(msg, opts));
    },
  });
}

// === Command: /req status ===
export function registerReqStatus(pi: ExtensionAPI): void {
  pi.registerCommand("req-status", {
    description: "Show status of a request: /req status <id>",
    getArgumentCompletions: async (prefix: string) =>
      getAutocompleteForPrefix(prefix, () => true),
    handler: async (args, ctx) => {
      const id = args?.trim();
      if (!id) {
        ctx.ui.notify("Usage: /req status <id>", "warning");
        return;
      }
      await handleStatus(ctx, id, (msg) => pi.sendMessage(msg));
    },
  });
}

// === Command: /req done ===
export function registerReqDone(pi: ExtensionAPI): void {
  pi.registerCommand("req-done", {
    description: "Mark a request as done: /req done <id>",
    getArgumentCompletions: async (prefix: string) =>
      getAutocompleteForPrefix(prefix, (r) => r.status === "implementing"),
    handler: async (args, ctx) => {
      if (!args?.trim()) {
        ctx.ui.notify("Usage: /req done <id>", "warning");
        return;
      }
      await handleDone(ctx, args.trim());
    },
  });
}

// === Command: /req (router) ===
export function registerReq(pi: ExtensionAPI): void {
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

// === Register all commands ===
export function registerCommands(pi: ExtensionAPI): void {
  registerReqLog(pi);
  registerReqList(pi);
  registerReqAnalyze(pi);
  registerReqPlan(pi);
  registerReqImpl(pi);
  registerReqStatus(pi);
  registerReqDone(pi);
  registerReq(pi);
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
