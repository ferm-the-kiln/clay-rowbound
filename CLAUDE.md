# Clay Rowbound

Fork of [Rowbound](https://github.com/eliasstravik/rowbound) extended with Clay's
skill-based enrichment system. Reps run enrichments via a local Claude Code Max
subscription — no API keys, no server, flat-rate at scale.

## Architecture

```
Google Sheet (data) ← Rowbound CLI (enrichment engine) → Claude --print (AI)
                    ↑
         Dashboard (Next.js on Vercel, reads sheet, triggers via localhost webhook)
```

- **Google Sheets** = working data layer (what reps see)
- **Supabase** = enrichment cache (prevents re-enriching same entity)
- **Rowbound CLI** = execution engine, runs locally via LaunchAgent
- **Dashboard** = simplified Next.js UI (4 pages)
- **Skills** = markdown prompt definitions in `skills/`
- **Knowledge Base** = reusable context files in `knowledge_base/`

## What's Different From Upstream Rowbound

- **`skill` action type** (`src/core/skill.ts`) — loads `skills/{id}/skill.md`,
  assembles prompts with knowledge base context, filters client profiles by skill
- **Supabase cache** (`src/core/supabase-cache.ts`) — entity-level caching to
  prevent re-enriching the same company/person
- **Skills directory** — 18 enrichment skills ported from Clay Webhook OS
- **Knowledge base** — 30 context files (frameworks, personas, industries, etc.)
- **Client profiles** — per-client context in `clients/`
- **Dashboard** — Next.js 15 app in `dashboard/`

## Project Structure

```
src/core/           → Rowbound core + Clay extensions (skill.ts, supabase-cache.ts)
src/cli/            → CLI commands (run, watch, config, etc.)
src/mcp/            → MCP server (16+ tools for Claude Code)
src/adapters/       → Google Sheets adapter
skills/             → Skill definitions (skill.md per skill)
knowledge_base/     → Reusable context files
clients/            → Per-client profiles
dashboard/          → Next.js 15 dashboard (4 pages)
scripts/            → LaunchAgent setup, deployment
```

## Development

```bash
# CLI
npm install
npm run dev -- run SHEET_ID          # run enrichment pipeline
npm run dev -- watch SHEET_ID        # start watch mode + webhook server
npm test                              # run tests (vitest)

# Dashboard
cd dashboard && npm install && npm run dev

# LaunchAgent
bash scripts/setup-launchagent.sh YOUR_SHEET_ID
```

## Key Files

- `src/core/skill.ts` — skill loader, context assembler, prompt builder
- `src/core/supabase-cache.ts` — Supabase enrichment cache
- `src/core/engine.ts` — pipeline engine (dispatches all action types including skill)
- `src/core/types.ts` — type definitions (includes SkillAction)
- `src/core/ai.ts` — claude -p subprocess handler (reused by skill actions)
- `dashboard/app/tables/[id]/page.tsx` — table view with enrichment triggers
- `dashboard/components/connection-status.tsx` — Rowbound health check indicator

## Environment Variables

```bash
# Supabase (optional — for enrichment cache)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key

# Google Sheets (for dashboard API routes)
GOOGLE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
```
