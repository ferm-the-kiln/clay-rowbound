import type { Adapter, SheetRef } from "./types.js";

const STATUS_SHEET_NAME = "_rowbound_status";
const CHECKPOINT_INTERVAL = 100;

export interface CellStatus {
  tab: string;
  row: number;
  actionId: string;
  status: "pending" | "running" | "success" | "error" | "skipped";
  timestamp: string;
  errorMessage?: string;
  durationMs?: number;
}

/**
 * In-memory accumulator for per-cell enrichment status.
 * Accumulates status entries during a pipeline run, then batch-writes
 * to a hidden _rowbound_status sheet at the end (or every N rows as checkpoint).
 */
export class StatusAccumulator {
  private entries: CellStatus[] = [];
  private rowsSinceCheckpoint = 0;
  private nextRow = 2; // Start after header row; persists across flushes
  private adapter: Adapter;
  private spreadsheetId: string;
  private tabName: string;

  constructor(adapter: Adapter, spreadsheetId: string, tabName: string) {
    this.adapter = adapter;
    this.spreadsheetId = spreadsheetId;
    this.tabName = tabName;
  }

  /**
   * Record the status of a cell (action execution result).
   */
  record(entry: Omit<CellStatus, "tab" | "timestamp">): void {
    this.entries.push({
      ...entry,
      tab: this.tabName,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Call after each row is processed. Triggers a checkpoint write
   * every CHECKPOINT_INTERVAL rows to avoid data loss on crash.
   */
  async onRowComplete(): Promise<void> {
    this.rowsSinceCheckpoint++;
    if (this.rowsSinceCheckpoint >= CHECKPOINT_INTERVAL) {
      await this.flush();
      this.rowsSinceCheckpoint = 0;
    }
  }

  /**
   * Flush all accumulated status entries to the hidden status sheet.
   * Called at the end of a run (and periodically as checkpoints).
   */
  async flush(): Promise<void> {
    if (this.entries.length === 0) return;

    try {
      const ref: SheetRef = {
        spreadsheetId: this.spreadsheetId,
        sheetName: STATUS_SHEET_NAME,
      };

      // Build rows for the status sheet.
      // Each entry becomes one row with tab-separated fields in the "status" column.
      // nextRow persists across flushes so checkpoints don't overwrite each other.
      const updates = this.entries.map((entry, idx) => ({
        row: this.nextRow + idx,
        column: "status",
        value: `${entry.tab}\t${entry.row}\t${entry.actionId}\t${entry.status}\t${entry.timestamp}\t${entry.errorMessage ?? ""}\t${entry.durationMs ?? ""}`,
      }));
      this.nextRow += this.entries.length;

      await this.adapter.writeBatch(ref, updates);
    } catch (error) {
      // Status sheet write failures should not crash the pipeline.
      // Log and continue.
      console.warn(
        `Warning: failed to write status to ${STATUS_SHEET_NAME}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Clear accumulated entries after successful flush
    this.entries = [];
  }

  /**
   * Get all accumulated entries (for testing).
   */
  getEntries(): readonly CellStatus[] {
    return this.entries;
  }
}
