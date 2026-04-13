"use client";

import { useState, useEffect } from "react";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Plus, Trash2, Copy, Check, Terminal } from "lucide-react";
import { checkHealth } from "@/lib/api";

interface SavedSheet {
  id: string;
  title: string;
}

export default function SettingsPage() {
  const [sheets, setSheets] = useState<SavedSheet[]>([]);
  const [newSheetUrl, setNewSheetUrl] = useState("");
  const [newSheetTitle, setNewSheetTitle] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load saved sheets
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

  // Check connection
  useEffect(() => {
    checkHealth().then(setIsConnected);
  }, []);

  function saveSheets(updated: SavedSheet[]) {
    setSheets(updated);
    localStorage.setItem("clay-sheets", JSON.stringify(updated));
  }

  function extractSpreadsheetId(url: string): string | null {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match?.[1] ?? null;
  }

  function addSheet() {
    const id = extractSpreadsheetId(newSheetUrl);
    if (!id) return;
    if (sheets.some((s) => s.id === id)) return;
    saveSheets([
      ...sheets,
      { id, title: newSheetTitle || `Sheet ${sheets.length + 1}` },
    ]);
    setNewSheetUrl("");
    setNewSheetTitle("");
  }

  function removeSheet(id: string) {
    saveSheets(sheets.filter((s) => s.id !== id));
  }

  const watchCommand = sheets.length > 0
    ? `rowbound watch ${sheets[0]!.id} --port 3000`
    : "rowbound watch YOUR_SHEET_ID --port 3000";

  function handleCopy() {
    navigator.clipboard.writeText(watchCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <>
      <Header title="Settings" subtitle="Configure your workspace" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Connection Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                Rowbound Connection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isConnected ? "bg-emerald-500" : "bg-red-500"
                  }`}
                />
                <span className="text-sm">
                  {isConnected
                    ? "Rowbound is running on localhost:3000"
                    : "Rowbound is not running"}
                </span>
                <Badge variant={isConnected ? "default" : "destructive"}>
                  {isConnected ? "Connected" : "Disconnected"}
                </Badge>
              </div>

              {!isConnected && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">
                      Start Rowbound by running this command in your terminal:
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono">
                        {watchCommand}
                      </code>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={handleCopy}
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-emerald-500" />
                        ) : (
                          <Copy className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </>
              )}

              <Separator />
              <div>
                <h4 className="text-sm font-medium mb-2">
                  Auto-start (LaunchAgent)
                </h4>
                <p className="text-xs text-muted-foreground mb-2">
                  To auto-start Rowbound on login, run this setup script:
                </p>
                <code className="block rounded-md bg-muted px-3 py-2 text-xs font-mono">
                  bash scripts/setup-launchagent.sh {sheets[0]?.id ?? "YOUR_SHEET_ID"}
                </code>
              </div>
            </CardContent>
          </Card>

          {/* Connected Sheets */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Connected Sheets</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Add new sheet */}
              <div className="space-y-2">
                <Input
                  placeholder="Google Sheet URL"
                  value={newSheetUrl}
                  onChange={(e) => setNewSheetUrl(e.target.value)}
                />
                <div className="flex gap-2">
                  <Input
                    placeholder="Sheet name (optional)"
                    value={newSheetTitle}
                    onChange={(e) => setNewSheetTitle(e.target.value)}
                    className="flex-1"
                  />
                  <Button
                    onClick={addSheet}
                    disabled={!extractSpreadsheetId(newSheetUrl)}
                  >
                    <Plus className="w-4 h-4 mr-1" /> Add
                  </Button>
                </div>
              </div>

              <Separator />

              {/* Sheet list */}
              {sheets.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No sheets connected yet. Add one above.
                </p>
              ) : (
                <div className="space-y-2">
                  {sheets.map((sheet) => (
                    <div
                      key={sheet.id}
                      className="flex items-center justify-between rounded-md border border-border p-3"
                    >
                      <div>
                        <p className="text-sm font-medium">{sheet.title}</p>
                        <p className="text-xs text-muted-foreground font-mono">
                          {sheet.id.slice(0, 30)}...
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeSheet(sheet.id)}
                      >
                        <Trash2 className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
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
