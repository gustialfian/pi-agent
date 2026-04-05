/**
 * Request extension - Core library
 * All business logic, types, and helper functions
 */

import type { ExtensionCommandContext } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import {
  formatRequestTemplate,
  formatInterviewTemplate,
  formatLogTemplate,
  formatAnalyzeMessage,
  formatPlanMessage,
  formatImplMessage,
  renderStatusTemplate,
  type StatusContext,
} from "./templates";

// === Constants ===
export const REQUEST_DIR = ".pi/request";

export const REQUEST_FILE = "request.md";
export const INTERVIEW_FILE = "interview.md";
export const PRD_FILE = "prd.md";
export const PLAN_FILE = "plan.md";
export const LOG_FILE = "log.md";

export const SKILL_GRILL_ME = "/home/alfian/.pi/agent/skills/grill-me/SKILL.md";
export const SKILL_PRD_TO_PLAN = "/home/alfian/.pi/agent/skills/prd-to-plan/SKILL.md";

// === Session state ===
let sessionCwd = "";

export function setSessionCwd(cwd: string): void {
  sessionCwd = cwd;
}

// === ID helpers ===
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

export function generateId(timestamp: number, slug: string): string {
  return `${timestamp}-${slug}`;
}

export function parseId(id: string): { timestamp: number; slug: string } | null {
  const match = id.match(/^(\d+)-(.+)$/);
  if (!match) return null;
  return { timestamp: Number(match[1]), slug: match[2] };
}

// === File path helpers ===
export function getRequestDir(cwd: string, id: string): string {
  return join(cwd, REQUEST_DIR, id);
}

export function getRequestPath(cwd: string, id: string, filename: string): string {
  return join(getRequestDir(cwd, id), filename);
}

export async function ensureRequestDir(cwd: string, id: string): Promise<string> {
  const dir = getRequestDir(cwd, id);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
  return dir;
}

export async function getRequestDirs(cwd: string): Promise<string[]> {
  const dir = join(cwd, REQUEST_DIR);
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir);
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

// === File I/O ===
export async function readRequestFile(cwd: string, id: string, filename: string): Promise<string | null> {
  const file = getRequestPath(cwd, id, filename);
  if (!existsSync(file)) return null;
  return readFile(file, "utf-8");
}

export async function writeRequestFile(cwd: string, id: string, filename: string, content: string): Promise<void> {
  const file = getRequestPath(cwd, id, filename);
  await writeFile(file, content, "utf-8");
}

// === Types ===
export type RequestStatus = "idea" | "analyzing" | "planned" | "implementing" | "done";

export interface RequestMetadata {
  id: string;
  title: string;
  timestamp: number;
  status: RequestStatus;
}

// === Metadata parsing ===
export async function parseRequestMetadata(cwd: string, id: string): Promise<RequestMetadata | null> {
  const content = await readRequestFile(cwd, id, REQUEST_FILE);
  if (!content) return null;

  const parsed = parseId(id);
  if (!parsed) return null;

  let title = parsed.slug.replace(/-/g, " ");
  const titleMatch = content.match(/^#\s+(.+)$/m);
  if (titleMatch) {
    title = titleMatch[1].trim();
  }

  let status: RequestStatus = "idea";
  const statusMatch = content.match(/^status:\s*(.+)$/m);
  if (statusMatch) {
    const s = statusMatch[1].trim().toLowerCase();
    if (["idea", "analyzing", "planned", "implementing", "done"].includes(s)) {
      status = s as RequestStatus;
    }
  }

  return { id, title, timestamp: parsed.timestamp, status };
}

export async function listRequests(cwd: string): Promise<RequestMetadata[]> {
  const dirs = await getRequestDirs(cwd);
  const requests: RequestMetadata[] = [];
  
  for (const id of dirs) {
    const meta = await parseRequestMetadata(cwd, id);
    if (meta) requests.push(meta);
  }
  
  return requests;
}

// === Request operations ===
export async function createRequest(cwd: string, title: string): Promise<string> {
  const timestamp = Date.now();
  const slug = slugify(title);
  const id = generateId(timestamp, slug);
  
  await ensureRequestDir(cwd, id);
  
  const content = formatRequestTemplate({ id, title });
  await writeRequestFile(cwd, id, REQUEST_FILE, content);
  return id;
}

export function formatStatus(status: RequestStatus): string {
  const icons: Record<string, string> = {
    idea: "💡",
    analyzing: "🔍",
    planned: "📋",
    implementing: "🔨",
    done: "✅",
  };
  return `${icons[status] || "📝"} ${status}`;
}

// === Autocomplete ===
export async function getAutocompleteForPrefix(
  prefix: string,
  filterFn: (r: RequestMetadata) => boolean
): Promise<AutocompleteItem[]> {
  const cwd = sessionCwd || process.cwd();
  const requests = await listRequests(cwd);
  return requests
    .filter((r) => r.id.startsWith(prefix))
    .filter(filterFn)
    .map((r) => ({ value: r.id, label: `${r.id} - ${r.title}` }));
}

// === Command handlers ===
export async function handleAnalyze(
  ctx: ExtensionCommandContext,
  id: string,
  sendUserMessage: (msg: string, opts: { deliverAs?: "steer" | "followUp" }) => void
): Promise<void> {
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
  
  sendUserMessage(message, { deliverAs: "steer" });
}

export async function handlePlan(
  ctx: ExtensionCommandContext,
  id: string,
  sendUserMessage: (msg: string, opts: { deliverAs?: "steer" | "followUp" }) => void
): Promise<void> {
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
  
  sendUserMessage(message, { deliverAs: "steer" });
}

export async function handleImpl(
  ctx: ExtensionCommandContext,
  id: string,
  sendUserMessage: (msg: string, opts: { deliverAs?: "steer" | "followUp" }) => void
): Promise<void> {
  const requestContent = await readRequestFile(ctx.cwd, id, REQUEST_FILE);
  const prdContent = await readRequestFile(ctx.cwd, id, PRD_FILE);
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
  
  sendUserMessage(message, { deliverAs: "steer" });
}

export async function handleStatus(
  ctx: ExtensionCommandContext,
  id: string,
  sendMessage: (msg: { customType: string; content: string; display: boolean }) => void
): Promise<void> {
  const requestContent = await readRequestFile(ctx.cwd, id, REQUEST_FILE);
  const planContent = await readRequestFile(ctx.cwd, id, PLAN_FILE);
  const logContent = await readRequestFile(ctx.cwd, id, LOG_FILE);
  const interviewContent = await readRequestFile(ctx.cwd, id, INTERVIEW_FILE);

  if (!requestContent) {
    ctx.ui.notify(`Request not found: ${id}`, "error");
    return;
  }

  const meta = await parseRequestMetadata(ctx.cwd, id);
  const prdContent = await readRequestFile(ctx.cwd, id, PRD_FILE);
  
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
  sendMessage({ customType: "req-status", content: summary, display: true });
}

export async function handleDone(
  ctx: ExtensionCommandContext,
  id: string
): Promise<void> {
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
}
