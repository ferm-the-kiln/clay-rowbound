"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table2, Sparkles, Plus } from "lucide-react";

interface ConnectedSheet {
  id: string;
  title: string;
  lastRun?: string;
  rowCount?: number;
}

export default function HomePage() {
  const [sheets, setSheets] = useState<ConnectedSheet[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem("clay-sheets");
    if (saved) {
      try {
        setSheets(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

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
