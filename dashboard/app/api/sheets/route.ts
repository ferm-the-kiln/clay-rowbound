import { NextRequest, NextResponse } from "next/server";
import { readSheetRows, createSheet } from "@/lib/google";

/**
 * Dual-mode Google Sheets API routes.
 * Local: uses gws CLI | Vercel: uses service account.
 * See lib/google.ts for implementation.
 */

export async function POST(request: NextRequest) {
  try {
    const { title, headers, rows, skillId, category } = await request.json();

    if (!title || !headers?.length || !rows?.length) {
      return NextResponse.json({ error: "Missing title, headers, or rows" }, { status: 400 });
    }

    const result = await createSheet({ title, headers, rows, category });

    return NextResponse.json({
      ...result,
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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const spreadsheetId = searchParams.get("id");
  const sheetName = searchParams.get("sheet") || "Sheet1";

  if (!spreadsheetId) {
    return NextResponse.json({ error: "Missing 'id' parameter" }, { status: 400 });
  }

  try {
    const rows = await readSheetRows(spreadsheetId, sheetName);
    return NextResponse.json(rows);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to read sheet" },
      { status: 500 },
    );
  }
}
