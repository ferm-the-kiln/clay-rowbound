import { NextResponse } from "next/server";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";

/**
 * GET /api/skills
 *
 * Returns the list of available skills from the skills/ directory.
 * Reads frontmatter to extract metadata.
 */

interface SkillInfo {
  id: string;
  name: string;
  category: string;
  model_tier?: string;
}

const CATEGORY_MAP: Record<string, string> = {
  "email-gen": "content",
  "sequence-writer": "content",
  "linkedin-note": "content",
  "follow-up": "content",
  "quality-gate": "content",
  "account-researcher": "strategy",
  "meeting-prep": "strategy",
  "discovery-questions": "strategy",
  "competitive-response": "strategy",
  "champion-enabler": "strategy",
  "campaign-brief": "strategy",
  "multi-thread-mapper": "strategy",
  "company-research": "research",
  "people-research": "research",
  "competitor-research": "research",
  "classify": "data",
  "first-party-analyzer": "data",
  "company-qualifier": "data",
  "title-filter": "data",
};

function findSkillsDir(): string | null {
  // Walk up from this file looking for skills/
  let dir = process.cwd();
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, "skills");
    if (existsSync(candidate)) return candidate;
    dir = dirname(dir);
  }
  return null;
}

export async function GET() {
  const skillsDir = findSkillsDir();
  if (!skillsDir) {
    return NextResponse.json([]);
  }

  const skills: SkillInfo[] = [];

  const entries = readdirSync(skillsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;

    const skillFile = join(skillsDir, entry.name, "skill.md");
    if (!existsSync(skillFile)) continue;

    // Extract name from first H1 heading
    const content = readFileSync(skillFile, "utf-8");
    const nameMatch = content.match(/^#\s+(.+)/m);
    const name = nameMatch
      ? nameMatch[1]!.split("—")[0]!.trim()
      : entry.name.replace(/-/g, " ");

    skills.push({
      id: entry.name,
      name,
      category: CATEGORY_MAP[entry.name] ?? "other",
    });
  }

  return NextResponse.json(skills.sort((a, b) => a.name.localeCompare(b.name)));
}
