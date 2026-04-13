/**
 * Dual-mode Google API client.
 *
 * Local:  uses `gws` CLI (already authenticated on the user's machine)
 * Vercel: uses a service account via JWT → REST API (no CLI needed)
 *
 * Auto-detects which mode to use:
 * 1. If GOOGLE_SERVICE_ACCOUNT_KEY env var is set → service account mode
 * 2. Otherwise → try gws CLI
 */

import { execFile } from "node:child_process";
import { createSign } from "node:crypto";

// ---------------------------------------------------------------------------
// Mode detection
// ---------------------------------------------------------------------------

type Mode = "service-account" | "gws";

function getMode(): Mode {
  if (process.env.GOOGLE_SERVICE_ACCOUNT_KEY) return "service-account";
  return "gws";
}

// ---------------------------------------------------------------------------
// Service account auth (for Vercel)
// ---------------------------------------------------------------------------

let cachedToken: { token: string; expires: number } | null = null;

async function getServiceAccountToken(): Promise<string> {
  if (cachedToken && cachedToken.expires > Date.now() + 60000) {
    return cachedToken.token;
  }

  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_KEY!);
  const now = Math.floor(Date.now() / 1000);

  const header = { alg: "RS256", typ: "JWT" };
  const payload = {
    iss: credentials.client_email,
    scope:
      "https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signable = `${encodedHeader}.${encodedPayload}`;

  const sign = createSign("RSA-SHA256");
  sign.update(signable);
  const signature = sign.sign(credentials.private_key, "base64url");
  const jwt = `${signable}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) throw new Error(`Token exchange failed: ${tokenRes.status}`);
  const data = await tokenRes.json();

  cachedToken = { token: data.access_token, expires: Date.now() + 3500000 };
  return data.access_token;
}

function base64url(str: string): string {
  return Buffer.from(str)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/** Fetch wrapper for Google REST APIs using service account token */
async function googleFetch(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await getServiceAccountToken();
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
}

// ---------------------------------------------------------------------------
// gws CLI helper (for local)
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
            reject(new Error("gws CLI not found. Run: npx clay-rowbound setup"));
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
// Public API — works in both modes
// ---------------------------------------------------------------------------

const CATEGORY_FOLDER_NAMES: Record<string, string> = {
  research: "Research",
  content: "Content",
  data: "Data Processing",
  strategy: "Strategy",
};

/** Read rows from a Google Sheet */
export async function readSheetRows(
  spreadsheetId: string,
  sheetName = "Sheet1",
): Promise<Record<string, string>[]> {
  const mode = getMode();

  let values: string[][];

  if (mode === "service-account") {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
    const res = await googleFetch(url);
    if (!res.ok) throw new Error(`Sheets API error: ${res.status}`);
    const data = await res.json();
    values = data.values ?? [];
  } else {
    const output = await runGws([
      "sheets", "spreadsheets", "values", "get",
      "--params", JSON.stringify({ spreadsheetId, range: `'${sheetName}'` }),
      "--format", "json",
    ]);
    const result = parseGwsJson(output) as { values?: string[][] };
    values = result.values ?? [];
  }

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
  const mode = getMode();
  const { title, headers, rows, category } = opts;

  let spreadsheetId: string;

  if (mode === "service-account") {
    // Create spreadsheet
    const createRes = await googleFetch(
      "https://sheets.googleapis.com/v4/spreadsheets",
      {
        method: "POST",
        body: JSON.stringify({
          properties: { title },
          sheets: [{ properties: { title: "Sheet1" } }],
        }),
      },
    );
    if (!createRes.ok) throw new Error(`Create sheet failed: ${createRes.status}`);
    const sheet = await createRes.json();
    spreadsheetId = sheet.spreadsheetId;

    // Write data
    const values = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ""))];
    const writeRes = await googleFetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1?valueInputOption=USER_ENTERED`,
      { method: "PUT", body: JSON.stringify({ range: "Sheet1!A1", values }) },
    );
    if (!writeRes.ok) throw new Error(`Write data failed: ${writeRes.status}`);
  } else {
    // gws mode
    const createOutput = await runGws([
      "sheets", "spreadsheets", "create",
      "--json", JSON.stringify({ properties: { title }, sheets: [{ properties: { title: "Sheet1" } }] }),
      "--format", "json",
    ]);
    const createResult = parseGwsJson(createOutput) as { spreadsheetId: string };
    spreadsheetId = createResult.spreadsheetId;
    if (!spreadsheetId) throw new Error("No spreadsheet ID returned");

    const values = [headers, ...rows.map((r) => headers.map((h) => r[h] ?? ""))];
    await runGws([
      "sheets", "spreadsheets", "values", "update",
      "--params", JSON.stringify({ spreadsheetId, range: "Sheet1!A1", valueInputOption: "USER_ENTERED" }),
      "--json", JSON.stringify({ range: "Sheet1!A1", values }),
      "--format", "json",
    ]);
  }

  // Organize in Drive folders (non-blocking)
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
  const mode = getMode();

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

// ---------------------------------------------------------------------------
// Drive helpers (dual-mode)
// ---------------------------------------------------------------------------

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
}

async function listDriveFolder(folderId: string): Promise<DriveFile[]> {
  const mode = getMode();
  const query = `'${folderId}' in parents and trashed=false`;

  if (mode === "service-account") {
    const params = new URLSearchParams({
      q: query,
      fields: "files(id,name,mimeType,modifiedTime)",
      orderBy: "modifiedTime desc",
      pageSize: "100",
    });
    const res = await googleFetch(`https://www.googleapis.com/drive/v3/files?${params}`);
    if (!res.ok) throw new Error(`Drive list failed: ${res.status}`);
    const data = await res.json();
    return data.files ?? [];
  }

  const output = await runGws([
    "drive", "files", "list",
    "--params", JSON.stringify({
      q: query,
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
  const mode = getMode();
  let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) query += ` and '${parentId}' in parents`;

  if (mode === "service-account") {
    const params = new URLSearchParams({ q: query, fields: "files(id)", pageSize: "1" });
    const res = await googleFetch(`https://www.googleapis.com/drive/v3/files?${params}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.files?.[0]?.id ?? null;
  }

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

  const mode = getMode();
  const body: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) body.parents = [parentId];

  if (mode === "service-account") {
    const res = await googleFetch("https://www.googleapis.com/drive/v3/files", {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Create folder failed: ${res.status}`);
    const data = await res.json();
    return data.id;
  }

  const output = await runGws([
    "drive", "files", "create",
    "--json", JSON.stringify(body),
    "--format", "json",
  ]);
  const result = parseGwsJson(output) as { id: string };
  return result.id;
}

async function moveFileToDriveFolder(fileId: string, folderId: string): Promise<void> {
  const mode = getMode();

  try {
    if (mode === "service-account") {
      // Get current parents
      const getRes = await googleFetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?fields=parents`,
      );
      if (!getRes.ok) return;
      const fileInfo = await getRes.json();
      const currentParents = (fileInfo.parents ?? []).join(",");

      await googleFetch(
        `https://www.googleapis.com/drive/v3/files/${fileId}?addParents=${folderId}&removeParents=${currentParents}`,
        { method: "PATCH" },
      );
    } else {
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
    }
  } catch {
    // Non-critical
  }
}
