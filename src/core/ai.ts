import { unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executeCommand } from "./exec.js";
import { resolveTemplate } from "./template.js";
import type {
  AiAction,
  CellUpdate,
  ExecutionContext,
  OnErrorConfig,
} from "./types.js";

const DEFAULT_AI_TIMEOUT = 120_000; // 2 minutes

/**
 * Sanitize row data before interpolating into AI prompts.
 * Strips control characters and limits field length to prevent prompt injection.
 */
function sanitizeForPrompt(value: string, maxLength = 10_000): string {
  // Strip control characters except newlines and tabs
  // biome-ignore lint/suspicious/noControlCharactersInRegex: intentional control char stripping
  const cleaned = value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  return cleaned.length > maxLength
    ? `${cleaned.slice(0, maxLength)}... [truncated]`
    : cleaned;
}

/**
 * Build the prompt string for the AI, including output format instructions.
 */
function buildPrompt(action: AiAction, context: ExecutionContext): string {
  // Sanitize row data before template resolution
  const sanitizedContext: ExecutionContext = {
    ...context,
    row: Object.fromEntries(
      Object.entries(context.row).map(([k, v]) => [k, sanitizeForPrompt(v)]),
    ),
  };

  const resolvedPrompt = resolveTemplate(action.prompt, sanitizedContext);

  // If outputs are defined, instruct the AI to return structured JSON
  if (action.outputs && Object.keys(action.outputs).length > 0) {
    const fieldDescriptions = Object.entries(action.outputs)
      .map(([name, field]) => `  "${name}": ${field.type}`)
      .join("\n");

    return `${resolvedPrompt}

IMPORTANT: Respond with ONLY a JSON object containing these fields (no markdown, no explanation):
{
${fieldDescriptions}
}`;
  }

  return resolvedPrompt;
}

/**
 * Resolve the onError action for a given exit code.
 */
function resolveAiErrorAction(
  onError: OnErrorConfig | undefined,
  exitCode: number,
): string | { write: string } | undefined {
  if (!onError) return undefined;
  const codeKey = String(exitCode);
  if (codeKey in onError) return onError[codeKey];
  if ("default" in onError) return onError.default;
  return undefined;
}

/**
 * Execute an AI action using headless claude -p or codex exec.
 *
 * Returns an array of CellUpdate entries — one per output column for
 * multi-column outputs, or a single entry for the target column.
 */
export async function executeAiAction(
  action: AiAction,
  context: ExecutionContext,
  options: {
    signal?: AbortSignal;
    rowIndex: number;
    columnMap?: Record<string, string>;
  },
): Promise<CellUpdate[]> {
  const prompt = buildPrompt(action, context);
  const timeout = action.timeout ?? DEFAULT_AI_TIMEOUT;

  // Write prompt to a temp file to avoid shell injection via prompt content
  const tmpFile = join(
    tmpdir(),
    `rowbound-ai-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`,
  );
  writeFileSync(tmpFile, prompt, "utf-8");

  let command: string;
  if (action.runtime === "claude") {
    // claude -p reads prompt from stdin — safe since stdin is not shell-interpreted.
    // Don't use --output-format json as it wraps the response in a metadata envelope
    // that interferes with JSON parsing of the AI's actual output.
    command = `cat "${tmpFile}" | claude -p`;
  } else {
    // codex exec — pipe prompt via stdin to avoid shell injection from prompt content.
    // The $(cat ...) pattern is unsafe because prompt content would be shell-interpreted.
    command = `cat "${tmpFile}" | codex exec --stdin -s read-only`;
  }

  try {
    // AI actions need PATH and HOME to find claude/codex CLIs.
    // Merge only essential system vars — don't leak all of process.env.
    const aiEnv = {
      ...context.env,
      PATH: process.env.PATH ?? "/usr/local/bin:/usr/bin:/bin",
      HOME: process.env.HOME ?? "",
      SHELL: process.env.SHELL ?? "/bin/sh",
    };
    const result = await executeCommand(command, {
      timeout,
      signal: options.signal,
      env: aiEnv,
    });

    // Clean up temp file
    try {
      unlinkSync(tmpFile);
    } catch {
      // Best-effort cleanup
    }

    // Handle non-zero exit code
    if (result.exitCode !== 0) {
      const errorAction = resolveAiErrorAction(action.onError, result.exitCode);
      if (errorAction === "skip") return [];
      if (
        errorAction &&
        typeof errorAction === "object" &&
        "write" in errorAction
      ) {
        const columnName = options.columnMap?.[action.target] ?? action.target;
        return [
          {
            row: options.rowIndex + 2,
            column: columnName,
            value: errorAction.write,
          },
        ];
      }
      throw new Error(
        `AI action "${action.id}" (${action.runtime}) failed with exit code ${result.exitCode}: ${result.stderr.trim()}`,
      );
    }

    const stdout = result.stdout.trim();
    if (!stdout) return [];

    // If outputs are defined, parse JSON and map to columns
    if (action.outputs && Object.keys(action.outputs).length > 0) {
      let parsed: Record<string, unknown>;
      try {
        // Try direct JSON parse first (most reliable), then fall back to regex
        try {
          parsed = JSON.parse(stdout.trim());
        } catch {
          // Fall back to extracting first balanced JSON object from wrapped output
          const jsonMatch = stdout.match(/\{[\s\S]*?\}/);
          if (!jsonMatch) {
            throw new Error("No JSON object found in output");
          }
          parsed = JSON.parse(jsonMatch[0]);
        }
      } catch {
        // Fallback: write raw output to primary target column
        const columnName = options.columnMap?.[action.target] ?? action.target;
        return [
          {
            row: options.rowIndex + 2,
            column: columnName,
            value: stdout,
          },
        ];
      }

      const updates: CellUpdate[] = [];
      for (const [fieldName] of Object.entries(action.outputs)) {
        const val = parsed[fieldName];
        if (val !== undefined && val !== null) {
          const strVal =
            typeof val === "object" ? JSON.stringify(val) : String(val);
          const columnName = options.columnMap?.[fieldName] ?? fieldName;
          updates.push({
            row: options.rowIndex + 2,
            column: columnName,
            value: strVal,
          });
        }
      }
      return updates;
    }

    // Single-output mode: write to target column
    const columnName = options.columnMap?.[action.target] ?? action.target;
    return [
      {
        row: options.rowIndex + 2,
        column: columnName,
        value: stdout,
      },
    ];
  } catch (error) {
    // Clean up temp file on error
    try {
      unlinkSync(tmpFile);
    } catch {
      // Best-effort cleanup
    }

    // Check for specific error types
    if (error instanceof Error && error.message.includes("timed out")) {
      const errorAction = resolveAiErrorAction(action.onError, 1);
      if (errorAction === "skip") return [];
      throw new Error(`AI action "${action.id}" timed out after ${timeout}ms`);
    }

    throw error;
  }
}
