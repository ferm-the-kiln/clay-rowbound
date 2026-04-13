import { NextRequest, NextResponse } from "next/server";
import { execFile } from "node:child_process";

/**
 * Google Sheets API routes using the gws CLI — same approach as Rowbound.
 *
 * GET /api/sheets?id=SPREADSHEET_ID&sheet=Sheet1
 * Reads rows from a Google Sheet.
 *
 * POST /api/sheets
 * Creates a new Google Sheet from CSV data.
 * Body: { title: string, headers: string[], rows: Record<string, string>[] }
 * Returns: { spreadsheetId: string, url: string }
 */

// ---------------------------------------------------------------------------
// gws CLI helper (same pattern as Rowbound's SheetsAdapter)
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
                "gws CLI not found. Install: npm install -g @googleworkspace/cli — then run: gws auth setup",
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

/** Parse gws JSON output, stripping any non-JSON prefix lines */
function parseGwsJson(output: string): unknown {
  const jsonStart = output.search(/[[{]/);
  const cleaned = jsonStart > 0 ? output.slice(jsonStart) : output;
  return JSON.parse(cleaned);
}

// ---------------------------------------------------------------------------
// POST — Create a new Google Sheet from CSV data
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, headers, rows } = body as {
      title: string;
      headers: string[];
      rows: Record<string, string>[];
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

    // 2. Write headers + rows via gws values update
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

    return NextResponse.json({
      spreadsheetId,
      url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      rowCount: rows.length,
      columnCount: headers.length,
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

    const result = parseGwsJson(output) as {
      values?: string[][];
    };
    const values = result.values ?? [];

    if (values.length === 0) {
      return NextResponse.json([]);
    }

    // First row = headers, rest = data rows
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
