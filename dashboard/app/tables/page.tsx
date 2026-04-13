"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FolderOpen,
  FileSpreadsheet,
  Sparkles,
  ChevronRight,
  ExternalLink,
  RefreshCw,
  Search,
  Building2,
  Mail,
  Filter,
} from "lucide-react";

interface SheetEntry {
  id: string;
  name: string;
  type: "sheet";
  modifiedTime?: string;
  spreadsheetId?: string;
}

interface Category {
  id: string;
  name: string;
  sheets: SheetEntry[];
}

interface DriveData {
  rootId: string | null;
  categories: Category[];
  message?: string;
}

const CATEGORY_ICONS: Record<string, typeof Search> = {
  Research: Search,
  Content: Mail,
  "Data Processing": Filter,
  Strategy: Building2,
};

const CATEGORY_COLORS: Record<string, string> = {
  Research: "text-blue-400",
  Content: "text-amber-400",
  "Data Processing": "text-emerald-400",
  Strategy: "text-purple-400",
};

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function TablesPage() {
  const [data, setData] = useState<DriveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );

  async function loadDrive() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/drive");
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to load: ${res.status}`);
      }
      const result: DriveData = await res.json();
      setData(result);
      // Auto-expand all categories that have sheets
      const expanded = new Set<string>();
      for (const cat of result.categories) {
        if (cat.sheets.length > 0) expanded.add(cat.id);
      }
      setExpandedCategories(expanded);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load enrichments",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDrive();
  }, []);

  function toggleCategory(id: string) {
    setExpandedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const totalSheets =
    data?.categories.reduce((sum, cat) => sum + cat.sheets.length, 0) ?? 0;

  return (
    <>
      <Header
        title="Enrichments"
        subtitle={
          totalSheets > 0
            ? `${totalSheets} enrichment${totalSheets !== 1 ? "s" : ""} across ${data?.categories.length ?? 0} categories`
            : "Your enrichment history"
        }
        actions={
          <div className="flex items-center gap-2">
            <Link href="/enrich">
              <Button size="sm">
                <Sparkles className="w-4 h-4 mr-1" />
                New Enrichment
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={loadDrive}
              disabled={loading}
              title="Refresh from Drive"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          {/* Loading */}
          {loading && !data && (
            <div className="space-y-4">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          )}

          {/* Error */}
          {error && (
            <Card>
              <CardContent className="py-8 text-center">
                <p className="text-destructive text-sm mb-2">{error}</p>
                <p className="text-xs text-muted-foreground">
                  Make sure gws is installed and authenticated.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Empty state */}
          {data && !data.rootId && (
            <Card>
              <CardContent className="text-center py-16">
                <FolderOpen className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <h3 className="text-lg font-medium mb-2">
                  No enrichments yet
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Run your first enrichment to create your folder structure in
                  Google Drive.
                </p>
                <Link href="/enrich">
                  <Button>
                    <Sparkles className="w-4 h-4 mr-1" />
                    Run First Enrichment
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Folder browser */}
          {data && data.rootId && (
            <div className="space-y-2">
              {data.categories.map((category) => {
                const isExpanded = expandedCategories.has(category.id);
                const Icon =
                  CATEGORY_ICONS[category.name] ?? FolderOpen;
                const color =
                  CATEGORY_COLORS[category.name] ?? "text-muted-foreground";

                return (
                  <div key={category.id}>
                    {/* Category folder header */}
                    <button
                      onClick={() => toggleCategory(category.id)}
                      className="w-full flex items-center gap-3 rounded-lg border border-border p-4 hover:bg-muted/30 transition-colors text-left"
                    >
                      <ChevronRight
                        className={`w-4 h-4 text-muted-foreground transition-transform ${
                          isExpanded ? "rotate-90" : ""
                        }`}
                      />
                      <div className={`rounded-md bg-muted p-2 ${color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium">
                          {category.name}
                        </h3>
                      </div>
                      <Badge variant="secondary" className="text-xs">
                        {category.sheets.length}
                      </Badge>
                    </button>

                    {/* Sheets inside category */}
                    {isExpanded && category.sheets.length > 0 && (
                      <div className="ml-6 mt-1 space-y-1 border-l-2 border-border/50 pl-4">
                        {category.sheets.map((sheet) => (
                          <Link
                            key={sheet.id}
                            href={`/tables/${sheet.spreadsheetId}`}
                            className="flex items-center gap-3 rounded-md px-3 py-2.5 hover:bg-muted/30 transition-colors group"
                          >
                            <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">
                                {sheet.name}
                              </p>
                              {sheet.modifiedTime && (
                                <p className="text-xs text-muted-foreground">
                                  {formatTimeAgo(sheet.modifiedTime)}
                                </p>
                              )}
                            </div>
                            <a
                              href={`https://docs.google.com/spreadsheets/d/${sheet.spreadsheetId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Open in Google Sheets"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
                            </a>
                          </Link>
                        ))}
                      </div>
                    )}

                    {isExpanded && category.sheets.length === 0 && (
                      <div className="ml-6 mt-1 border-l-2 border-border/50 pl-4 py-3">
                        <p className="text-xs text-muted-foreground italic">
                          No enrichments in this category yet
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
