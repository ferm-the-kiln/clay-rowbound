import { NextResponse } from "next/server";
import { listEnrichmentFolders } from "@/lib/google";

/**
 * GET /api/drive
 * Lists the Clay Enrichments folder structure from Google Drive.
 * Dual-mode: gws CLI locally, service account on Vercel.
 */
export async function GET() {
  try {
    const result = await listEnrichmentFolders();

    if (!result.rootId) {
      return NextResponse.json({
        rootId: null,
        categories: [],
        message: "No enrichments yet. Run your first enrichment to create the folder structure.",
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to list Drive" },
      { status: 500 },
    );
  }
}
