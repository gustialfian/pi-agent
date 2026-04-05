import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import {
  setSessionCwd,
  listRequests,
  createRequest,
  formatStatus,
  getAutocompleteForPrefix,
  REQUEST_FILE,
  REQUEST_DIR,
  handleAnalyze,
  handlePlan,
  handleImpl,
  handleStatus,
  handleDone,
} from "./lib";

export default function (pi: ExtensionAPI) {
  // Set session cwd on startup
  pi.on("session_start", async (_event, ctx) => {
    setSessionCwd(ctx.cwd);
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

      await handleAnalyze(ctx, args.trim(), (msg, opts) => pi.sendUserMessage(msg, opts));
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

      await handlePlan(ctx, args.trim(), (msg, opts) => pi.sendUserMessage(msg, opts));
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

      await handleImpl(ctx, args.trim(), (msg, opts) => pi.sendUserMessage(msg, opts));
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

      await handleStatus(ctx, id, (msg) => pi.sendMessage(msg));
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

      await handleDone(ctx, args.trim());
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
          const newId = await createRequest(ctx.cwd, subargs.trim());
          ctx.ui.notify(`Created: ${newId}`, "info");
          break;

        case "list": {
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
