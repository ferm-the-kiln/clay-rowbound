/**
 * Google API client using the gws CLI exclusively.
 *
 * All Google Sheets and Drive operations go through the `gws` binary,
 * which uses the user's authenticated Google account.
 *
 * This means the dashboard must run locally (where gws is installed).
 * Vercel deployments will show a setup prompt.
 */

import { execFile } from "node:child_process";

// ---------------------------------------------------------------------------
// gws CLI helper
// ---------------------------------------------------------------------------

function runGws(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "gws",
      args,
      { maxBuffer: 50 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            reject(
              new Error(
                "gws CLI not found. Run: npx clay-rowbound setup",
              ),
            );
            return;
          }
          reject(new Error(`gws failed: ${stderr || error.message}`));
          return;
        }
        resolve(stdout);
      },
    );
  });
}

function parseGwsJson(output: string): unknown {
  const jsonStart = output.search(/[[{]/);
  const cleaned = jsonStart > 0 ? output.slice(jsonStart) : output;
  return JSON.parse(cleaned);
}

// ---------------------------------------------------------------------------
// Sheets
// ---------------------------------------------------------------------------

/** Read rows from a Google Sheet */
export async function readSheetRows(
  spreadsheetId: string,
  sheetName = "Sheet1",
): Promise<Record<string, string>[]> {
  const output = await runGws([
    "sheets", "spreadsheets", "values", "get",
    "--params", JSON.stringify({ spreadsheetId, range: `'${sheetName}'` }),
    "--format", "json",
  ]);
  const result = parseGwsJson(output) as { values?: string[][] };
  const values = result.values ?? [];

  if (values.length === 0) return [];
  const headers = values[0]!;
  return values.slice(1).map((row) => {
    const obj: Record<string, string> = {};
    for (let i = 0; i < headers.length; i++) {
      obj[headers[i]!] = row[i] ?? "";
    }
    return obj;
  });
}

/** Create a new Google Sheet from data, organized in Drive folders */
export async function createSheet(opts: {
  title: string;
  headers: string[];
  rows: Record<string, string>[];
  category?: string;
}): Promise<{ spreadsheetId: string; url: string; folderId?: string }> {
  const { title, headers, rows, category } = opts;

  // 1. Create spreadsheet
  const createOutput = await runGws([
    "sheets", "spreadsheets", "create",
    "--json", JSON.stringify({ properties: { title }, sheets: [{ properties: { title: "Sheet1" } }] }),
    "--format", "json",
  ]);
  const createResult = parseGwsJson(createOutput) as { spreadsheetId: string };
  const spreadsheetId = createResult.spreadsheetId;
  if (!spreadsheetId) throw new Error("No spreadsheet ID returned");

  // 2. Write data
  const values = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ""))];
  await runGws([
    "sheets", "spreadsheets", "values", "update",
    "--params", JSON.stringify({ spreadsheetId, range: "Sheet1!A1", valueInputOption: "USER_ENTERED" }),
    "--json", JSON.stringify({ range: "Sheet1!A1", values }),
    "--format", "json",
  ]);

  // 3. Organize in Drive folders (non-blocking)
  let folderId: string | undefined;
  try {
    const rootFolderId = await findOrCreateDriveFolder("Clay Enrichments");
    const categoryName = CATEGORY_FOLDER_NAMES[category ?? ""] ?? "Other";
    const categoryFolderId = await findOrCreateDriveFolder(categoryName, rootFolderId);
    await moveFileToDriveFolder(spreadsheetId, categoryFolderId);
    folderId = categoryFolderId;
  } catch {
    // Drive organization failed — sheet still works
  }

  return {
    spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    folderId,
  };
}

// ---------------------------------------------------------------------------
// Drive
// ---------------------------------------------------------------------------

const CATEGORY_FOLDER_NAMES: Record<string, string> = {
  research: "Research",
  content: "Content",
  data: "Data Processing",
  strategy: "Strategy",
};

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

async function listDriveFolder(folderId: string): Promise<DriveFile[]> {
  const output = await runGws([
    "drive", "files", "list",
    "--params", JSON.stringify({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id,name,mimeType,modifiedTime)",
      orderBy: "modifiedTime desc",
      pageSize: 100,
    }),
    "--format", "json",
  ]);
  const result = parseGwsJson(output) as { files?: DriveFile[] };
  return result.files ?? [];
}

async function findDriveFolder(name: string, parentId?: string): Promise<string | null> {
  let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) query += ` and '${parentId}' in parents`;

  try {
    const output = await runGws([
      "drive", "files", "list",
      "--params", JSON.stringify({ q: query, fields: "files(id)", pageSize: 1 }),
      "--format", "json",
    ]);
    const result = parseGwsJson(output) as { files?: Array<{ id: string }> };
    return result.files?.[0]?.id ?? null;
  } catch {
    return null;
  }
}

async function findOrCreateDriveFolder(name: string, parentId?: string): Promise<string> {
  const existing = await findDriveFolder(name, parentId);
  if (existing) return existing;

  const body: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) body.parents = [parentId];

  const output = await runGws([
    "drive", "files", "create",
    "--json", JSON.stringify(body),
    "--format", "json",
  ]);
  const result = parseGwsJson(output) as { id: string };
  return result.id;
}

async function moveFileToDriveFolder(fileId: string, folderId: string): Promise<void> {
  try {
    const getOutput = await runGws([
      "drive", "files", "get",
      "--params", JSON.stringify({ fileId, fields: "parents" }),
      "--format", "json",
    ]);
    const fileInfo = parseGwsJson(getOutput) as { parents?: string[] };
    const currentParents = fileInfo.parents?.join(",") ?? "";

    await runGws([
      "drive", "files", "update",
      "--params", JSON.stringify({ fileId, addParents: folderId, removeParents: currentParents }),
      "--format", "json",
    ]);
  } catch {
    // Non-critical
  }
}

/** List the Clay Enrichments Drive folder structure */
export async function listEnrichmentFolders(): Promise<{
  rootId: string | null;
  categories: Array<{
    id: string;
    name: string;
    sheets: Array<{
      id: string;
      name: string;
      modifiedTime?: string;
      spreadsheetId: string;
    }>;
  }>;
}> {
  const rootId = await findDriveFolder("Clay Enrichments");
  if (!rootId) return { rootId: null, categories: [] };

  const rootFiles = await listDriveFolder(rootId);
  const categories: Array<{
    id: string;
    name: string;
    sheets: Array<{ id: string; name: string; modifiedTime?: string; spreadsheetId: string }>;
  }> = [];

  for (const file of rootFiles) {
    if (file.mimeType === "application/vnd.google-apps.folder") {
      const categoryFiles = await listDriveFolder(file.id);
      const sheets = categoryFiles
        .filter((f) => f.mimeType === "application/vnd.google-apps.spreadsheet")
        .map((f) => ({
          id: f.id,
          name: f.name,
          modifiedTime: f.modifiedTime,
          spreadsheetId: f.id,
        }));
      categories.push({ id: file.id, name: file.name, sheets });
    }
  }

  const order = ["Research", "Content", "Data Processing", "Strategy", "Other"];
  categories.sort((a, b) => {
    const ai = order.indexOf(a.name);
    const bi = order.indexOf(b.name);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return { rootId, categories };
}
