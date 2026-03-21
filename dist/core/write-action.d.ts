import type { OnMissingCallback } from "./template.js";
import type { Adapter, ExecutionContext, WriteAction } from "./types.js";
export interface WriteOptions {
    adapter: Adapter;
    spreadsheetId: string;
    dryRun?: boolean;
    onMissing?: OnMissingCallback;
}
/**
 * Execute a write action: resolve column mappings from the current row context
 * and write one or more rows to a destination tab.
 *
 * Returns a status string describing what was written (e.g. "wrote 3 rows to Leads").
 */
export declare function executeWrite(action: WriteAction, context: ExecutionContext, options: WriteOptions): Promise<string | null>;
