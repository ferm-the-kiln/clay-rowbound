import type { Command } from "commander";
import { SheetsAdapter } from "../adapters/sheets/sheets-adapter.js";
import { runPipeline } from "../core/engine.js";
import { buildSafeEnv } from "../core/env.js";
import { parseColumnSpec, parseRowSpec } from "../core/range-parser.js";
import { cleanupOrphanedRanges, reconcile } from "../core/reconcile.js";
import { createRunState } from "../core/run-state.js";
import { createRunTracker } from "../core/run-tracker.js";
import { bold, dim, error, success, warn } from "./format.js";

export function registerRun(program: Command): void {
  program
    .command("run")
    .description("Run the enrichment pipeline")
    .argument("<sheetId>", "Google Sheets spreadsheet ID")
    .option("--tab <name>", "Sheet tab name", "Sheet1")
    .option(
      "--rows <spec>",
      "Rows to process (e.g. 2-50, 2,5,8, or 2-5,8,10-12)",
    )
    .option(
      "--columns <spec>",
      "Column letters to process (e.g. A-C, A,C,E, or A-C,E,G-J)",
    )
    .option("--dry-run", "Dry run — compute but do not write back", false)
    .option("--json", "Output result as JSON")
    .option("-q, --quiet", "Suppress per-row output, show only final summary")
    .action(
      async (
        sheetId: string,
        opts: {
          tab: string;
          rows?: string;
          columns?: string;
          dryRun: boolean;
          json: boolean;
          quiet: boolean;
        },
      ) => {
        const adapter = new SheetsAdapter();
        const ref = { spreadsheetId: sheetId, sheetName: opts.tab };
        const jsonMode = opts.json ?? false;
        const quietMode = opts.quiet ?? false;

        /** Log only when not in --json mode */
        const log = (msg: string) => {
          if (!jsonMode) console.log(msg);
        };
        const logErr = (msg: string) => {
          if (!jsonMode) console.error(msg);
        };

        try {
          const config = await adapter.readConfig(ref);
          if (!config) {
            logErr(
              error("No Rowbound config found.") +
                " Run 'rowbound init <sheetId>' first.",
            );
            process.exitCode = 1;
            return;
          }

          // Reconcile column registry (detect renames, track new columns, migrate v1→v2)
          const reconciled = await reconcile(adapter, ref, config);

          if (reconciled.messages.length > 0) {
            log(dim("\u21BB Reconciling columns..."));
            for (const msg of reconciled.messages) {
              log(`  ${dim(msg)}`);
            }
            log("");
          }

          if (reconciled.configChanged) {
            await adapter.writeConfig(ref, reconciled.config);
          }
          if (reconciled.orphanedRanges.length > 0) {
            await cleanupOrphanedRanges(
              adapter,
              ref,
              reconciled.orphanedRanges,
            );
          }

          const tabConfig = reconciled.tabConfig;

          if (tabConfig.enabled === false) {
            logErr(warn("Tab is disabled. Skipping pipeline run."));
            return;
          }

          if (tabConfig.actions.length === 0) {
            logErr(
              error("No actions configured.") +
                " Add actions with 'rowbound config add-action'.",
            );
            process.exitCode = 1;
            return;
          }

          // Parse --rows spec
          let rowSet: Set<number> | undefined;
          if (opts.rows) {
            try {
              rowSet = new Set(
                [...parseRowSpec(opts.rows)].map((r) => r - 2), // sheet row 2 = data index 0
              );
            } catch (err) {
              logErr(
                error(
                  err instanceof Error ? err.message : "Invalid --rows format.",
                ),
              );
              process.exitCode = 1;
              return;
            }
          }

          // Parse --columns spec and resolve to action IDs
          let actionFilter: string | undefined;
          let columnFilterLabel: string | undefined;
          if (opts.columns) {
            try {
              const colLetters = parseColumnSpec(opts.columns);
              columnFilterLabel = [...colLetters].join(",");
              // Build reverse map: column letter → column ID → action targets
              const headers = await adapter.getHeaders(ref);
              const colIdsToRun = new Set<string>();
              for (const letter of colLetters) {
                let colIdx = 0;
                for (let i = 0; i < letter.length; i++) {
                  colIdx = colIdx * 26 + (letter.charCodeAt(i) - 64);
                }
                colIdx -= 1; // 0-based
                const headerName = headers[colIdx];
                if (!headerName) continue;
                // Find the column ID for this header name
                for (const [id, name] of Object.entries(tabConfig.columns)) {
                  if (name === headerName) {
                    colIdsToRun.add(id);
                    break;
                  }
                }
              }
              // Filter actions to only those targeting these columns
              const matchingActions = tabConfig.actions.filter((a) =>
                colIdsToRun.has(a.target),
              );
              if (matchingActions.length === 0) {
                logErr(
                  error(`No actions target columns ${columnFilterLabel}.`),
                );
                process.exitCode = 1;
                return;
              }
              // Use action IDs as filter
              actionFilter = matchingActions.map((a) => a.id).join(",");
            } catch (err) {
              logErr(
                error(
                  err instanceof Error
                    ? err.message
                    : "Invalid --columns format.",
                ),
              );
              process.exitCode = 1;
              return;
            }
          }

          const resolvedConfig = {
            ...reconciled.config,
            actions: tabConfig.actions,
            scripts: {
              ...(reconciled.config.scripts || {}),
              ...(tabConfig.scripts || {}),
            },
            settings: {
              ...reconciled.config.settings,
              ...(tabConfig.settings || {}),
            },
          };

          // No separate range var needed — rowSet handles all cases now

          // Build filtered env (only ROWBOUND_*, referenced {{env.X}}, NODE_ENV, PATH)
          const env = buildSafeEnv(resolvedConfig);

          // Set up abort controller for graceful shutdown
          const controller = new AbortController();

          const shutdown = () => {
            if (controller.signal.aborted) {
              log(warn("\nForce quitting..."));
              process.exit(130);
            }
            log(
              warn(
                "\nShutting down gracefully (Ctrl+C again to force quit)...",
              ),
            );
            controller.abort();
          };
          process.on("SIGINT", shutdown);
          process.on("SIGTERM", shutdown);

          // Create run state for tracking
          const state = createRunState({
            sheetId,
            sheetName: opts.tab,
            config: resolvedConfig,
            totalRows: 0, // Will be set after runPipeline returns
            dryRun: opts.dryRun,
            actionFilter,
          });
          const tracker = createRunTracker(state);

          if (opts.dryRun) {
            log(warn("DRY RUN — no writes will be made\n"));
          }

          log(`Running pipeline on sheet ${dim(sheetId)}...`);
          if (columnFilterLabel) {
            log(`Columns: ${bold(columnFilterLabel)}`);
          }
          if (opts.rows) {
            log(`Rows: ${bold(opts.rows)}`);
          }
          log("");

          // Track total rows for progress display
          let totalRowsToProcess = 0;
          let currentRow = 0;

          const result = await runPipeline({
            adapter,
            ref,
            config: resolvedConfig,
            env,
            rowSet,
            actionFilter,
            dryRun: opts.dryRun,
            signal: controller.signal,
            columnMap: tabConfig.columns,
            checkEnabled: async () => {
              try {
                const freshConfig = await adapter.readConfig(ref);
                if (!freshConfig?.tabs) return true;
                const tab = freshConfig.tabs[reconciled.tabGid];
                return tab?.enabled !== false;
              } catch {
                return true;
              }
            },
            onTotalRows: (total) => {
              totalRowsToProcess = total;
            },
            onRowStart: (rowIndex, row) => {
              tracker.onRowStart(rowIndex, row);
              currentRow++;
              if (!quietMode) {
                const progress =
                  totalRowsToProcess > 0
                    ? `Processing row ${currentRow} of ${totalRowsToProcess}...`
                    : `Processing row ${rowIndex + 2}...`;
                log(progress);
              }
            },
            onActionComplete: (rowIndex, actionId, value) => {
              tracker.onActionComplete(rowIndex, actionId, value);
              if (!quietMode) {
                if (value === "__SKIPPED__") {
                  log(`  ${dim("-")} ${actionId}: ${dim("skipped")}`);
                } else if (value !== null) {
                  log(`  ${success("\u2713")} ${actionId}: ${value}`);
                } else {
                  log(`  ${dim("~")} ${actionId}: ${dim("no result")}`);
                }
              }
            },
            onError: (rowIndex, actionId, err) => {
              tracker.onError(rowIndex, actionId, err);
              if (!quietMode) {
                log(`  ${error("\u2717")} ${actionId}: ${error(err.message)}`);
              }
            },
            onRowComplete: (rowIndex, updates) => {
              tracker.onRowComplete(rowIndex, updates);
            },
          });

          // Finalize run tracking
          state.totalRows = result.totalRows;
          await tracker.finalize(controller.signal.aborted);

          if (controller.signal.aborted) {
            process.exitCode = 130;
          }

          if (jsonMode) {
            console.log(JSON.stringify(result, null, 2));
          } else {
            // Print summary
            console.log(`\n${bold("--- Summary ---")}`);
            console.log(`Run ID:         ${dim(state.runId)}`);
            console.log(
              `Rows processed: ${bold(String(result.processedRows))}`,
            );
            console.log(`Cell updates:   ${bold(String(result.updates))}`);
            console.log(
              `Errors:         ${result.errors.length > 0 ? error(String(result.errors.length)) : success(String(result.errors.length))}`,
            );
            if (result.skippedRows > 0) {
              console.log(
                `Rows skipped:   ${warn(String(result.skippedRows))}`,
              );
            }

            if (result.errors.length > 0) {
              console.log(`\n${error("Errors:")}`);
              for (const err of result.errors) {
                console.log(
                  `  Row ${err.rowIndex + 2}, action "${err.actionId}": ${error(err.error)}`,
                );
              }
            }
          }

          // Clean up signal handlers
          process.removeListener("SIGINT", shutdown);
          process.removeListener("SIGTERM", shutdown);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (jsonMode) {
            console.log(JSON.stringify({ error: msg }, null, 2));
          } else {
            console.error(error("Pipeline failed:"), msg);
          }
          process.exitCode = 1;
        }
      },
    );
}
