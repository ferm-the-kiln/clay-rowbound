import { execSync } from "node:child_process";
import type { Command } from "commander";
import pc from "picocolors";
import { SheetsAdapter } from "../adapters/sheets/sheets-adapter.js";
import { extractSheetId } from "./init.js";
import { bold, dim, error, warn } from "./format.js";

const DASHBOARD_PORT = 3000;

const SKILL_INFO: Record<string, { name: string; category: string }> = {
  "company-research": { name: "Company Research", category: "research" },
  "people-research": { name: "People Research", category: "research" },
  "competitor-research": { name: "Competitor Research", category: "research" },
  "email-gen": { name: "Email Generator", category: "content" },
  "linkedin-note": { name: "LinkedIn Note", category: "content" },
  "follow-up": { name: "Follow-up", category: "content" },
  "sequence-writer": { name: "Sequence Writer", category: "content" },
  "classify": { name: "Classify Titles", category: "data" },
  "company-qualifier": { name: "Qualify Companies", category: "data" },
  "quality-gate": { name: "Quality Gate", category: "content" },
  "account-researcher": { name: "Account Researcher", category: "strategy" },
  "meeting-prep": { name: "Meeting Prep", category: "strategy" },
  "discovery-questions": { name: "Discovery Questions", category: "strategy" },
  "competitive-response": { name: "Competitive Response", category: "strategy" },
  "champion-enabler": { name: "Champion Enabler", category: "strategy" },
  "campaign-brief": { name: "Campaign Brief", category: "strategy" },
  "multi-thread-mapper": { name: "Multi-Thread Mapper", category: "strategy" },
};

export function registerEnrich(program: Command): void {
  program
    .command("enrich")
    .description(
      "Run an enrichment on a Google Sheet — sets everything up automatically",
    )
    .argument("<sheetId>", "Google Sheet ID or URL")
    .option("--skill <id>", "Skill to run (e.g. company-research, email-gen)")
    .option("--target <column>", "Target column name for results (default: auto)")
    .option("--no-open", "Don't open the dashboard in the browser")
    .action(
      async (
        rawSheetId: string,
        opts: { skill?: string; target?: string; open?: boolean },
      ) => {
        const sheetId = extractSheetId(rawSheetId);
        if (sheetId !== rawSheetId) {
          console.log(dim(`  Extracted sheet ID: ${sheetId}`));
        }

        console.log(bold("\n  Clay Enrichment Runner\n"));

        // ---------------------------------------------------------------
        // 1. Check prerequisites
        // ---------------------------------------------------------------
        console.log(dim("  Checking environment...\n"));

        // gws
        try {
          execSync("which gws", { stdio: "ignore" });
          console.log(`  ${pc.green("✓")} gws CLI`);
        } catch {
          console.log(`  ${pc.red("✗")} gws CLI not found`);
          console.log(
            dim("    Install: npm install -g @googleworkspace/cli"),
          );
          console.log(dim("    Then: gws auth login"));
          process.exitCode = 1;
          return;
        }

        // claude
        try {
          execSync("which claude", { stdio: "ignore" });
          console.log(`  ${pc.green("✓")} Claude Code`);
        } catch {
          console.log(`  ${pc.red("✗")} Claude Code not found`);
          console.log(dim("    Install from: https://claude.ai/code"));
          process.exitCode = 1;
          return;
        }

        // ---------------------------------------------------------------
        // 2. Pick skill if not specified
        // ---------------------------------------------------------------
        let skillId = opts.skill;
        if (!skillId) {
          console.log(
            `\n  ${bold("Available skills:")}\n`,
          );

          const categories = new Map<string, string[]>();
          for (const [id, info] of Object.entries(SKILL_INFO)) {
            const cat = info.category;
            if (!categories.has(cat)) categories.set(cat, []);
            categories.get(cat)!.push(`${dim(id.padEnd(22))} ${info.name}`);
          }

          for (const [cat, skills] of categories) {
            console.log(`  ${bold(cat.charAt(0).toUpperCase() + cat.slice(1))}`);
            for (const s of skills) {
              console.log(`    ${s}`);
            }
            console.log();
          }

          console.log(
            dim("  Usage: rowbound enrich <sheetId> --skill company-research\n"),
          );
          process.exitCode = 1;
          return;
        }

        const skillInfo = SKILL_INFO[skillId];
        if (!skillInfo) {
          console.log(error(`  Unknown skill: ${skillId}`));
          console.log(
            dim(
              `  Available: ${Object.keys(SKILL_INFO).join(", ")}`,
            ),
          );
          process.exitCode = 1;
          return;
        }

        const targetColumn = opts.target ?? skillInfo.name;

        console.log(`\n  ${bold("Enrichment:")} ${skillInfo.name}`);
        console.log(`  ${bold("Sheet:")} ${dim(sheetId)}`);
        console.log(`  ${bold("Target column:")} ${targetColumn}`);

        // ---------------------------------------------------------------
        // 3. Set up sheet config
        // ---------------------------------------------------------------
        console.log(dim("\n  Setting up sheet...\n"));

        const adapter = new SheetsAdapter();
        const ref = { spreadsheetId: sheetId, sheetName: "Sheet1" };

        // Init config if needed
        try {
          const existing = await adapter.readConfig(ref);
          if (!existing) {
            // Need to init — get the GID first
            const sheets = await adapter.listSheets(sheetId);
            const targetSheet = sheets.find((s) => s.name === "Sheet1") ?? sheets[0];
            if (!targetSheet) {
              console.log(error("  No sheets found in spreadsheet"));
              process.exitCode = 1;
              return;
            }

            const { defaultSettings } = await import("../core/defaults.js");
            const gid = String(targetSheet.gid);
            await adapter.writeConfig(ref, {
              version: "2",
              tabs: {
                [gid]: {
                  name: targetSheet.name,
                  columns: {},
                  actions: [],
                },
              },
              actions: [],
              settings: defaultSettings,
            });
            console.log(`  ${pc.green("✓")} Initialized Rowbound config`);
          } else {
            console.log(`  ${pc.green("✓")} Config exists`);
          }
        } catch (err) {
          console.log(
            error(
              `  Failed to read/init config: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
          process.exitCode = 1;
          return;
        }

        // Add target column header if missing
        try {
          const headers = await adapter.getHeaders(ref);
          if (!headers.includes(targetColumn)) {
            const nextCol = String.fromCharCode(65 + headers.length); // A=0, B=1, etc.
            const { runGws } = await import(
              "../adapters/sheets/sheets-adapter.js"
            );
            await runGws([
              "sheets",
              "spreadsheets",
              "values",
              "update",
              "--params",
              JSON.stringify({
                spreadsheetId: sheetId,
                range: `Sheet1!${nextCol}1`,
                valueInputOption: "USER_ENTERED",
              }),
              "--json",
              JSON.stringify({
                range: `Sheet1!${nextCol}1`,
                values: [[targetColumn]],
              }),
              "--format",
              "json",
            ]);
            console.log(
              `  ${pc.green("✓")} Added "${targetColumn}" column`,
            );
          } else {
            console.log(
              `  ${pc.green("✓")} "${targetColumn}" column exists`,
            );
          }
        } catch (err) {
          console.log(
            warn(
              `  Could not verify target column: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
        }

        // Add skill action to config if not present
        try {
          const config = await adapter.readConfig(ref);
          const actionExists = config?.actions?.some(
            (a) => a.id === skillId,
          );
          if (!actionExists) {
            // Use the CLI's config add-action logic
            const { registerConfig } = await import("./config.js");
            // Simpler: just write the action directly
            if (config) {
              config.actions.push({
                id: skillId!,
                type: "skill" as any,
                target: targetColumn,
                skillId: skillId!,
                cacheKey: "{{row.Domain}}",
              } as any);
              await adapter.writeConfig(ref, config);
              console.log(
                `  ${pc.green("✓")} Added "${skillId}" action`,
              );
            }
          } else {
            console.log(
              `  ${pc.green("✓")} "${skillId}" action configured`,
            );
          }
        } catch (err) {
          console.log(
            warn(
              `  Could not add action: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
        }

        // ---------------------------------------------------------------
        // 4. Open dashboard
        // ---------------------------------------------------------------
        if (opts.open !== false) {
          try {
            // Check if dashboard is running
            const healthCheck = await fetch(
              `http://localhost:${DASHBOARD_PORT}/api/skills`,
            ).catch(() => null);
            if (healthCheck?.ok) {
              const url = `http://localhost:${DASHBOARD_PORT}/tables/${sheetId}`;
              execSync(`open "${url}"`);
              console.log(
                `\n  ${pc.green("✓")} Dashboard: ${pc.cyan(url)}`,
              );
            } else {
              const sheetUrl = `https://docs.google.com/spreadsheets/d/${sheetId}`;
              execSync(`open "${sheetUrl}"`);
              console.log(
                `\n  ${pc.green("✓")} Opened Google Sheet ${dim("(dashboard not running)")}`,
              );
            }
          } catch {
            // Non-critical
          }
        }

        // ---------------------------------------------------------------
        // 5. Run the enrichment!
        // ---------------------------------------------------------------
        console.log(
          `\n  ${pc.bold(pc.cyan("Running enrichment..."))}\n`,
        );

        try {
          const { runPipeline } = await import("../core/engine.js");
          const { buildSafeEnv } = await import("../core/env.js");
          const { reconcile } = await import("../core/reconcile.js");

          const config = await adapter.readConfig(ref);
          if (!config) {
            console.log(error("  No config found"));
            process.exitCode = 1;
            return;
          }

          // Reconcile columns
          const reconResult = await reconcile(adapter, ref, config);
          if (reconResult.configChanged) {
            await adapter.writeConfig(ref, reconResult.config);
          }

          const env = buildSafeEnv(config);

          const result = await runPipeline({
            adapter,
            ref,
            config,
            env,
            columnMap: config.tabs
              ? Object.values(config.tabs)[0]?.columns
              : config.columns,
            onTotalRows: (total) => {
              console.log(dim(`  ${total} rows to process\n`));
            },
            onRowStart: (idx) => {
              process.stdout.write(
                `  Row ${idx + 1}... `,
              );
            },
            onActionComplete: (_idx, actionId, value) => {
              if (value && value !== "__SKIPPED__") {
                // Show a preview of the result
                const preview =
                  value.length > 80
                    ? value.slice(0, 80) + "..."
                    : value;
                console.log(pc.green("✓ ") + dim(preview));
              } else if (value === "__SKIPPED__") {
                console.log(dim("– skipped (already has value)"));
              }
            },
            onError: (_idx, actionId, err) => {
              console.log(pc.red("✗ ") + err.message.slice(0, 80));
            },
          });

          // ---------------------------------------------------------------
          // 6. Summary
          // ---------------------------------------------------------------
          console.log(
            `\n  ${pc.bold("─── Results ───")}\n`,
          );
          console.log(
            `  Rows processed: ${bold(String(result.processedRows))}`,
          );
          console.log(
            `  Cells updated:  ${bold(String(result.updates))}`,
          );
          if (result.errors.length > 0) {
            console.log(
              `  Errors:         ${pc.red(String(result.errors.length))}`,
            );
          }
          console.log(
            `\n  ${pc.green("Done!")} Results are in your Google Sheet.`,
          );
          console.log(
            dim(
              `  https://docs.google.com/spreadsheets/d/${sheetId}\n`,
            ),
          );
        } catch (err) {
          console.log(
            error(
              `\n  Enrichment failed: ${err instanceof Error ? err.message : String(err)}`,
            ),
          );
          process.exitCode = 1;
        }
      },
    );
}
