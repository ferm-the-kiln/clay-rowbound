"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table2,
  Sparkles,
  Plus,
  Play,
  Clock,
} from "lucide-react";

interface ConnectedSheet {
  id: string;
  title: string;
  lastRun?: string;
  rowCount?: number;
}

interface RecentEnrichment {
  spreadsheetId: string;
  skillId: string;
  skillName: string;
  rowCount: number;
  timestamp: string;
}

export default function HomePage() {
  const [sheets, setSheets] = useState<ConnectedSheet[]>([]);
  const [recentEnrichments, setRecentEnrichments] = useState<RecentEnrichment[]>([]);
  const router = useRouter();

  useEffect(() => {
    const savedSheets = localStorage.getItem("clay-sheets");
    if (savedSheets) {
      try {
        setSheets(JSON.parse(savedSheets));
      } catch {
        // ignore
      }
    }

    const savedRecent = localStorage.getItem("clay-recent-enrichments");
    if (savedRecent) {
      try {
        setRecentEnrichments(JSON.parse(savedRecent));
      } catch {
        // ignore
      }
    }
  }, []);

  function formatTimeAgo(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  }

  return (
    <>
      <Header title="Dashboard" subtitle="Your enrichment workspace" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-4">
            <Link href="/enrich">
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <Sparkles className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">New Enrichment</h3>
                    <p className="text-sm text-muted-foreground">
                      Upload CSV or connect a Google Sheet
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>

            <Link href="/tables">
              <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="rounded-lg bg-primary/10 p-3">
                    <Table2 className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-medium">View Tables</h3>
                    <p className="text-sm text-muted-foreground">
                      See your connected Google Sheets
                    </p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>

          {/* Recent Enrichments */}
          {recentEnrichments.length > 0 && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <CardTitle className="text-lg">Recent Enrichments</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {recentEnrichments.slice(0, 5).map((enrichment, i) => (
                    <div
                      key={`${enrichment.spreadsheetId}-${enrichment.timestamp}-${i}`}
                      className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Sparkles className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">
                              {enrichment.skillName}
                            </p>
                            <Badge variant="outline" className="text-[10px]">
                              {enrichment.rowCount} rows
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {formatTimeAgo(enrichment.timestamp)}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() =>
                          router.push(`/tables/${enrichment.spreadsheetId}`)
                        }
                      >
                        <Play className="w-3 h-3 mr-1" />
                        Run again
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Connected Sheets */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Connected Sheets</CardTitle>
                <Link href="/settings">
                  <Button variant="outline" size="sm">
                    <Plus className="w-4 h-4 mr-1" /> Add Sheet
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              {sheets.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Table2 className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p className="text-sm">No sheets connected yet.</p>
                  <p className="text-xs mt-1">
                    Go to{" "}
                    <Link
                      href="/settings"
                      className="text-primary underline underline-offset-2"
                    >
                      Settings
                    </Link>{" "}
                    to add a Google Sheet.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {sheets.map((sheet) => (
                    <Link
                      key={sheet.id}
                      href={`/tables/${sheet.id}`}
                      className="flex items-center justify-between rounded-md border border-border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <Table2 className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">{sheet.title}</p>
                          {sheet.rowCount && (
                            <p className="text-xs text-muted-foreground">
                              {sheet.rowCount} rows
                            </p>
                          )}
                        </div>
                      </div>
                      {sheet.lastRun && (
                        <span className="text-xs text-muted-foreground">
                          Last run: {sheet.lastRun}
                        </span>
                      )}
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
