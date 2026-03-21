import type { OnMissingCallback } from "./template.js";
import type { Adapter, ExecutionContext, LookupAction, Row } from "./types.js";
export interface LookupOptions {
    adapter: Adapter;
    spreadsheetId: string;
    /** Shared cache of tab data, keyed by tab name. Populated lazily on first access. */
    tabDataCache: Map<string, Row[]>;
    onMissing?: OnMissingCallback;
}
/**
 * Execute a lookup action: read rows from a source tab, match on a column,
 * and return the value of a specified return column.
 *
 * In "first" mode (default), returns the first matched value as a string.
 * In "all" mode, returns all matched values as a JSON array string.
 */
export declare function executeLookup(action: LookupAction, context: ExecutionContext, options: LookupOptions): Promise<string | null>;
