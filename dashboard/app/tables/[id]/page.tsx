"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Header } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Play,
  RefreshCw,
  Loader2,
  ChevronDown,
  ExternalLink,
  Download,
  Copy,
  Check,
} from "lucide-react";
import { fetchSheetRows } from "@/lib/api";
import type { SheetRow } from "@/lib/types";

const SKILL_CATEGORIES = {
  research: [
    { id: "company-research", label: "Company Research" },
    { id: "people-research", label: "People Research" },
    { id: "competitor-research", label: "Competitor Research" },
  ],
  content: [
    { id: "email-gen", label: "Email Generator" },
    { id: "linkedin-note", label: "LinkedIn Note" },
    { id: "follow-up", label: "Follow-up" },
    { id: "sequence-writer", label: "Sequence Writer" },
  ],
  data: [
    { id: "classify", label: "Classify Titles" },
    { id: "company-qualifier", label: "Qualify Companies" },
  ],
};

const ALL_SKILLS = [
  ...SKILL_CATEGORIES.research,
  ...SKILL_CATEGORIES.content,
  ...SKILL_CATEGORIES.data,
];

export default function TableViewPage() {
  const params = useParams();
  const spreadsheetId = params.id as string;

  const [rows, setRows] = useState<SheetRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runningSkill, setRunningSkill] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSheetRows(spreadsheetId);
      if (data.length > 0) {
        setHeaders(Object.keys(data[0]!));
      }
      setRows(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load sheet data");
    } finally {
      setLoading(false);
    }
  }, [spreadsheetId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Poll for updates while running
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(loadData, 3000);
    return () => clearInterval(interval);
  }, [running, loadData]);

  function handleRunSkill(skillId: string) {
    const skillName = ALL_SKILLS.find((s) => s.id === skillId)?.label ?? skillId;
    const command = `cd /Users/fermandujar/Documents/clay-rowbound && npx tsx src/cli/index.ts enrich ${spreadsheetId} --skill ${skillId}`;

    navigator.clipboard.writeText(command);
    toast.success(`Command copied! Paste in your terminal to run ${skillName}`, {
      duration: 5000,
    });

    // Save to recent enrichments
    saveRecentEnrichment(spreadsheetId, skillId, skillName, rows.length);

    // Start polling for results
    setRunning(true);
    setRunningSkill(skillId);
    setTimeout(() => {
      setRunning(false);
      setRunningSkill(null);
    }, 120000); // Poll for up to 2 minutes
  }

  // --- CSV Export ---
  function handleExportCsv() {
    if (rows.length === 0 || headers.length === 0) return;

    const csvContent = [
      headers.map(escCsv).join(","),
      ...rows.map((row) => headers.map((h) => escCsv(row[h] ?? "")).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `enrichment-${spreadsheetId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} rows as CSV`);
  }

  return (
    <>
      <Header
        title="Table View"
        subtitle={spreadsheetId.slice(0, 20) + "..."}
        actions={
          <div className="flex items-center gap-2">
            {/* Enrichment dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={running}
                className="inline-flex items-center justify-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground shadow-xs hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
              >
                {running ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
                Run Enrichment
                <ChevronDown className="w-3 h-3" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  Research
                </div>
                {SKILL_CATEGORIES.research.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => handleRunSkill(s.id)}
                  >
                    {s.label}
                  </DropdownMenuItem>
                ))}
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground mt-1">
                  Content
                </div>
                {SKILL_CATEGORIES.content.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => handleRunSkill(s.id)}
                  >
                    {s.label}
                  </DropdownMenuItem>
                ))}
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground mt-1">
                  Data Processing
                </div>
                {SKILL_CATEGORIES.data.map((s) => (
                  <DropdownMenuItem
                    key={s.id}
                    onClick={() => handleRunSkill(s.id)}
                  >
                    {s.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Export CSV */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={rows.length === 0}
              title="Export as CSV"
            >
              <Download className="w-4 h-4" />
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
              title="Refresh data"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>

            <a
              href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="outline" size="sm" title="Open in Google Sheets">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
          </div>
        }
      />

      {/* Status bar */}
      {running && runningSkill && (
        <div className="shrink-0 border-b border-border bg-primary/5 px-6 py-2 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            Running {ALL_SKILLS.find((s) => s.id === runningSkill)?.label}... Results will appear as cells update.
          </span>
        </div>
      )}

      {error && (
        <div className="shrink-0 border-b border-destructive/20 bg-destructive/5 px-6 py-2">
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        {loading && rows.length === 0 ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <Card className="m-6">
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground">
                No data found in this sheet.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card border-b border-border z-10">
                <tr>
                  <th className="text-left px-4 py-2 text-xs font-medium text-muted-foreground w-12">
                    #
                  </th>
                  {headers.map((h) => (
                    <th
                      key={h}
                      className="text-left px-4 py-2 text-xs font-medium text-muted-foreground whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-2 text-xs text-muted-foreground tabular-nums">
                      {i + 1}
                    </td>
                    {headers.map((h) => (
                      <td
                        key={h}
                        className="px-4 py-2 text-sm max-w-[300px] truncate"
                        title={row[h] ?? ""}
                      >
                        {row[h] ? (
                          <ClickToCopyCell value={row[h]!} />
                        ) : (
                          <span className="text-muted-foreground/40 text-xs italic">
                            empty
                          </span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer status */}
      {rows.length > 0 && (
        <div className="shrink-0 border-t border-border px-6 py-2 flex items-center justify-between text-xs text-muted-foreground">
          <span>{rows.length} rows</span>
          <div className="flex items-center gap-4">
            <span>Click any cell to copy</span>
            <span>{headers.length} columns</span>
          </div>
        </div>
      )}
    </>
  );
}

/** Cell with click-to-copy + type detection */
function ClickToCopyCell({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setCopied(true);
    toast.success("Copied to clipboard", { duration: 1500 });
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <button
      onClick={handleClick}
      className="group relative text-left w-full truncate flex items-center gap-1 hover:text-primary transition-colors"
    >
      <span className="truncate">
        <CellValue value={value} />
      </span>
      <span className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {copied ? (
          <Check className="w-3 h-3 text-emerald-500" />
        ) : (
          <Copy className="w-3 h-3 text-muted-foreground" />
        )}
      </span>
    </button>
  );
}

/** Value renderer with type detection */
function CellValue({ value }: { value: string }) {
  if (/^https?:\/\//i.test(value)) {
    return (
      <span className="text-blue-400 truncate flex items-center gap-1">
        <ExternalLink className="w-3 h-3 shrink-0" />
        <span className="truncate">
          {value.replace(/^https?:\/\/(www\.)?/, "")}
        </span>
      </span>
    );
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return <span className="text-blue-400">{value}</span>;
  }

  if (value.startsWith("{") || value.startsWith("[")) {
    try {
      const parsed = JSON.parse(value);
      const preview =
        typeof parsed === "object"
          ? Object.values(parsed).filter((v) => typeof v === "string")[0] ??
            JSON.stringify(parsed).slice(0, 80)
          : value;
      return (
        <span className="flex items-center gap-1">
          <Badge variant="secondary" className="text-[10px] px-1">
            JSON
          </Badge>
          <span className="truncate">{String(preview)}</span>
        </span>
      );
    } catch {
      // not JSON
    }
  }

  return <span>{value}</span>;
}

/** Escape a value for CSV output */
function escCsv(val: string): string {
  if (val.includes(",") || val.includes('"') || val.includes("\n")) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

/** Save a recent enrichment to localStorage for the home page "run again" feature */
function saveRecentEnrichment(
  spreadsheetId: string,
  skillId: string,
  skillName: string,
  rowCount: number,
) {
  const key = "clay-recent-enrichments";
  const saved = localStorage.getItem(key);
  const recent: Array<{
    spreadsheetId: string;
    skillId: string;
    skillName: string;
    rowCount: number;
    timestamp: string;
  }> = saved ? JSON.parse(saved) : [];

  recent.unshift({
    spreadsheetId,
    skillId,
    skillName,
    rowCount,
    timestamp: new Date().toISOString(),
  });

  // Keep only last 10
  localStorage.setItem(key, JSON.stringify(recent.slice(0, 10)));
}
