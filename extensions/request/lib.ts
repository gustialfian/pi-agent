/**
 * Request extension - Core library
 * All business logic, types, and helper functions
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { AutocompleteItem } from "@mariozechner/pi-tui";
import { readdir, readFile, writeFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
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

// Resolve paths relative to the extension's location
export function getSkillPath(skillName: string): string {
  // Use environment variable or fall back to relative path from extension dir
  const basePath = process.env.PI_AGENT_PATH || join(homedir(), ".pi/agent");
  return join(basePath, "skills", skillName, "SKILL.md");
}

export const SKILL_GRILL_ME = getSkillPath("grill-me");
export const SKILL_PRD_TO_PLAN = getSkillPath("prd-to-plan");

// === Session persistence ===
let cachedCwd: string | null = null;

export async function saveSessionCwd(pi: ExtensionAPI, cwd: string): Promise<void> {
  cachedCwd = cwd;
  pi.appendEntry(SESSION_TYPE, { cwd });
}

export function getCachedCwd(): string {
  return cachedCwd || process.cwd();
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
  // Validate input: must be string with expected format
  if (typeof id !== "string" || !id.trim()) return null;
  
  const match = id.match(/^(\d+)-([a-z0-9-]+)$/);
  if (!match) return null;
  
  const timestamp = Number(match[1]);
  // Validate timestamp is a reasonable number (not NaN, not negative, not too far in future)
  if (!Number.isFinite(timestamp) || timestamp <= 0 || timestamp > Date.now() + 86400000) {
    return null;
  }
  
  const slug = match[2];
  // Validate slug length (should be <= 50 due to slugify limitation)
  if (slug.length > 50 || slug.length === 0) return null;
  
  return { timestamp, slug };
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
  
  // Parallel stat checks
  const results = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = join(dir, entry);
      const statResult = await stat(fullPath);
      return { entry, isDir: statResult.isDirectory() };
    })
  );
  
  for (const { entry, isDir } of results) {
    if (isDir) {
      dirs.push(entry);
    }
  }
  
  return dirs.sort().reverse();
}

// === File I/O ===
export async function readRequestFile(cwd: string, id: string, filename: string): Promise<string | null> {
  const file = getRequestPath(cwd, id, filename);
  // readFile handles missing files gracefully (throws if not exists)
  try {
    return await readFile(file, "utf-8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error; // Re-throw other errors (permissions, etc.)
  }
}

// Helper to read multiple request files in parallel
export async function readRequestFiles(cwd: string, id: string) {
  const trimmed = id.trim();
  const [request, prd, interview, plan, log] = await Promise.all([
    readRequestFile(cwd, trimmed, REQUEST_FILE),
    readRequestFile(cwd, trimmed, PRD_FILE),
    readRequestFile(cwd, trimmed, INTERVIEW_FILE),
    readRequestFile(cwd, trimmed, PLAN_FILE),
    readRequestFile(cwd, trimmed, LOG_FILE),
  ]);
  return { request, prd, interview, plan, log };
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
  
  // Parse all requests in parallel
  const results = await Promise.all(
    dirs.map((id) => parseRequestMetadata(cwd, id))
  );
  
  return results.filter((meta): meta is RequestMetadata => meta !== null);
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

// Simple fuzzy match - checks if all chars appear in order
function fuzzyMatch(text: string, pattern: string): boolean {
  const lowerText = text.toLowerCase();
  const lowerPattern = pattern.toLowerCase();
  let textIdx = 0;
  for (const char of lowerPattern) {
    const found = lowerText.indexOf(char, textIdx);
    if (found === -1) return false;
    textIdx = found + 1;
  }
  return true;
}

// Score for sorting: higher = more relevant
function getRelevanceScore(
  r: RequestMetadata,
  pattern: string,
  hasFiles: { prd: boolean; plan: boolean; log: boolean; interview: boolean }
): number {
  let score = 0;
  const lowerPattern = pattern.toLowerCase();

  // Exact ID prefix match gets highest priority
  if (r.id.startsWith(pattern)) score += 100;
  // Fuzzy ID match
  else if (fuzzyMatch(r.id, pattern)) score += 50;
  // Fuzzy title match
  else if (fuzzyMatch(r.title, pattern)) score += 30;
  // No pattern = neutral
  else score += 10;

  // Status progression priority (recent states first)
  const statusOrder: Record<RequestStatus, number> = {
    implementing: 5,
    analyzing: 4,
    planned: 3,
    idea: 2,
    done: 1,
  };
  score += statusOrder[r.status] * 10;

  // Files existing = more actionable
  if (hasFiles.prd) score += 5;
  if (hasFiles.plan) score += 3;
  if (hasFiles.log) score += 2;

  // Timestamp (newer = higher score)
  score += r.timestamp / 1e12;

  return score;
}

interface RequestFileFlags {
  prd: boolean;
  plan: boolean;
  log: boolean;
  interview: boolean;
}

async function getRequestFileFlags(
  cwd: string,
  id: string
): Promise<RequestFileFlags> {
  const [prd, plan, log, interview] = await Promise.all([
    readRequestFile(cwd, id, PRD_FILE),
    readRequestFile(cwd, id, PLAN_FILE),
    readRequestFile(cwd, id, LOG_FILE),
    readRequestFile(cwd, id, INTERVIEW_FILE),
  ]);
  return {
    prd: !!prd,
    plan: !!plan,
    log: !!log,
    interview: !!interview,
  };
}

export async function getAutocompleteForPrefix(
  cwd: string,
  filterFn: (r: RequestMetadata) => boolean,
  options: {
    /** Filter pattern for fuzzy matching against ID/title */
    filterPattern?: string;
    /** Prefix to prepend to the autocomplete value (e.g., "analyze ") */
    valuePrefix?: string;
  } = {}
): Promise<AutocompleteItem[]> {
  const { filterPattern = "", valuePrefix = "" } = options;
  const requests = await listRequests(cwd);

  // Filter by status filter + fuzzy match on ID or title
  const filtered = requests.filter((r) => {
    if (!filterFn(r)) return false;
    if (!filterPattern) return true;
    return (
      r.id.toLowerCase().includes(filterPattern.toLowerCase()) ||
      r.title.toLowerCase().includes(filterPattern.toLowerCase()) ||
      fuzzyMatch(r.id, filterPattern) ||
      fuzzyMatch(r.title, filterPattern)
    );
  });

  // Get file flags for all filtered requests in parallel
  const withFlags = await Promise.all(
    filtered.map(async (r) => ({
      ...r,
      files: await getRequestFileFlags(cwd, r.id),
    }))
  );

  // Sort by relevance
  withFlags.sort((a, b) => getRelevanceScore(b, filterPattern, b.files) - getRelevanceScore(a, filterPattern, a.files));

  return withFlags.map((r) => {
    const statusIcon = formatStatus(r.status).split(" ")[0];
    const flags = [
      r.files.prd ? "✓prd" : "✗prd",
      r.files.plan ? "✓plan" : "✗plan",
    ]
      .filter(Boolean)
      .join(" ");

    return {
      value: `${valuePrefix}${r.id}`,
      label: `${statusIcon} ${r.id} - ${r.title}`,
      description: flags || undefined,
    };
  });
}
