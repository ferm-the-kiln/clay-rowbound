import type { ExecutionContext } from "./types.js";

/**
 * Callback invoked when a template variable resolves to undefined.
 * @param source - "row" or "env"
 * @param key - the variable name that was missing
 */
export type OnMissingCallback = (source: string, key: string) => void;

/**
 * Resolve template strings like {{row.email}}, {{env.API_KEY}}, or {{email}}.
 * Variables without a prefix (e.g. {{email}}) default to the row namespace.
 * Missing variables resolve to empty string.
 *
 * When `onMissing` is provided, it is called for every variable that
 * resolves to `undefined` in the given context.
 */
export function resolveTemplate(
  template: string,
  context: ExecutionContext,
  onMissing?: OnMissingCallback,
): string {
  const TEMPLATE_REGEX = /\{\{(?:(row|env|item)\.)?([^}]+)\}\}/g;
  return template.replace(
    TEMPLATE_REGEX,
    (_match, rawSource: string | undefined, key: string) => {
      const source = rawSource ?? "row";
      if (source === "row") {
        const value = context.row[key];
        if (value === undefined && onMissing) {
          onMissing(source, key);
        }
        return value ?? "";
      }
      if (source === "env") {
        const value = context.env[key];
        if (value === undefined && onMissing) {
          onMissing(source, key);
        }
        return value ?? "";
      }
      if (source === "item") {
        const value = context.item?.[key];
        if (value === undefined && onMissing) {
          onMissing(source, key);
        }
        return value ?? "";
      }
      return "";
    },
  );
}

/**
 * Resolve template strings with an escape function applied to each resolved value.
 *
 * Used for shell contexts where row/env values must be sanitized before
 * interpolation (e.g., shell-escaping to prevent command injection).
 * The escape function is applied to each resolved placeholder value,
 * NOT to static parts of the template.
 */
export function resolveTemplateEscaped(
  template: string,
  context: ExecutionContext,
  escapeFn: (value: string) => string,
  onMissing?: OnMissingCallback,
): string {
  const TEMPLATE_REGEX = /\{\{(?:(row|env|item)\.)?([^}]+)\}\}/g;
  return template.replace(
    TEMPLATE_REGEX,
    (_match, rawSource: string | undefined, key: string) => {
      const source = rawSource ?? "row";
      let value: string | undefined;
      if (source === "row") {
        value = context.row[key];
      } else if (source === "env") {
        value = context.env[key];
      } else if (source === "item") {
        value = context.item?.[key];
      }
      if (value === undefined && onMissing) {
        onMissing(source, key);
      }
      return escapeFn(value ?? "");
    },
  );
}

/** Maximum recursion depth for resolveObject to prevent stack overflow. */
const MAX_RESOLVE_DEPTH = 20;

/**
 * Recursively resolve templates in an object/array/string.
 * - Strings: resolve template placeholders
 * - Arrays: resolve each element
 * - Objects: resolve each value (keys are not resolved)
 * - Other types: pass through unchanged
 */
export function resolveObject(
  obj: unknown,
  context: ExecutionContext,
  onMissing?: OnMissingCallback,
  depth = 0,
): unknown {
  if (depth > MAX_RESOLVE_DEPTH) {
    throw new Error(
      `resolveObject exceeded maximum recursion depth of ${MAX_RESOLVE_DEPTH}`,
    );
  }

  if (typeof obj === "string") {
    return resolveTemplate(obj, context, onMissing);
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      resolveObject(item, context, onMissing, depth + 1),
    );
  }

  if (obj !== null && typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype")
        continue;
      result[key] = resolveObject(value, context, onMissing, depth + 1);
    }
    return result;
  }

  // Numbers, booleans, null, undefined — pass through
  return obj;
}
