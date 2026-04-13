import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";

/**
 * GET /api/drive?folder=FOLDER_ID
 * Lists contents of a Google Drive folder via gws CLI.
 *
 * GET /api/drive (no params)
 * Returns the Clay Enrichments folder structure (root + category subfolders).
 */

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

interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  createdTime?: string;
}

interface FolderEntry {
  id: string;
  name: string;
  type: "folder" | "sheet";
  modifiedTime?: string;
  /** For sheets: the spreadsheet ID (same as file ID) */
  spreadsheetId?: string;
  /** Number of items inside (for folders) */
  itemCount?: number;
}

async function listFolder(folderId: string): Promise<DriveFile[]> {
  const output = await runGws([
    "drive",
    "files",
    "list",
    "--params",
    JSON.stringify({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "files(id,name,mimeType,modifiedTime,createdTime)",
      orderBy: "modifiedTime desc",
      pageSize: 100,
    }),
    "--format",
    "json",
  ]);

  const result = parseGwsJson(output) as { files?: DriveFile[] };
  return result.files ?? [];
}

async function findFolder(name: string, parentId?: string): Promise<string | null> {
  let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) query += ` and '${parentId}' in parents`;

  const output = await runGws([
    "drive",
    "files",
    "list",
    "--params",
    JSON.stringify({
      q: query,
      fields: "files(id,name)",
      pageSize: 1,
    }),
    "--format",
    "json",
  ]);

  const result = parseGwsJson(output) as { files?: Array<{ id: string }> };
  return result.files?.[0]?.id ?? null;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const folderId = searchParams.get("folder");

  try {
    if (folderId) {
      // List specific folder contents
      const files = await listFolder(folderId);
      const entries: FolderEntry[] = files.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.mimeType === "application/vnd.google-apps.folder" ? "folder" : "sheet",
        modifiedTime: f.modifiedTime,
        spreadsheetId: f.mimeType === "application/vnd.google-apps.spreadsheet" ? f.id : undefined,
      }));

      return NextResponse.json({ entries });
    }

    // No folder specified — return the full Clay Enrichments tree
    const rootId = await findFolder("Clay Enrichments");
    if (!rootId) {
      return NextResponse.json({
        rootId: null,
        categories: [],
        message: "No enrichments yet. Run your first enrichment to create the folder structure.",
      });
    }

    // List category folders
    const rootFiles = await listFolder(rootId);
    const categories: Array<{
      id: string;
      name: string;
      sheets: FolderEntry[];
    }> = [];

    for (const file of rootFiles) {
      if (file.mimeType === "application/vnd.google-apps.folder") {
        // List sheets inside this category folder
        const categoryFiles = await listFolder(file.id);
        const sheets: FolderEntry[] = categoryFiles
          .filter((f) => f.mimeType === "application/vnd.google-apps.spreadsheet")
          .map((f) => ({
            id: f.id,
            name: f.name,
            type: "sheet" as const,
            modifiedTime: f.modifiedTime,
            spreadsheetId: f.id,
          }));

        categories.push({
          id: file.id,
          name: file.name,
          sheets,
        });
      }
    }

    // Sort categories by a fixed order
    const order = ["Research", "Content", "Data Processing", "Strategy", "Other"];
    categories.sort((a, b) => {
      const ai = order.indexOf(a.name);
      const bi = order.indexOf(b.name);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    return NextResponse.json({ rootId, categories });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list Drive" },
      { status: 500 },
    );
  }
}
