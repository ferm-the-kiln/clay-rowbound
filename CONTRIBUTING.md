# Contributing to Rowbound

Thanks for your interest in contributing to Rowbound. This guide covers development setup, project structure, and how to add new functionality.

## Development Setup

```bash
# Clone the repo
git clone https://github.com/eliasstravik/rowbound.git
cd rowbound

# Install dependencies
npm install

# Run in development mode (uses tsx for TypeScript execution)
npm run dev -- <command>

# Build
npm run build

# Run tests
npm test
```

## Project Structure

```
src/
  cli/              # CLI command definitions (Commander.js)
    index.ts        # Entry point, registers all commands
    init.ts         # rowbound init
    run.ts          # rowbound run
    config.ts       # rowbound config (show, add-action, remove-action, update-action, set, validate)
    status.ts       # rowbound status
    watch.ts        # rowbound watch
    runs.ts         # rowbound runs
    sync.ts         # rowbound sync
    format.ts       # CLI output formatting helpers
  mcp/
    server.ts       # MCP server with all tool registrations
  core/             # Engine and shared logic
    types.ts        # All TypeScript interfaces (Action, PipelineConfig, etc.)
    engine.ts       # Pipeline execution engine
    template.ts     # {{row.x}} / {{env.Y}} template resolution
    condition.ts    # `when` condition evaluation (vm sandbox)
    extractor.ts    # JSONPath value extraction
    http-client.ts  # HTTP request with retry logic
    waterfall.ts    # Waterfall action execution
    exec.ts         # Exec action execution (shell commands)
    shell-escape.ts # Shell escaping for exec templates
    rate-limiter.ts # Token-bucket rate limiter
    validator.ts    # Config validation
    reconcile.ts    # Column registry reconciliation
    run-state.ts    # Run history persistence
    run-tracker.ts  # Live run tracking callbacks
    run-format.ts   # Run output formatting
    tab-resolver.ts # GID-based tab identity resolution
    defaults.ts     # Default config values and factory functions
    env.ts          # Environment variable filtering and exposure
    url-guard.ts    # SSRF protection (HTTPS enforcement, private IP blocking)
    safe-compare.ts # Timing-safe string comparison for webhook tokens
    __tests__/      # Unit tests (vitest)
  __tests__/
    integration.test.ts  # End-to-end integration tests
  adapters/
    adapter.ts      # Adapter interface definition and re-export
    sheets/
      sheets-adapter.ts   # Google Sheets adapter (shells out to gws)
  index.ts          # Public API re-exports
```

## How to Add an action Type

1. **Define the type** in `src/core/types.ts` -- add a new interface (e.g., `MyAction`) and include it in the `Action` union type.

2. **Implement execution** -- create `src/core/my-action.ts` with an `executeMyAction` function that takes the action definition, execution context, and options, and returns `string | null`.

3. **Wire it into the engine** -- in `src/core/engine.ts`, add a case in the `for (const action of actions)` loop inside `runPipeline` to handle your new action type.

4. **Add tests** -- create `src/core/__tests__/my-action.test.ts` with unit tests covering the happy path, error handling, and edge cases.

5. **Update the validator** -- add any validation rules for your action type in `src/core/validator.ts`.

## How to Add a CLI Command

1. **Create the command file** -- add `src/cli/my-command.ts` with a `registerMyCommand(program: Command)` function.

2. **Register it** -- import and call your register function in `src/cli/index.ts`.

3. **Follow the pattern** -- use Commander.js options/arguments. Handle errors by logging to `console.error` and setting `process.exitCode = 1`.

## How to Add an MCP Tool

1. **Add the tool** in `src/mcp/server.ts` using `server.registerTool()`.

2. **Follow the pattern** -- use zod schemas for input validation, return `ok()` for success and `err()` for errors.

3. **Keep tools granular** -- one tool per operation.

> **Note:** This project uses **zod v4**, not zod v3. Import from `"zod/v4"`:
>
> ```ts
> import { z } from "zod/v4";
> ```
>
> The zod v4 API differs from v3 in several ways (e.g., schema methods, error formatting). Refer to the [zod v4 docs](https://zod.dev) when adding or modifying schemas.

## Running Tests

```bash
# Run all tests
npm test

# Run a specific test file
npx vitest run src/core/__tests__/engine.test.ts

# Run tests in watch mode
npx vitest
```

Tests use [vitest](https://vitest.dev/). Test files live alongside the source code in `__tests__/` directories.

## PR Guidelines

- Keep PRs focused on a single change.
- Include tests for new functionality.
- Run `npm run lint`, `npm test`, and `npm run build` before submitting.
- Use clear commit messages that describe what changed and why.

## Code Style

- TypeScript strict mode is enabled.
- ESM modules (`"type": "module"` in package.json).
- Use `.js` extensions in imports (required by Node16 module resolution).
- Prefer `const` over `let`.
- Use explicit return types on exported functions.
- Error handling: throw `Error` objects, never strings.
