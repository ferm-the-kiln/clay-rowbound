# Enrichment Engine Brainstorm — Clay Rowbound

**Date:** 2026-04-13
**Context:** Built the full Clay Rowbound platform in one session. Dashboard, Drive folders, CSV upload, skill system — all working. But the enrichment engine (the part that actually processes data) needs a redesign around Claude Code sessions + Deepline tools instead of `claude -p` subprocesses.

---

## What Was Built Today

### The Platform (DONE — working)
- **Repo:** `ferm-the-kiln/clay-rowbound` (fork of `eliasstravik/rowbound`)
- **Dashboard:** Next.js 15, 4 pages, dark mode, deployed on Vercel
  - Home (quick actions, recent enrichments with "run again")
  - Enrichments (Google Drive folder browser — reads `Clay Enrichments/` structure)
  - New Enrichment (CSV upload with drag-and-drop → auto-create Google Sheet → Drive folders)
  - Settings (connection status, sheet management, LaunchAgent setup)
- **UX features:** CSV export, cell click-to-copy, toast notifications, enrichment history
- **Google integration:** All via `gws` CLI (no service accounts)
  - Auto-creates sheets from CSV
  - Organizes in Drive folders by category (Research/, Content/, Data Processing/)
- **Setup wizard:** `rowbound setup` — installs gws, Claude Code check, Supabase config, LaunchAgent
- **Enrich CLI:** `rowbound enrich SHEET_ID --skill company-research` — one command that checks environment, sets up sheet config, adds columns, opens dashboard, runs enrichment
- **Supabase cache:** `supabase-cache.ts` — prevents re-enriching same entity (cache by company domain/email)
- **Skills + KB:** 18 skills, 30 knowledge base files, client profiles — all ported from Clay Webhook OS

### The Enrichment Engine (NEEDS REDESIGN)
**Current implementation:** `src/core/skill.ts` → assembles prompt → `claude -p` subprocess per row → parse JSON → write to sheet

**Problems with current approach:**
1. **No real data** — Claude generates research from training data (stale, confidence ~0.45). No Deepline, no Parallel Search, no Findymail, no web search.
2. **Sequential and slow** — One `claude -p` subprocess per row, one at a time. 50 rows = 50 sequential Claude calls.
3. **No tool use** — `claude -p` with `--max-turns 1` and `--tools false` means Claude can't search the web, call APIs, or use MCP tools.
4. **Invisible** — Runs as a hidden subprocess. Rep can't see what's happening.

---

## What the Enrichment Engine SHOULD Do

### The Vision
```
Rep clicks "Run Company Research" in dashboard
    ↓
Command copies to clipboard (or auto-runs)
    ↓
Claude Code session opens in rep's terminal
    ↓
Claude uses Deepline tools to get REAL data:
  - Parallel Search → company info, tech stack, funding, news
  - Findymail → verified emails, phone numbers
  - Web search → recent news, press releases
  - LinkedIn lookup → key people, titles
    ↓
Subagents process multiple rows IN PARALLEL
    ↓
Results write back to Google Sheet LIVE (cells fill as each completes)
    ↓
Dashboard polls and shows results appearing in real-time
    ↓
Supabase caches everything (never re-enrich same entity)
```

### Key Differences from Current
| Aspect | Current (claude -p) | Desired (Claude Code + Deepline) |
|--------|---------------------|----------------------------------|
| Data source | Claude's training data | Real APIs (Parallel, Findymail, web search) |
| Speed | Sequential, 1 row at a time | Parallel via subagents |
| Tool use | None (--tools false) | Full Deepline toolset (865 tools) |
| Visibility | Hidden subprocess | Visible Claude Code session |
| Confidence | ~0.45 (guessing) | ~0.85+ (real data) |

---

## Architecture Options

### Option A: Claude Code Session with MCP Tools
**How:** Run `claude` (not `claude -p`) with the Deepline MCP server loaded. Claude orchestrates the enrichment, using Deepline tools for real data and subagents for parallelism.

```bash
claude --mcp-config .mcp.json "Enrich these 50 companies using Parallel Search and Findymail. Write results to Google Sheet SHEET_ID."
```

**Pros:**
- Full tool use (Deepline, web search, file access)
- Claude Code can spawn subagents for parallel processing
- Rep sees Claude working in their terminal
- Uses Max subscription (flat rate)

**Cons:**
- Less structured output (Claude decides how to process)
- Harder to guarantee JSON schema compliance per row
- Session management across many rows is complex
- Need to handle Claude Code's interactive prompts

### Option B: Hybrid — Skill Prompt + Claude Code with Tools
**How:** Keep the skill.md prompt system for structured output, but run Claude Code (not `claude -p`) with tools enabled so it can fetch real data before generating the structured response.

```bash
claude -p --tools default --mcp-config deepline.json --max-turns 5 < assembled_prompt.txt
```

**Pros:**
- Structured output via skill.md prompts
- Real data from Deepline/web search tools
- Still automated (not interactive)
- Can process rows in batches

**Cons:**
- Still sequential per row (no subagents in -p mode)
- More Claude turns = more time per row
- Need to manage tool auth in headless mode

### Option C: Deepline CLI Direct + Claude for Analysis
**How:** Use Deepline CLI directly for data fetching (deterministic, fast), then pass the fetched data to Claude for analysis/writing. Two-stage pipeline.

```
Stage 1 (Deepline — parallel, fast):
  deepline parallel-search stripe.com → company data
  deepline findymail-enrich "Patrick Collison" stripe.com → email, phone

Stage 2 (Claude — with real data):  
  claude -p "Analyze this company data and write a research brief: {real_data}"
```

**Pros:**
- Fastest — Deepline is deterministic, no LLM overhead for data fetching
- Highest confidence — real data, not generated
- Parallel data fetching across all rows simultaneously
- Claude only does what it's good at (analysis, writing)

**Cons:**
- Two-stage pipeline is more complex
- Need to handle Deepline tool errors/fallbacks
- Deepline needs to be installed and configured

### Option D: Claude Code Agent with Custom Instructions
**How:** Create a custom Claude Code agent (via CLAUDE.md or system prompt) that knows how to use Deepline tools and process rows from a Google Sheet. The rep runs `claude` in the clay-rowbound directory and says "enrich my sheet."

```bash
cd clay-rowbound
claude
> "Run company research on sheet 14YLpj... using Deepline for data"
```

Claude reads CLAUDE.md, knows about the skills, uses MCP tools (Deepline, gws), processes rows, writes results.

**Pros:**
- Most natural UX — rep just talks to Claude
- Full Claude Code capabilities (subagents, tools, file access)
- Claude adapts to errors and edge cases
- Feels like having an AI assistant, not running a script

**Cons:**
- Least predictable — Claude might take different approaches each time
- Harder to guarantee consistent output format
- May hit context limits with many rows
- Need good CLAUDE.md instructions to keep it on track

---

## What Already Exists (from Clay Webhook OS)

### Deepline Integration (fully built, needs porting)
- **Memory:** `project_deepline_integration.md` — "full pipeline deployed: 865 tools, Supabase cache, parallel exec, AI fallback, LaunchAgent daemon"
- **Deepline executor:** `clay-webhook-os/app/core/deepline_executor.py` — wraps `deepline` CLI
- **Research fetcher:** `clay-webhook-os/app/core/research_fetcher.py` (1,629 lines) — Parallel.ai, Sumble, Findymail
- **Findymail client:** `clay-webhook-os/app/core/findymail_client.py` — email/phone enrichment
- **Scripts:** `clay-webhook-os/scripts/deepline-find.py` — standalone people finder using Claude Managed Agents

### MCP Server (already in Rowbound fork)
- **File:** `clay-rowbound/scripts/webhook-os-mcp-server.py` — 18 MCP tools (from old project)
- **Rowbound MCP:** `clay-rowbound/src/mcp/server.ts` — 16+ tools for pipeline management
- **Deepline MCP:** Deepline itself has an MCP server with 865 tools

### Key APIs (already have keys)
- **Parallel.ai** — Parallel Search API for company research
- **Findymail** — Email/phone finder + verification
- **Supabase** — Enrichment cache (already configured)

---

## Decisions to Make in Next Session

1. **Which architecture option?** (A, B, C, or D above)
   - Recommendation: **Option C (Deepline direct + Claude for analysis)** or **Option D (Claude Code agent)** depending on how much structure vs. flexibility you want.

2. **How should rows be parallelized?**
   - Claude Code subagents (Option A/D)
   - Deepline CLI parallel execution (Option C)
   - Batch processing in chunks of 5-10 (Option B)

3. **What's the trigger model?**
   - Dashboard copies command → rep pastes in terminal (current)
   - Dashboard opens Claude Code session automatically
   - Rep says "enrich my sheet" in an existing Claude Code session

4. **Which enrichments need real data vs. Claude-only?**
   - **Need real data:** company-research, people-research, competitor-research, company-qualifier
   - **Claude-only is fine:** email-gen, linkedin-note, follow-up, sequence-writer, classify
   - The content/writing skills just need good input data — which comes from the research skills

5. **How to handle the Deepline tool catalog?**
   - Pre-configure which tools each skill uses
   - Let Claude discover tools dynamically via MCP
   - Hardcode a subset (Parallel Search, Findymail, web search)

---

## File Paths Reference

### Clay Rowbound (current project)
```
/Users/fermandujar/Documents/clay-rowbound/
├── src/core/skill.ts              — Current skill loader + prompt assembler
├── src/core/supabase-cache.ts     — Supabase enrichment cache
├── src/core/engine.ts             — Pipeline engine (needs enrichment redesign)
├── src/core/ai.ts                 — claude -p subprocess handler
├── src/cli/enrich.ts              — One-command enrichment runner
├── src/mcp/server.ts              — MCP server (16+ tools)
├── skills/                        — 18 skill definitions (skill.md)
├── knowledge_base/                — 30 context files
├── clients/                       — Client profiles
├── dashboard/                     — Next.js dashboard (4 pages)
├── scripts/setup-launchagent.sh   — LaunchAgent auto-start
└── .mcp.json                      — MCP server config
```

### Clay Webhook OS (old project — reference for porting)
```
/Users/fermandujar/Documents/clay-webhook-os/
├── app/core/research_fetcher.py   — Parallel.ai + Sumble + Findymail (1,629 lines)
├── app/core/findymail_client.py   — Email/phone enrichment (214 lines)
├── app/core/deepline_executor.py  — Deepline CLI wrapper (330 lines)
├── app/core/enrichment_cache.py   — Supabase cache (310 lines)
├── app/core/context_assembler.py  — Prompt builder (257 lines)
├── scripts/deepline-find.py       — People finder script (650+ lines)
└── scripts/webhook-os-mcp-server.py — MCP server (783 lines)
```

### Deepline (enrichment tool catalog)
```
~/.deepline/                       — 865 tools, cached in Supabase
deepline parallel-search           — Company research
deepline findymail-enrich          — Email/phone lookup
deepline web-search                — Web search
```

---

## Summary for Next Session

**What's done:** Dashboard, Drive folders, CSV upload, skill system, setup wizard, enrich CLI, Supabase cache. The UX shell is complete.

**What needs redesign:** The enrichment engine. Currently uses `claude -p` (hidden, sequential, no real data). Needs to use Claude Code + Deepline (visible, parallel, real data from Parallel Search/Findymail/web).

**The question:** How should Claude Code orchestrate enrichments with Deepline tools? Pick an architecture (A/B/C/D), decide on parallelism strategy, and build the enrichment engine that makes this platform actually powerful.

**Start the next session with:** "I need to redesign the enrichment engine for clay-rowbound. Read `docs/enrichment-engine-brainstorm.md` for full context."
