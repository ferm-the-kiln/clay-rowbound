import { execSync, execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";
import type { Command } from "commander";
import pc from "picocolors";

const DASHBOARD_URL = "https://dashboard-beta-sable-36.vercel.app";
const PLIST_LABEL = "com.clay.rowbound-watch";
const CONFIG_DIR = join(homedir(), ".config", "rowbound");
const ENV_FILE = join(CONFIG_DIR, ".env");

function ask(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

function step(n: number, total: number, text: string) {
  console.log(`\n${pc.bold(pc.cyan(`[${n}/${total}]`))} ${pc.bold(text)}`);
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

function setEnvVar(key: string, value: string) {
  mkdirSync(CONFIG_DIR, { recursive: true });
  let content = "";
  if (existsSync(ENV_FILE)) {
    content = readFileSync(ENV_FILE, "utf-8");
    // Replace existing key or append
    const regex = new RegExp(`^${key}=.*$`, "m");
    if (regex.test(content)) {
      content = content.replace(regex, `${key}=${value}`);
    } else {
      content = `${content.trimEnd()}\n${key}=${value}\n`;
    }
  } else {
    content = `${key}=${value}\n`;
  }
  writeFileSync(ENV_FILE, content, { mode: 0o600 });
}

function getEnvVar(key: string): string | undefined {
  if (!existsSync(ENV_FILE)) return undefined;
  const content = readFileSync(ENV_FILE, "utf-8");
  const match = content.match(new RegExp(`^${key}=(.+)$`, "m"));
  return match?.[1]?.trim();
}

export function registerSetup(program: Command): void {
  program
    .command("setup")
    .description(
      "One-command setup wizard — installs dependencies, authenticates Google, configures Supabase cache",
    )
    .option("--skip-launchagent", "Skip LaunchAgent auto-start setup")
    .action(async (opts: { skipLaunchagent?: boolean }) => {
      console.log(pc.bold("\n  Clay Rowbound Setup\n"));
      console.log(
        pc.dim(
          "  Upload a CSV, pick a skill, run. Sheets are created automatically.\n" +
            "  This wizard sets up everything you need.\n",
        ),
      );

      const totalSteps = 4;

      // ---------------------------------------------------------------
      // Step 1: Google Workspace CLI (gws)
      // ---------------------------------------------------------------
      step(1, totalSteps, "Google Workspace CLI (gws)");
      console.log(
        pc.dim("  Used to create and read Google Sheets automatically.\n"),
      );

      if (commandExists("gws")) {
        check("gws is installed");

        // Quick auth check — try listing a non-existent sheet (will fail with auth error vs 404)
        try {
          execFileSync("gws", ["sheets", "spreadsheets", "get", "--params", '{"spreadsheetId":"test"}', "--format", "json"], {
            stdio: "pipe",
            timeout: 15000,
          });
        } catch (e) {
          const errMsg = e instanceof Error ? e.message : "";
          if (errMsg.includes("401") || errMsg.includes("403") || errMsg.includes("auth") || errMsg.includes("login")) {
            console.log(`  ${pc.yellow("!")} gws needs authentication`);
            console.log(pc.dim("    Running: gws auth setup\n"));
            try {
              execSync("gws auth setup", { stdio: "inherit" });
              check("gws authenticated");
            } catch {
              fail("gws auth failed. Run 'gws auth setup' manually and try again.");
              process.exitCode = 1;
              return;
            }
          } else {
            // 404 is expected for a fake sheet ID — means auth works
            check("gws is authenticated");
          }
        }
      } else {
        console.log(`  ${pc.yellow("!")} gws not found — installing...`);
        try {
          execSync("npm install -g @googleworkspace/cli", { stdio: "inherit" });
          check("gws installed");
          console.log(pc.dim("\n    Now let's authenticate with Google:\n"));
          execSync("gws auth setup", { stdio: "inherit" });
          check("gws authenticated");
        } catch {
          fail("Failed to install gws. Run 'npm install -g @googleworkspace/cli' manually.");
          process.exitCode = 1;
          return;
        }
      }

      // ---------------------------------------------------------------
      // Step 2: Claude Code CLI
      // ---------------------------------------------------------------
      step(2, totalSteps, "Claude Code CLI");
      console.log(
        pc.dim("  Powers the AI enrichments (company research, email gen, etc.)\n"),
      );

      if (commandExists("claude")) {
        check("Claude Code is installed");

        // Check for Max subscription
        console.log(
          pc.dim("  Make sure you have a Claude Code Max subscription for unlimited enrichments."),
        );
      } else {
        fail("Claude Code not found");
        console.log(
          `  ${pc.dim("Install from:")} ${pc.cyan("https://claude.ai/code")}`,
        );
        console.log(
          pc.dim("  You need a Claude Code Max subscription for enrichments.\n"),
        );
        const cont = await ask("  Continue without Claude? (y/n): ");
        if (cont.toLowerCase() !== "y") {
          process.exitCode = 1;
          return;
        }
      }

      // ---------------------------------------------------------------
      // Step 3: Supabase Cache (optional)
      // ---------------------------------------------------------------
      step(3, totalSteps, "Supabase Enrichment Cache");
      console.log(
        pc.dim(
          "  Caches enrichment results so you never re-enrich the same company/person.\n" +
            "  Optional but recommended — saves time and Claude tokens.\n",
        ),
      );

      const existingUrl = getEnvVar("SUPABASE_URL");
      const existingKey = getEnvVar("SUPABASE_ANON_KEY");

      if (existingUrl && existingKey) {
        check(`Supabase already configured: ${pc.dim(existingUrl)}`);
        const update = await ask("  Update Supabase config? (y/n): ");
        if (update.toLowerCase() !== "y") {
          skip("Keeping existing Supabase config");
        } else {
          await configureSupabase();
        }
      } else {
        const setupSupa = await ask("  Set up Supabase cache? (y/n): ");
        if (setupSupa.toLowerCase() === "y") {
          await configureSupabase();
        } else {
          skip("Skipping Supabase — enrichments will run without caching");
        }
      }

      // ---------------------------------------------------------------
      // Step 4: LaunchAgent (auto-start)
      // ---------------------------------------------------------------
      step(4, totalSteps, "Auto-start Rowbound on login");

      if (opts.skipLaunchagent || process.platform !== "darwin") {
        skip("LaunchAgent setup skipped (not macOS or --skip-launchagent)");
      } else {
        console.log(
          pc.dim(
            "  Installs a LaunchAgent so Rowbound's webhook server starts automatically.\n" +
              "  The dashboard talks to this server to trigger enrichments.\n",
          ),
        );

        const setupAgent = await ask("  Install LaunchAgent? (y/n): ");
        if (setupAgent.toLowerCase() === "y") {
          installLaunchAgent();
        } else {
          skip("LaunchAgent skipped — start manually: rowbound watch --port 3000");
        }
      }

      // ---------------------------------------------------------------
      // Done!
      // ---------------------------------------------------------------
      console.log(
        `\n  ${pc.green(pc.bold("Setup complete!"))}\n`,
      );
      console.log(
        `  ${pc.bold("How it works:")}`,
      );
      console.log(
        `  1. Open ${pc.cyan(DASHBOARD_URL)}`,
      );
      console.log(
        `  2. Go to ${pc.bold("Enrich")} → upload a CSV → pick a skill`,
      );
      console.log(
        `  3. Click ${pc.bold("Run Enrichment")} — a Google Sheet is created automatically`,
      );
      console.log(
        `  4. Results appear in the sheet as Claude processes each row`,
      );
      console.log(
        `\n  ${pc.dim("Supabase caches results — re-running the same data is instant.")}`,
      );
      console.log(
        `  ${pc.dim("Dashboard: " + DASHBOARD_URL)}`,
      );
      console.log();
    });
}

async function configureSupabase() {
  console.log(
    pc.dim("\n  Get these from your Supabase project → Settings → API:\n"),
  );

  const url = await ask("  Supabase URL: ");
  if (!url) {
    skip("No URL provided — skipping Supabase");
    return;
  }

  const key = await ask("  Supabase Anon Key: ");
  if (!key) {
    skip("No key provided — skipping Supabase");
    return;
  }

  setEnvVar("SUPABASE_URL", url);
  setEnvVar("SUPABASE_ANON_KEY", key);
  check(`Supabase configured: ${pc.dim(url)}`);
  console.log(pc.dim(`  Saved to: ${ENV_FILE}`));
}

function installLaunchAgent() {
  const plistDir = join(homedir(), "Library", "LaunchAgents");
  const plistPath = join(plistDir, `${PLIST_LABEL}.plist`);

  // Find rowbound binary
  let rowboundBin = "";
  try {
    rowboundBin = execSync("which rowbound", { encoding: "utf-8" }).trim();
  } catch {
    rowboundBin = process.argv[1] ?? "rowbound";
  }

  // No sheet ID needed — watch mode with just --port starts the webhook server
  // Enrichments are triggered per-sheet via the webhook
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
    // Unload existing
    try {
      execSync(`launchctl unload "${plistPath}" 2>/dev/null`, { stdio: "ignore" });
    } catch {
      // not loaded
    }

    mkdirSync(plistDir, { recursive: true });
    writeFileSync(plistPath, plistContent);
    execSync(`launchctl load "${plistPath}"`);
    check("LaunchAgent installed — Rowbound starts automatically on login");
    console.log(pc.dim(`  Logs: /tmp/rowbound-watch.log`));
  } catch {
    fail("LaunchAgent setup failed. Start manually: rowbound watch --port 3000");
  }
}
