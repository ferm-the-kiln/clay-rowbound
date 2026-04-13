/**
 * Minimal API client for the Clay Rowbound dashboard.
 *
 * Two targets:
 * 1. localhost:3001 — Rowbound watch webhook server (trigger enrichments, health check)
 * 2. /api/* — Next.js API routes (Google Sheets data, proxied through server-side)
 */

import type { EnrichmentResult, SheetRow } from "./types";

const ROWBOUND_URL = "http://localhost:3001";

// ---------------------------------------------------------------------------
// Rowbound watch (localhost)
// ---------------------------------------------------------------------------

/** Check if Rowbound watch is running */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${ROWBOUND_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Trigger an enrichment run via Rowbound's webhook */
export async function triggerEnrichment(
  spreadsheetId: string,
  actionId?: string,
): Promise<EnrichmentResult> {
  const res = await fetch(`${ROWBOUND_URL}/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ spreadsheetId, action: actionId }),
  });
  if (!res.ok) throw new Error(`Enrichment trigger failed: ${res.status}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Google Sheets data (via Next.js API routes)
// ---------------------------------------------------------------------------

/** Fetch rows from a Google Sheet */
export async function fetchSheetRows(
  spreadsheetId: string,
  sheetName?: string,
): Promise<SheetRow[]> {
  const params = new URLSearchParams({ id: spreadsheetId });
  if (sheetName) params.set("sheet", sheetName);
  const res = await fetch(`/api/sheets?${params}`);
  if (!res.ok) throw new Error(`Failed to fetch sheet: ${res.status}`);
  return res.json();
}

/** Fetch available skills */
export async function fetchSkills(): Promise<
  Array<{ id: string; name: string; category: string }>
> {
  const res = await fetch("/api/skills");
  if (!res.ok) throw new Error(`Failed to fetch skills: ${res.status}`);
  return res.json();
}
