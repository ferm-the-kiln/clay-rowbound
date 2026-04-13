/** Row of data from Google Sheets */
export type SheetRow = Record<string, string>;

/** Cell enrichment state */
export type CellState =
  | "empty"
  | "pending"
  | "running"
  | "done"
  | "error"
  | "skipped"
  | "filtered";

/** A configured enrichment action (skill) on a sheet */
export interface SheetAction {
  id: string;
  type: "skill" | "ai" | "http" | "formula";
  target: string;
  skillId?: string;
  model?: string;
  clientSlug?: string;
  name?: string;
}

/** Sheet metadata for the dashboard */
export interface SheetConfig {
  spreadsheetId: string;
  sheetName: string;
  title: string;
  actions: SheetAction[];
  lastRun?: string;
}

/** Skill definition loaded from skills/ directory */
export interface SkillDefinition {
  id: string;
  name: string;
  category: "research" | "content" | "data" | "strategy";
  description?: string;
}

/** Connection status to Rowbound watch */
export type ConnectionStatus = "connected" | "disconnected" | "checking";

/** Result from triggering an enrichment */
export interface EnrichmentResult {
  ok: boolean;
  processedRows?: number;
  updates?: number;
  errors?: number;
}
