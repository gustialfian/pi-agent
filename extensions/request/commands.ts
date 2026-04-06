/**
 * Request extension - Command handlers
 * All subcommands under /req
 */

import type { ExtensionAPI, ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import {
  INTERVIEW_FILE,
  LOG_FILE,
  PLAN_FILE,
  REQUEST_DIR,
  REQUEST_FILE,
  SKILL_GRILL_ME,
  SKILL_PRD_TO_PLAN,
  createRequest,
  formatStatus,
  getAutocompleteForPrefix,
  getCachedCwd,
  listRequests,
  parseRequestMetadata,
  readRequestFile,
  saveSessionCwd,
  writeRequestFile,
  type RequestMetadata,
} from "./lib";
import {
  formatAnalyzeMessage,
  formatImplMessage,
  formatInterviewTemplate,
  formatLogTemplate,
  formatPlanMessage,
  formatPlanTemplate,
  formatPrdTemplate,
  renderStatusTemplate,
  type StatusContext,
} from "./templates";

// === Subcommand definitions ===
const SUBCOMMANDS = [
  { name: "log", description: "Create new request", usage: '/req log "title"', needsId: false },
  { name: "list", description: "List all requests", usage: "/req list", needsId: false },
  { name: "analyze", description: "Analyze with grill-me", usage: "/req analyze <id>", needsId: true },
  { name: "plan", description: "Create plan with prd-to-plan", usage: "/req plan <id>", needsId: true },
  { name: "impl", description: "Start implementation", usage: "/req impl <id>", needsId: true },
  { name: "status", description: "Show request status", usage: "/req status <id>", needsId: true },
  { name: "done", description: "Mark as done", usage: "/req done <id>", needsId: true },
];

// === Helper to format request list ===
function formatRequestList(requests: RequestMetadata[]): string {
  return requests.map((r) => `${formatStatus(r.status)} ${r.id} - ${r.title}`).join("\n");
}

// === Main command: /req ===
export function registerReq(pi: ExtensionAPI): void {
  pi.registerCommand("req", {
    description: "Request workflow manager",
    getArgumentCompletions: async (argumentPrefix: string) => {
      // argumentPrefix is everything after "/req "
      // It may or may not include trailing space
      const trimmed = argumentPrefix.trimEnd();
      const parts = trimmed.split(/\s+/).filter(Boolean);
      const subcommand = parts[0]?.toLowerCase();
      const subargs = parts.slice(1).join(" ");

      // No subcommand yet - suggest subcommands
      if (!subcommand) {
        return SUBCOMMANDS.map((sc) => ({
          value: sc.name,
          label: sc.name,
          description: sc.description,
        }));
      }

      // Partial subcommand match (typing "/req an" should suggest "analyze")
      if (parts.length === 1) {
        const matchingCommands = SUBCOMMANDS.filter((sc) =>
          sc.name.startsWith(subcommand)
        );
        if (matchingCommands.length > 0) {
          return matchingCommands.map((sc) => ({
            value: sc.name,
            label: sc.name,
            description: sc.description,
          }));
        }
        // Subcommand fully typed - now provide ID completions
        if (SUBCOMMANDS.some((sc) => sc.name === subcommand)) {
          const filterFn = getFilterForSubcommand(subcommand);
          return getAutocompleteForPrefix(getCachedCwd(), subargs, filterFn);
        }
      }

      // Has subcommand and possibly partial ID
      if (parts.length >= 1 && SUBCOMMANDS.some((sc) => sc.name === subcommand)) {
        const filterFn = getFilterForSubcommand(subcommand);
        return getAutocompleteForPrefix(getCachedCwd(), subargs, filterFn);
      }

      return null;
    },
    handler: async (args, ctx) => {
      saveSessionCwd(pi, ctx.cwd);
      const parts = args?.trim().split(/\s+/) || [];
      const subcommand = parts[0]?.toLowerCase();
      const subargs = parts.slice(1).join(" ");

      if (!subcommand) {
        ctx.ui.notify(
          "Usage:\n" +
          SUBCOMMANDS.map((sc) => `${sc.usage} - ${sc.description}`).join("\n"),
          "info"
        );
        return;
      }

      switch (subcommand) {
        case "log":
          if (!subargs) {
            ctx.ui.notify('Usage: /req log "your idea title"', "warning");
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
          await handleAnalyze(pi, ctx, subargs);
          break;

        case "plan":
          await handlePlan(pi, ctx, subargs);
          break;

        case "impl":
          await handleImpl(pi, ctx, subargs);
          break;

        case "status":
          await handleStatus(pi, ctx, subargs);
          break;

        case "done":
          await handleDone(pi, ctx, subargs);
          break;

        default:
          ctx.ui.notify(`Unknown subcommand: ${subcommand}`, "error");
      }
    },
  });
}

// === Filter functions for autocomplete ===
function getFilterForSubcommand(subcommand: string): (r: RequestMetadata) => boolean {
  switch (subcommand) {
    case "plan":
      return (r) => ["idea", "analyzing", "planned"].includes(r.status);
    case "impl":
      return (r) => r.status === "planned";
    case "done":
      return (r) => r.status === "implementing";
    default:
      return () => true;
  }
}

// === Handler: analyze ===
async function handleAnalyze(pi: ExtensionAPI, ctx: ExtensionCommandContext, id: string): Promise<void> {
  if (!id?.trim()) {
    ctx.ui.notify("Usage: /req analyze <id>", "warning");
    return;
  }

  const content = await readRequestFile(ctx.cwd, id.trim(), REQUEST_FILE);
  if (!content) {
    ctx.ui.notify(`Request not found: ${id}`, "error");
    return;
  }

  // Update status to analyzing
  const updated = content.replace(/^status:.*$/m, "status: analyzing");
  await writeRequestFile(ctx.cwd, id.trim(), REQUEST_FILE, updated);

  // Create template files
  const interviewContent = formatInterviewTemplate({ id: id.trim() });
  await writeRequestFile(ctx.cwd, id.trim(), INTERVIEW_FILE, interviewContent);

  const prdContent = formatPrdTemplate({ id: id.trim() });
  await writeRequestFile(ctx.cwd, id.trim(), "prd.md", prdContent);

  ctx.ui.notify(`Starting analysis session for: ${id}`, "info");
  await ctx.waitForIdle();

  const message = formatAnalyzeMessage({
    skillPath: SKILL_GRILL_ME,
    id: id.trim(),
    content,
    requestDir: REQUEST_DIR,
  });

  pi.sendUserMessage(message, { deliverAs: "steer" });
}

// === Handler: plan ===
async function handlePlan(pi: ExtensionAPI, ctx: ExtensionCommandContext, id: string): Promise<void> {
  if (!id?.trim()) {
    ctx.ui.notify("Usage: /req plan <id>", "warning");
    return;
  }

  const requestContent = await readRequestFile(ctx.cwd, id.trim(), REQUEST_FILE);
  const interviewContent = await readRequestFile(ctx.cwd, id.trim(), INTERVIEW_FILE);
  const prdContent = await readRequestFile(ctx.cwd, id.trim(), "prd.md");

  if (!requestContent) {
    ctx.ui.notify(`Request not found: ${id}`, "error");
    return;
  }

  if (!prdContent || prdContent.trim().length < 100) {
    ctx.ui.notify(
      `PRD not ready for ${id}. Fill in prd.md first or run /req analyze.`,
      "error"
    );
    return;
  }

  const meta = await parseRequestMetadata(ctx.cwd, id.trim());

  // Update status to planned
  const updated = requestContent.replace(/^status:.*$/m, "status: planned");
  await writeRequestFile(ctx.cwd, id.trim(), REQUEST_FILE, updated);

  // Create plan template
  const planContent = formatPlanTemplate({ id: id.trim(), title: meta?.title });
  await writeRequestFile(ctx.cwd, id.trim(), PLAN_FILE, planContent);

  ctx.ui.notify(`Starting planning session for: ${id}`, "info");
  await ctx.waitForIdle();

  const message = formatPlanMessage({
    skillPath: SKILL_PRD_TO_PLAN,
    id: id.trim(),
    requestContent,
    prdContent,
    interviewContent: interviewContent ?? undefined,
    requestDir: REQUEST_DIR,
  });

  pi.sendUserMessage(message, { deliverAs: "steer" });
}

// === Handler: impl ===
async function handleImpl(pi: ExtensionAPI, ctx: ExtensionCommandContext, id: string): Promise<void> {
  if (!id?.trim()) {
    ctx.ui.notify("Usage: /req impl <id>", "warning");
    return;
  }

  const requestContent = await readRequestFile(ctx.cwd, id.trim(), REQUEST_FILE);
  const prdContent = await readRequestFile(ctx.cwd, id.trim(), "prd.md");
  const interviewContent = await readRequestFile(ctx.cwd, id.trim(), INTERVIEW_FILE);
  const planContent = await readRequestFile(ctx.cwd, id.trim(), PLAN_FILE);

  if (!requestContent) {
    ctx.ui.notify(`Request not found: ${id}`, "error");
    return;
  }

  if (!planContent) {
    ctx.ui.notify(`No plan found for ${id}. Run /req plan ${id} first.`, "error");
    return;
  }

  const logContent = formatLogTemplate({ id: id.trim(), requestDir: REQUEST_DIR });
  await writeRequestFile(ctx.cwd, id.trim(), LOG_FILE, logContent);

  const updated = requestContent.replace(/^status:.*$/m, "status: implementing");
  await writeRequestFile(ctx.cwd, id.trim(), REQUEST_FILE, updated);

  ctx.ui.notify(`Starting implementation for: ${id}`, "info");
  await ctx.waitForIdle();

  const message = formatImplMessage({
    id: id.trim(),
    requestContent,
    prdContent: prdContent ?? undefined,
    interviewContent: interviewContent ?? undefined,
    planContent,
    requestDir: REQUEST_DIR,
  });

  pi.sendUserMessage(message, { deliverAs: "steer" });
}

// === Handler: status ===
async function handleStatus(pi: ExtensionAPI, ctx: ExtensionCommandContext, id: string): Promise<void> {
  if (!id?.trim()) {
    ctx.ui.notify("Usage: /req status <id>", "warning");
    return;
  }

  const requestContent = await readRequestFile(ctx.cwd, id.trim(), REQUEST_FILE);
  if (!requestContent) {
    ctx.ui.notify(`Request not found: ${id}`, "error");
    return;
  }

  const meta = await parseRequestMetadata(ctx.cwd, id.trim());
  const [planContent, logContent, interviewContent, prdContent] = await Promise.all([
    readRequestFile(ctx.cwd, id.trim(), PLAN_FILE),
    readRequestFile(ctx.cwd, id.trim(), LOG_FILE),
    readRequestFile(ctx.cwd, id.trim(), INTERVIEW_FILE),
    readRequestFile(ctx.cwd, id.trim(), "prd.md"),
  ]);

  const statusContext: StatusContext = {
    id: id.trim(),
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
}

// === Handler: done ===
async function handleDone(pi: ExtensionAPI, ctx: ExtensionCommandContext, id: string): Promise<void> {
  if (!id?.trim()) {
    ctx.ui.notify("Usage: /req done <id>", "warning");
    return;
  }

  const content = await readRequestFile(ctx.cwd, id.trim(), REQUEST_FILE);
  if (!content) {
    ctx.ui.notify(`Request not found: ${id}`, "error");
    return;
  }

  const updated = content.replace(/^status:.*$/m, "status: done");
  await writeRequestFile(ctx.cwd, id.trim(), REQUEST_FILE, updated);

  const logContent = await readRequestFile(ctx.cwd, id.trim(), LOG_FILE);
  if (logContent) {
    const completedLog = logContent
      .replace(/## Progress/, `## Progress\n\n- [x] Implementation complete!`)
      .replace(/### Checkpoint 1:/, `### Completed: ${new Date().toISOString()}\n\n### Checkpoint 1:`);
    await writeRequestFile(ctx.cwd, id.trim(), LOG_FILE, completedLog);
  }

  ctx.ui.notify(`Request marked as done: ${id}`, "info");
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
