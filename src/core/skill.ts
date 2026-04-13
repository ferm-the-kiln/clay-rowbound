/**
 * Clay skill loader, context assembler, and executor.
 *
 * Ported from Clay Webhook OS Python modules:
 * - skill_loader.py (frontmatter parsing, skill loading)
 * - context_assembler.py (prompt assembly with context files)
 * - context_filter.py (client profile section filtering)
 * - entity_utils.py (entity key extraction for caching)
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { parse as parseYaml } from "yaml";
import { executeAiAction } from "./ai.js";
import { resolveTemplate } from "./template.js";
import type { CellUpdate, ExecutionContext } from "./types.js";
import type { SkillAction } from "./types.js";

// ---------------------------------------------------------------------------
// Skill location resolution
// ---------------------------------------------------------------------------

/** Resolve the base directory for skills/knowledge_base/clients.
 *  Walks up from this file's directory looking for a `skills/` directory. */
function findBaseDir(): string {
  let dir = dirname(new URL(import.meta.url).pathname);
  for (let i = 0; i < 10; i++) {
    if (existsSync(join(dir, "skills"))) return dir;
    dir = dirname(dir);
  }
  // Fallback: current working directory
  return process.cwd();
}

const BASE_DIR = findBaseDir();

// ---------------------------------------------------------------------------
// Frontmatter parsing
// ---------------------------------------------------------------------------

export interface SkillConfig {
  model_tier?: string;
  scope?: string;
  context?: string[];
  context_max_chars?: number;
  skip_defaults?: boolean;
  semantic_context?: boolean;
  executor?: string;
  output_format?: string;
}

export function parseSkillFrontmatter(content: string): {
  config: SkillConfig;
  body: string;
} {
  if (!content.startsWith("---")) {
    return { config: {}, body: content };
  }
  const end = content.indexOf("---", 3);
  if (end === -1) {
    return { config: {}, body: content };
  }
  const fmText = content.slice(3, end).trim();
  const body = content.slice(end + 3).replace(/^\n+/, "");
  try {
    const config = (parseYaml(fmText) as SkillConfig) || {};
    return { config, body };
  } catch {
    return { config: {}, body: content };
  }
}

// ---------------------------------------------------------------------------
// Skill loading
// ---------------------------------------------------------------------------

const skillCache = new Map<string, { mtime: number; config: SkillConfig; body: string }>();

export function loadSkill(skillId: string): { config: SkillConfig; body: string } | null {
  const skillFile = join(BASE_DIR, "skills", skillId, "skill.md");
  if (!existsSync(skillFile)) return null;

  const { mtimeMs } = statSync(skillFile);
  const cached = skillCache.get(skillId);
  if (cached && cached.mtime === mtimeMs) {
    return { config: cached.config, body: cached.body };
  }

  const content = readFileSync(skillFile, "utf-8");
  const { config, body } = parseSkillFrontmatter(content);
  skillCache.set(skillId, { mtime: mtimeMs, config, body });
  return { config, body };
}

export function listSkills(): string[] {
  const skillsDir = join(BASE_DIR, "skills");
  if (!existsSync(skillsDir)) return [];
  return readdirSync(skillsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(skillsDir, d.name, "skill.md")))
    .map((d) => d.name)
    .filter((name) => !name.startsWith("_"))
    .sort();
}

// ---------------------------------------------------------------------------
// Context loading
// ---------------------------------------------------------------------------

/** Priority order: most-generic first → most-specific last. */
const PRIORITY_ORDER = [
  "knowledge_base/frameworks/",
  "knowledge_base/voice/",
  "knowledge_base/objections/",
  "knowledge_base/competitive/",
  "knowledge_base/sequences/",
  "knowledge_base/signals/",
  "knowledge_base/personas/",
  "knowledge_base/industries/",
  "clients/",
];

const CATEGORY_ROLES: Record<string, string> = {
  frameworks: "Methodology & frameworks",
  voice: "Writing style & tone",
  objections: "Objection handling",
  competitive: "Competitive intelligence",
  sequences: "Sequence templates",
  signals: "Signal patterns",
  personas: "Persona profiles",
  industries: "Industry context",
  clients: "Client profile",
};

function contextPriority(path: string): number {
  for (let i = 0; i < PRIORITY_ORDER.length; i++) {
    if (path.startsWith(PRIORITY_ORDER[i]!)) return i;
  }
  return PRIORITY_ORDER.length;
}

function getRole(path: string): string {
  const parts = path.split("/");
  const category = parts[0] === "knowledge_base" ? parts[1] ?? parts[0] : parts[0];
  return CATEGORY_ROLES[category!] ?? "Reference";
}

function loadFile(relativePath: string): string | null {
  const fullPath = join(BASE_DIR, relativePath);
  if (!existsSync(fullPath)) return null;
  return readFileSync(fullPath, "utf-8");
}

function resolveTemplateVars(refPath: string, clientSlug?: string): string {
  let resolved = refPath;
  if (clientSlug && resolved.includes("{{client_slug}}")) {
    resolved = resolved.replace(/\{\{client_slug\}\}/g, clientSlug);
  }
  // Support structured client directories: clients/{slug}.md -> clients/{slug}/profile.md
  if (resolved.startsWith("clients/") && resolved.endsWith(".md") && !resolved.endsWith("/profile.md")) {
    const profilePath = resolved.slice(0, -3) + "/profile.md";
    if (existsSync(join(BASE_DIR, profilePath))) {
      return profilePath;
    }
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// Client profile filtering (from context_filter.py)
// ---------------------------------------------------------------------------

/** Skill → exact client profile sections needed.
 *  No shared baseline. If a section isn't listed, it doesn't load. */
const SKILL_CLIENT_SECTIONS: Record<string, string[]> = {
  "email-gen": ["What They Sell", "Tone Preferences", "Campaign Angles Worth Testing", "Campaign Angles", "Recent News & Signals"],
  "sequence-writer": ["What They Sell", "Tone Preferences", "Campaign Angles Worth Testing", "Campaign Angles", "Sequence Strategy", "Recent News & Signals"],
  "linkedin-note": ["What They Sell", "Tone Preferences", "Campaign Angles Worth Testing"],
  "follow-up": ["What They Sell", "Tone Preferences", "Campaign Angles Worth Testing", "Recent News & Signals"],
  "quality-gate": ["What They Sell", "Tone Preferences", "Campaign Angles Worth Testing"],
  "account-researcher": ["What They Sell", "Target ICP", "Competitive Landscape", "Vertical Messaging"],
  "meeting-prep": ["What They Sell", "Target ICP", "Competitive Landscape", "Discovery Questions", "Recent News & Signals"],
  "discovery-questions": ["What They Sell", "Target ICP", "Discovery Questions"],
  "competitive-response": ["What They Sell", "Competitive Landscape", "Battle Cards", "Common Objections"],
  "champion-enabler": ["What They Sell", "Champion Enablement", "ROI Framework", "Integration Timeline"],
  "campaign-brief": ["What They Sell", "Target ICP", "Campaign Angles Worth Testing", "Campaign Angles", "Vertical Messaging", "Signal Playbook"],
  "multi-thread-mapper": ["What They Sell", "Target ICP", "Multi-Threading Guide"],
  "company-research": ["What They Sell", "Target ICP"],
  "people-research": ["What They Sell", "Target ICP"],
  "competitor-research": ["What They Sell", "Competitive Landscape", "Battle Cards"],
  "company-qualifier": ["What They Sell", "Target ICP", "Qualification Criteria", "Competitive Landscape", "Closed-Won Archetypes"],
};

function splitMarkdownSections(content: string, level = 2): Record<string, string> {
  const prefix = "#".repeat(level) + " ";
  const sections: Record<string, string> = {};
  let currentKey: string | null = null;
  const currentLines: string[] = [];

  for (const line of content.split("\n")) {
    if (line.startsWith(prefix)) {
      if (currentKey !== null) {
        sections[currentKey] = currentLines.join("\n");
        currentLines.length = 0;
      }
      currentKey = line.slice(prefix.length).trim();
    } else if (currentKey !== null) {
      currentLines.push(line);
    }
  }
  if (currentKey !== null) {
    sections[currentKey] = currentLines.join("\n");
  }
  return sections;
}

function filterClientProfile(content: string, skillId: string): string {
  const needed = SKILL_CLIENT_SECTIONS[skillId];
  if (!needed) return content;

  const sections = splitMarkdownSections(content);
  const parts: string[] = [];

  // Keep H1 title if present
  const firstLine = content.split("\n")[0] ?? "";
  if (firstLine.startsWith("# ")) {
    parts.push(firstLine, "");
  }

  for (const sectionName of needed) {
    if (sectionName in sections) {
      parts.push(`## ${sectionName}`, sections[sectionName]!);
    }
  }

  return parts.join("\n").trim();
}

// ---------------------------------------------------------------------------
// Context file collection
// ---------------------------------------------------------------------------

interface ContextEntry {
  path: string;
  content: string;
  role: string;
}

export function loadContextFiles(
  config: SkillConfig,
  skillId: string,
  clientSlug?: string,
): ContextEntry[] {
  const files: ContextEntry[] = [];
  const seen = new Set<string>();

  // 1. Load defaults (unless skip_defaults)
  if (!config.skip_defaults) {
    const defaultsDir = join(BASE_DIR, "knowledge_base", "_defaults");
    if (existsSync(defaultsDir)) {
      const entries = readdirSync(defaultsDir, { withFileTypes: true })
        .filter((f) => f.name.endsWith(".md"))
        .sort((a, b) => a.name.localeCompare(b.name));
      for (const f of entries) {
        const rel = `knowledge_base/_defaults/${f.name}`;
        const content = readFileSync(join(defaultsDir, f.name), "utf-8");
        seen.add(rel);
        files.push({ path: rel, content, role: getRole(rel) });
      }
    }
  }

  // 2. Load context refs from frontmatter
  const refs = config.context ?? [];
  for (const ref of refs) {
    const resolved = resolveTemplateVars(ref, clientSlug);
    if (resolved.includes("{{")) continue; // Unresolved template
    if (seen.has(resolved)) continue;

    let content = loadFile(resolved);
    if (!content) continue;

    // Apply client profile filtering
    if (resolved.startsWith("clients/")) {
      content = filterClientProfile(content, skillId);
    }

    seen.add(resolved);
    files.push({ path: resolved, content, role: getRole(resolved) });
  }

  // 3. Truncate if context_max_chars set
  if (config.context_max_chars) {
    for (const ctx of files) {
      if (ctx.content.length > config.context_max_chars) {
        ctx.content = ctx.content.slice(0, config.context_max_chars) + "\n\n[...truncated]";
      }
    }
  }

  // 4. Sort by priority (generic → specific)
  files.sort((a, b) => contextPriority(a.path) - contextPriority(b.path));

  return files;
}

// ---------------------------------------------------------------------------
// Prompt assembly
// ---------------------------------------------------------------------------

export function assemblePrompt(
  skillBody: string,
  contextFiles: ContextEntry[],
  rowData: Record<string, string>,
  outputFormat = "json",
): string {
  const parts: string[] = [];

  // 1. System instruction
  if (outputFormat === "json") {
    parts.push(
      "You are a JSON generation engine. Return ONLY valid JSON — no markdown fences, no explanation, no preamble. Just the raw JSON object.",
    );
  } else if (outputFormat === "markdown") {
    parts.push(
      "You are a content generation engine. Return your output as clean Markdown. No JSON wrapping, no code fences around the entire output.",
    );
  } else {
    parts.push(
      "You are a content generation engine. Return your output as plain text. No JSON wrapping, no markdown, no code fences.",
    );
  }

  // 2. Skill body
  parts.push("\n\n# Skill Instructions\n");
  parts.push(skillBody);

  // 3. Context files
  if (contextFiles.length > 0) {
    parts.push("\n\n---\n");
    parts.push(`# Loaded Context (${contextFiles.length} files)\n`);
    for (let i = 0; i < contextFiles.length; i++) {
      const ctx = contextFiles[i]!;
      parts.push(`${i + 1}. \`${ctx.path}\` — ${ctx.role}`);
    }
    for (const ctx of contextFiles) {
      parts.push(`\n\n## ${ctx.path}\n\n${ctx.content}`);
    }
  }

  // 4. Data payload
  parts.push("\n\n---\n\n# Data to Process\n");
  parts.push(JSON.stringify(rowData, null, 2));

  // 5. Closing instruction
  if (outputFormat === "json") {
    parts.push("\n\nReturn ONLY the JSON object. No markdown, no explanation.");
  } else if (outputFormat === "markdown") {
    parts.push("\n\nReturn your response as clean Markdown.");
  } else {
    parts.push("\n\nReturn your response as plain text.");
  }

  return parts.join("");
}

// ---------------------------------------------------------------------------
// Entity key extraction (for caching)
// ---------------------------------------------------------------------------

export function extractEntityKey(
  row: Record<string, string>,
): { entityType: string; entityId: string } | null {
  // Company domain (prefer)
  for (const key of ["company_domain", "domain", "website", "Domain", "Company Domain", "Website"]) {
    const val = row[key];
    if (val && typeof val === "string" && val.trim()) {
      const domain = val.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/^www\./, "");
      return { entityType: "company", entityId: slugify(domain) };
    }
  }

  // Contact email
  for (const key of ["email", "contact_email", "person_email", "Email", "Contact Email"]) {
    const val = row[key];
    if (val && typeof val === "string" && val.trim()) {
      return { entityType: "contact", entityId: slugify(val) };
    }
  }

  // Company name fallback
  for (const key of ["company_name", "company", "Company", "Company Name"]) {
    const val = row[key];
    if (val && typeof val === "string" && val.trim()) {
      return { entityType: "company", entityId: slugify(val) };
    }
  }

  return null;
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ---------------------------------------------------------------------------
// Skill action executor (called from engine.ts)
// ---------------------------------------------------------------------------

export async function executeSkillAction(
  action: SkillAction,
  context: ExecutionContext,
  options: {
    signal?: AbortSignal;
    rowIndex: number;
    columnMap?: Record<string, string>;
  },
): Promise<CellUpdate[]> {
  // 1. Load skill
  const skill = loadSkill(action.skillId);
  if (!skill) {
    throw new Error(`Skill "${action.skillId}" not found in skills/ directory`);
  }

  // 2. Load context files
  const contextFiles = loadContextFiles(skill.config, action.skillId, action.clientSlug);

  // 3. Determine output format
  const outputFormat = skill.config.output_format ?? "json";

  // 4. Assemble prompt
  const prompt = assemblePrompt(skill.body, contextFiles, context.row, outputFormat);

  // 5. Determine model — use action override or let claude pick the default
  const model = action.model ?? undefined;

  // 6. Delegate to the existing AI action executor
  //    This reuses Rowbound's proven claude -p subprocess handling
  const aiUpdates = await executeAiAction(
    {
      id: action.id,
      type: "ai",
      target: action.target,
      runtime: "claude",
      model,
      prompt,
      bare: true,
      maxTurns: 1,
      tools: false,
      timeout: action.timeout ?? 120,
      onError: action.onError,
      outputs: action.outputs
        ? Object.fromEntries(
            Object.entries(action.outputs).map(([k, v]) => [k, { type: v as "text" | "number" | "boolean" }]),
          )
        : undefined,
    },
    // Pass a context with an empty row since the prompt already includes data
    { ...context, row: {} },
    options,
  );

  return aiUpdates;
}
