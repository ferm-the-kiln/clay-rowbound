import { execSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { Command } from "commander";
import pc from "picocolors";
import { extractSheetId } from "./init.js";

const DASHBOARD_URL = "https://dashboard-beta-sable-36.vercel.app";
const PLIST_LABEL = "com.clay.rowbound-watch";

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function step(n: number, text: string) {
  console.log(`\n${pc.bold(pc.cyan(`[${n}/5]`))} ${pc.bold(text)}`);
}

function check(text: string) {
  console.log(`  ${pc.green("✓")} ${text}`);
}

function skip(text: string) {
  console.log(`  ${pc.dim("–")} ${pc.dim(text)}`);
}

function fail(text: string) {
  console.log(`  ${pc.red("✗")} ${text}`);
}

function commandExists(cmd: string): boolean {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

export function registerSetup(program: Command): void {
  program
    .command("setup")
    .description(
      "One-command setup wizard — installs dependencies, authenticates Google, configures auto-start",
    )
    .option("--sheet <id>", "Google Sheet ID or URL to connect")
    .option("--skip-launchagent", "Skip LaunchAgent auto-start setup")
    .action(async (opts: { sheet?: string; skipLaunchagent?: boolean }) => {
      console.log(
        pc.bold(
          "\n🏗  Clay Rowbound Setup\n",
        ),
      );
      console.log(
        pc.dim(
          "This wizard will set up everything you need to run enrichments.\n",
        ),
      );

      // ---------------------------------------------------------------
      // Step 1: Check gws CLI
      // ---------------------------------------------------------------
      step(1, "Google Workspace CLI (gws)");

      if (commandExists("gws")) {
        check("gws is installed");

        // Check if authenticated
        try {
          execFileSync("gws", ["sheets", "spreadsheets", "create", "--json", '{"properties":{"title":"_clay_auth_test"}}', "--format", "json"], {
            stdio: "pipe",
            timeout: 15000,
          });
          check("gws is authenticated");
        } catch {
          console.log(
            `  ${pc.yellow("!")} gws needs authentication`,
          );
          console.log(
            pc.dim("    Running: gws auth setup\n"),
          );
          try {
            execSync("gws auth setup", { stdio: "inherit" });
            check("gws authenticated successfully");
          } catch {
            fail(
              "gws auth failed. Run 'gws auth setup' manually and try again.",
            );
            process.exitCode = 1;
            return;
          }
        }
      } else {
        console.log(`  ${pc.yellow("!")} gws not found — installing...`);
        try {
          execSync("npm install -g @googleworkspace/cli", {
            stdio: "inherit",
          });
          check("gws installed");
          console.log(
            pc.dim("\n    Now let's authenticate with Google:\n"),
          );
          execSync("gws auth setup", { stdio: "inherit" });
          check("gws authenticated");
        } catch {
          fail(
            "Failed to install gws. Run 'npm install -g @googleworkspace/cli' manually.",
          );
          process.exitCode = 1;
          return;
        }
      }

      // ---------------------------------------------------------------
      // Step 2: Check Claude Code
      // ---------------------------------------------------------------
      step(2, "Claude Code CLI");

      if (commandExists("claude")) {
        check("Claude Code is installed");
      } else {
        fail(
          "Claude Code not found. Install it from https://claude.ai/code",
        );
        console.log(
          pc.dim(
            "    You need a Claude Code Max subscription for enrichments.\n",
          ),
        );
        const cont = await ask("  Continue without Claude? (y/n): ");
        if (cont.toLowerCase() !== "y") {
          process.exitCode = 1;
          return;
        }
      }

      // ---------------------------------------------------------------
      // Step 3: Connect Google Sheet
      // ---------------------------------------------------------------
      step(3, "Connect a Google Sheet");

      let sheetId = opts.sheet ? extractSheetId(opts.sheet) : "";

      if (!sheetId) {
        console.log(
          pc.dim(
            "  Paste a Google Sheet URL or ID. This is where your enrichment data lives.\n",
          ),
        );
        const input = await ask("  Sheet URL or ID: ");
        sheetId = extractSheetId(input);
      }

      if (!sheetId) {
        fail("No sheet ID provided. You can connect one later in Settings.");
      } else {
        check(`Connected to sheet: ${pc.dim(sheetId)}`);

        // Initialize Rowbound config on the sheet
        try {
          execFileSync(
            process.argv[0]!,
            [process.argv[1]!, "init", sheetId],
            { stdio: "pipe" },
          );
          check("Rowbound config initialized on sheet");
        } catch {
          skip("Sheet already has Rowbound config (or init skipped)");
        }
      }

      // ---------------------------------------------------------------
      // Step 4: LaunchAgent (auto-start)
      // ---------------------------------------------------------------
      step(4, "Auto-start on login");

      if (opts.skipLaunchagent || process.platform !== "darwin") {
        skip("LaunchAgent setup skipped");
      } else if (sheetId) {
        const plistDir = join(homedir(), "Library", "LaunchAgents");
        const plistPath = join(plistDir, `${PLIST_LABEL}.plist`);

        // Find rowbound binary
        let rowboundBin = "";
        try {
          rowboundBin = execSync("which rowbound", { encoding: "utf-8" }).trim();
        } catch {
          rowboundBin = process.argv[1] ?? "rowbound";
        }

        const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${PLIST_LABEL}</string>
  <key>ProgramArguments</key>
  <array>
    <string>${rowboundBin}</string>
    <string>watch</string>
    <string>${sheetId}</string>
    <string>--port</string>
    <string>3000</string>
  </array>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>/tmp/rowbound-watch.log</string>
  <key>StandardErrorPath</key>
  <string>/tmp/rowbound-watch-error.log</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>PATH</key>
    <string>/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin</string>
  </dict>
</dict>
</plist>`;

        try {
          // Unload existing if present
          try {
            execSync(`launchctl unload "${plistPath}" 2>/dev/null`, {
              stdio: "ignore",
            });
          } catch {
            // not loaded, fine
          }

          mkdirSync(plistDir, { recursive: true });
          writeFileSync(plistPath, plistContent);
          execSync(`launchctl load "${plistPath}"`);
          check("LaunchAgent installed — Rowbound will auto-start on login");
        } catch {
          fail(
            "LaunchAgent setup failed. You can start manually: rowbound watch " +
              sheetId,
          );
        }
      } else {
        skip("No sheet connected — skipping LaunchAgent");
      }

      // ---------------------------------------------------------------
      // Step 5: Done!
      // ---------------------------------------------------------------
      step(5, "Ready!");

      console.log(
        `\n  ${pc.green(pc.bold("Setup complete!"))} Here's what to do next:\n`,
      );

      if (sheetId) {
        console.log(
          `  ${pc.bold("1.")} Open the dashboard: ${pc.cyan(DASHBOARD_URL)}`,
        );
        console.log(
          `  ${pc.bold("2.")} Go to Settings and add your sheet ID: ${pc.dim(sheetId)}`,
        );
        console.log(
          `  ${pc.bold("3.")} Navigate to Enrich → upload a CSV → pick a skill → run!`,
        );
      } else {
        console.log(
          `  ${pc.bold("1.")} Open the dashboard: ${pc.cyan(DASHBOARD_URL)}`,
        );
        console.log(
          `  ${pc.bold("2.")} Go to Settings to connect a Google Sheet`,
        );
        console.log(
          `  ${pc.bold("3.")} Start Rowbound: ${pc.dim("rowbound watch <sheet-id>")}`,
        );
      }

      console.log(
        `\n  ${pc.dim("Logs: /tmp/rowbound-watch.log")}`,
      );
      console.log(
        `  ${pc.dim("Dashboard: " + DASHBOARD_URL)}`,
      );
      console.log();
    });
}
