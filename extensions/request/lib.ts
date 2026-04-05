/**
 * Request extension - Core library
 * All business logic, types, and helper functions
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import {
  formatRequestTemplate,
} from "./templates";

// === Constants ===
export const REQUEST_DIR = ".pi/request";
export const SESSION_TYPE = "req-session";

export const REQUEST_FILE = "request.md";
export const INTERVIEW_FILE = "interview.md";
export const PRD_FILE = "prd.md";
export const PLAN_FILE = "plan.md";
export const LOG_FILE = "log.md";

export const SKILL_GRILL_ME = "/home/alfian/.pi/agent/skills/grill-me/SKILL.md";
export const SKILL_PRD_TO_PLAN = "/home/alfian/.pi/agent/skills/prd-to-plan/SKILL.md";

// === Session persistence ===
export function saveSessionCwd(pi: ExtensionAPI, cwd: string): void {
  pi.appendEntry(SESSION_TYPE, { cwd });
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
  cwd: string,
  prefix: string,
  filterFn: (r: RequestMetadata) => boolean
): Promise<AutocompleteItem[]> {
  const requests = await listRequests(cwd);
  return requests
    .filter((r) => r.id.startsWith(prefix))
    .filter(filterFn)
    .map((r) => ({ value: r.id, label: `${r.id} - ${r.title}` }));
}
