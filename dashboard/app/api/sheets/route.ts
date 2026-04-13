import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";

/**
 * Google Sheets API routes using the gws CLI — same approach as Rowbound.
 *
 * GET /api/sheets?id=SPREADSHEET_ID&sheet=Sheet1
 * Reads rows from a Google Sheet.
 *
 * POST /api/sheets
 * Creates a new Google Sheet from CSV data, organized in Google Drive folders.
 * Body: { title: string, headers: string[], rows: Record<string, string>[], skillId?: string, category?: string }
 * Returns: { spreadsheetId: string, url: string, folderId?: string }
 *
 * Drive folder structure:
 *   My Drive / Clay Enrichments / Research / "Company Research — 2026-04-13.csv"
 *   My Drive / Clay Enrichments / Content / "Email Gen — 2026-04-13.csv"
 *   My Drive / Clay Enrichments / Data Processing / "Classify — 2026-04-13.csv"
 */

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
// Google Drive folder management via gws
// ---------------------------------------------------------------------------

const CATEGORY_FOLDER_NAMES: Record<string, string> = {
  research: "Research",
  content: "Content",
  data: "Data Processing",
  strategy: "Strategy",
};

/** Find or create a Drive folder by name, optionally inside a parent folder */
async function findOrCreateFolder(
  name: string,
  parentId?: string,
): Promise<string> {
  // Search for existing folder
  let query = `name='${name}' and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  try {
    const searchOutput = await runGws([
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

    const searchResult = parseGwsJson(searchOutput) as {
      files?: Array<{ id: string; name: string }>;
    };

    if (searchResult.files && searchResult.files.length > 0) {
      return searchResult.files[0]!.id;
    }
  } catch {
    // Search failed — fall through to create
  }

  // Create the folder
  const createBody: Record<string, unknown> = {
    name,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentId) {
    createBody.parents = [parentId];
  }

  const createOutput = await runGws([
    "drive",
    "files",
    "create",
    "--json",
    JSON.stringify(createBody),
    "--format",
    "json",
  ]);

  const createResult = parseGwsJson(createOutput) as { id: string };
  return createResult.id;
}

/** Move a file (spreadsheet) into a specific Drive folder */
async function moveFileToFolder(
  fileId: string,
  folderId: string,
): Promise<void> {
  try {
    // Get current parents
    const getOutput = await runGws([
      "drive",
      "files",
      "get",
      "--params",
      JSON.stringify({ fileId, fields: "parents" }),
      "--format",
      "json",
    ]);

    const fileInfo = parseGwsJson(getOutput) as {
      parents?: string[];
    };
    const currentParents = fileInfo.parents?.join(",") ?? "";

    // Move to new folder
    await runGws([
      "drive",
      "files",
      "update",
      "--params",
      JSON.stringify({
        fileId,
        addParents: folderId,
        removeParents: currentParents,
      }),
      "--format",
      "json",
    ]);
  } catch {
    // Non-critical — sheet was created, just not moved
  }
}

// ---------------------------------------------------------------------------
// POST — Create a new Google Sheet from CSV data
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, headers, rows, category } = body as {
      title: string;
      headers: string[];
      rows: Record<string, string>[];
      skillId?: string;
      category?: string;
    };

    if (!title || !headers?.length || !rows?.length) {
      return NextResponse.json(
        { error: "Missing title, headers, or rows" },
        { status: 400 },
      );
    }

    // 1. Create spreadsheet via gws
    const createOutput = await runGws([
      "sheets",
      "spreadsheets",
      "create",
      "--json",
      JSON.stringify({
        properties: { title },
        sheets: [{ properties: { title: "Sheet1" } }],
      }),
      "--format",
      "json",
    ]);

    const createResult = parseGwsJson(createOutput) as {
      spreadsheetId: string;
    };
    const spreadsheetId = createResult.spreadsheetId;

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: "Failed to create spreadsheet — no ID returned" },
        { status: 500 },
      );
    }

    // 2. Write headers + rows
    const values: string[][] = [headers];
    for (const row of rows) {
      values.push(headers.map((h) => row[h] ?? ""));
    }

    await runGws([
      "sheets",
      "spreadsheets",
      "values",
      "update",
      "--params",
      JSON.stringify({
        spreadsheetId,
        range: "Sheet1!A1",
        valueInputOption: "USER_ENTERED",
      }),
      "--json",
      JSON.stringify({ range: "Sheet1!A1", values }),
      "--format",
      "json",
    ]);

    // 3. Organize in Drive folders (non-blocking — don't fail if this errors)
    let folderId: string | undefined;
    try {
      // Create: My Drive / Clay Enrichments / {Category}
      const rootFolderId = await findOrCreateFolder("Clay Enrichments");
      const categoryName = CATEGORY_FOLDER_NAMES[category ?? ""] ?? "Other";
      const categoryFolderId = await findOrCreateFolder(categoryName, rootFolderId);
      await moveFileToFolder(spreadsheetId, categoryFolderId);
      folderId = categoryFolderId;
    } catch {
      // Drive organization failed — sheet still works, just not organized
    }

    return NextResponse.json({
      spreadsheetId,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      rowCount: rows.length,
      columnCount: headers.length,
      folderId,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create sheet" },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// GET — Read rows from a Google Sheet
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const spreadsheetId = searchParams.get("id");
  const sheetName = searchParams.get("sheet") || "Sheet1";

  if (!spreadsheetId) {
    return NextResponse.json(
      { error: "Missing 'id' parameter" },
      { status: 400 },
    );
  }

  try {
    const output = await runGws([
      "sheets",
      "spreadsheets",
      "values",
      "get",
      "--params",
      JSON.stringify({
        spreadsheetId,
        range: `'${sheetName}'`,
      }),
      "--format",
      "json",
    ]);

    const result = parseGwsJson(output) as { values?: string[][] };
    const values = result.values ?? [];

    if (values.length === 0) {
      return NextResponse.json([]);
    }

    const headers = values[0]!;
    const rows = values.slice(1).map((row) => {
      const obj: Record<string, string> = {};
      for (let i = 0; i < headers.length; i++) {
        obj[headers[i]!] = row[i] ?? "";
      }
      return obj;
    });

    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read sheet" },
      { status: 500 },
    );
  }
}
