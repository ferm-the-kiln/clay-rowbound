"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table2, Plus, ExternalLink } from "lucide-react";

interface ConnectedSheet {
  id: string;
  title: string;
  lastRun?: string;
  rowCount?: number;
}

export default function TablesPage() {
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
      <Header
        title="Tables"
        subtitle="Your connected Google Sheets"
        actions={
          <Link href="/settings">
            <Button variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-1" /> Connect Sheet
            </Button>
          </Link>
        }
      />

      <div className="flex-1 overflow-auto p-6">
        {sheets.length === 0 ? (
          <Card>
            <CardContent className="text-center py-16">
              <Table2 className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <h3 className="text-lg font-medium mb-2">No sheets connected</h3>
              <p className="text-sm text-muted-foreground mb-4">
                Connect a Google Sheet to start enriching your data.
              </p>
              <Link href="/settings">
                <Button>
                  <Plus className="w-4 h-4 mr-1" /> Connect Sheet
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sheets.map((sheet) => (
              <Link key={sheet.id} href={`/tables/${sheet.id}`}>
                <Card className="hover:bg-muted/50 transition-colors cursor-pointer h-full">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <Table2 className="w-5 h-5 text-muted-foreground" />
                      <ExternalLink className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <h3 className="font-medium text-sm mb-1">{sheet.title}</h3>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {sheet.rowCount && <span>{sheet.rowCount} rows</span>}
                      {sheet.lastRun && <span>Run: {sheet.lastRun}</span>}
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
