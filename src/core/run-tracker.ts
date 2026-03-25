import type { RunPipelineOptions } from "./engine.js";
import type { RunState } from "./run-state.js";
import { pruneRuns, writeRunState } from "./run-state.js";

/**
 * Create callback hooks that track run state and write to disk.
 *
 * The returned callbacks should be composed with any user-provided callbacks,
 * not replace them.
 */
export function createRunTracker(state: RunState): {
  onRowStart: NonNullable<RunPipelineOptions["onRowStart"]>;
  onActionComplete: NonNullable<RunPipelineOptions["onActionComplete"]>;
  onError: NonNullable<RunPipelineOptions["onError"]>;
  onRowComplete: NonNullable<RunPipelineOptions["onRowComplete"]>;
  finalize: (aborted: boolean) => Promise<void>;
} {
  const startTime = Date.now();

  return {
    onRowStart: (_rowIndex, _row) => {
      // No-op — reserved for future row-level tracking
    },

    onActionComplete: (_rowIndex, actionId, value) => {
      const action = state.actionSummaries.find((s) => s.actionId === actionId);
      if (!action) return;

      if (value === "__SKIPPED__" || value === null) {
        action.skipped++;
      } else {
        action.success++;
      }
    },

    onError: (rowIndex, actionId, error) => {
      const action = state.actionSummaries.find((s) => s.actionId === actionId);
      if (action) {
        action.errors++;
      }

      state.errors.push({
        rowIndex: rowIndex + 2, // Convert 0-indexed data row to sheet row number
        actionId,
        error: error.message,
      });
    },

    onRowComplete: (_rowIndex, _updates) => {
      state.processedRows++;
      // Fire-and-forget: checkpoint save after each row (best-effort)
      writeRunState(state).catch(() => {});
    },

    finalize: async (aborted: boolean) => {
      if (aborted) {
        state.status = "aborted";
      } else if (state.errors.length > 0 && state.processedRows === 0) {
        state.status = "failed";
      } else {
        state.status = "completed";
      }

      state.completedAt = new Date().toISOString();
      state.durationMs = Date.now() - startTime;

      await writeRunState(state);
      await pruneRuns(50);
    },
  };
}
