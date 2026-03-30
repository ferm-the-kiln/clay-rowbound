# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.7.2] - 2026-03-30

### Added

- **`ifEmpty` for HTTP actions** — write a fallback value (e.g. "❌") when the JSONPath extract returns empty, instead of writing nothing.
- **`bare` flag for AI actions** — passes `--bare` to `claude -p`, skipping CLAUDE.md/settings/MCP discovery for up to 10× faster startup. Enabled by default; set `"bare": false` to load local config.
- **Sidebar UI** — added `ifEmpty` field for HTTP actions and `bare` checkbox for AI actions.

### Fixed

- **gws keyring stdout fix** — `gws` CLI on some systems (notably Linux with GNOME/KDE keyring) prints diagnostic lines like `Using keyring: backend: ...` to stdout before JSON. Rowbound now strips non-JSON prefixes before parsing, preventing `invalid JSON` errors on writeback.

## [0.1.0] - 2026-03-16

### Added

- **CLI** with commands: `init`, `run`, `status`, `watch`, `sync`, `config` (show, add-action, remove-action, update-action, set, validate), `runs` (list, clear), and `mcp`.
- **HTTP action type** -- call any REST API with templated URLs, headers, and bodies. Extract values via JSONPath.
- **Waterfall action type** -- try multiple providers in order until one returns a result.
- **Transform action type** -- compute derived values with JavaScript expressions in a sandboxed VM.
- **Exec action type** -- run shell commands and capture output, with shell-escaped template interpolation.
- **Conditional execution** -- `when` expressions (JavaScript, sandboxed) to skip actions per row.
- **Smart skip** -- automatically skip rows where the target column already has a value.
- **Config stored in Google Sheets Developer Metadata** -- no local config files, point any machine at a sheet and run.
- **v2 multi-tab config format** with GID-based tab identity tracking.
- **Column registry** -- ID-based column tracking that survives header renames, with automatic reconciliation.
- **Watch mode** -- poll sheets on a configurable interval and trigger runs via webhook (POST /webhook).
- **Webhook data ingestion** -- POST row data to the webhook to append a new row and trigger a run.
- **MCP server** (stdio transport) with 17 tools for AI-assisted pipeline building.
- **Rate limiting** -- global token-bucket rate limiter with configurable requests/second.
- **Retry with backoff** -- exponential, linear, or fixed backoff strategies.
- **Structured error handling** -- per-action `onError` config maps error codes to actions (skip, write fallback).
- **Dry run mode** -- preview what would change without writing to the sheet.
- **Run history** -- persistent run state tracking with per-action summaries, durations, and error logs.
- **Template syntax** -- `{{row.field}}` and `{{env.VAR}}` placeholders in URLs, headers, bodies, and commands.
- **Config validation** -- validate pipeline configs with detailed error and warning messages.
- **Graceful shutdown** -- SIGINT/SIGTERM handling for clean pipeline interruption.
