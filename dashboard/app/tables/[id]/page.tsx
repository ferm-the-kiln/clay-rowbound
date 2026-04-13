"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
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
} from "lucide-react";
import { fetchSheetRows, triggerEnrichment, checkHealth } from "@/lib/api";
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

export default function TableViewPage() {
  const params = useParams();
  const spreadsheetId = params.id as string;

  const [rows, setRows] = useState<SheetRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
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

  async function handleRunSkill(skillId: string) {
    const connected = await checkHealth();
    if (!connected) {
      setError("Rowbound is not running. Start it first.");
      return;
    }

    try {
      setRunning(true);
      setError(null);
      await triggerEnrichment(spreadsheetId, skillId);
      // Poll for a bit then stop
      setTimeout(() => {
        setRunning(false);
        loadData();
      }, 10000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Enrichment failed");
      setRunning(false);
    }
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

            <Button
              variant="outline"
              size="sm"
              onClick={loadData}
              disabled={loading}
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
              <Button variant="outline" size="sm">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
          </div>
        }
      />

      {/* Status bar */}
      {running && (
        <div className="shrink-0 border-b border-border bg-primary/5 px-6 py-2 flex items-center gap-2">
          <Loader2 className="w-3 h-3 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">
            Enrichment running... Results will appear as cells update.
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
                          <CellValue value={row[h]!} />
                        ) : (
                          <span className="text-muted-foreground">—</span>
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
          <span>{headers.length} columns</span>
        </div>
      )}
    </>
  );
}

/** Simple cell value renderer with type detection */
function CellValue({ value }: { value: string }) {
  // URL
  if (/^https?:\/\//i.test(value)) {
    return (
      <a
        href={value}
        target="_blank"
        rel="noopener noreferrer"
        className="text-blue-400 hover:underline truncate flex items-center gap-1"
      >
        <ExternalLink className="w-3 h-3 shrink-0" />
        <span className="truncate">
          {value.replace(/^https?:\/\/(www\.)?/, "")}
        </span>
      </a>
    );
  }

  // Email
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    return <span className="text-blue-400">{value}</span>;
  }

  // JSON (enrichment result)
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
