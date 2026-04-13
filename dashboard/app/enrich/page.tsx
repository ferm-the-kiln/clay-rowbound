"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Header } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Building2,
  Users,
  Mail,
  MessageSquare,
  FileText,
  Filter,
  ArrowRight,
  Upload,
  FileSpreadsheet,
  Table2,
  X,
  Loader2,
  Play,
} from "lucide-react";

const SKILLS = [
  {
    id: "company-research",
    name: "Company Research",
    category: "research",
    icon: Building2,
    description: "Research a company: tech stack, size, recent news, key people",
  },
  {
    id: "people-research",
    name: "People Research",
    category: "research",
    icon: Users,
    description: "Research a person: role, background, interests, shared connections",
  },
  {
    id: "competitor-research",
    name: "Competitor Research",
    category: "research",
    icon: Search,
    description: "Analyze competitors: strengths, weaknesses, positioning",
  },
  {
    id: "email-gen",
    name: "Email Generator",
    category: "content",
    icon: Mail,
    description: "Generate personalized cold emails using Josh Braun PVC framework",
  },
  {
    id: "linkedin-note",
    name: "LinkedIn Note",
    category: "content",
    icon: MessageSquare,
    description: "Write LinkedIn connection request or InMail notes",
  },
  {
    id: "follow-up",
    name: "Follow-up",
    category: "content",
    icon: Mail,
    description: "Generate follow-up emails based on previous outreach",
  },
  {
    id: "sequence-writer",
    name: "Sequence Writer",
    category: "content",
    icon: FileText,
    description: "Write a full multi-touch outbound sequence",
  },
  {
    id: "classify",
    name: "Classify Titles",
    category: "data",
    icon: Filter,
    description: "Normalize job titles to IC/Manager/Director/VP/C-Suite",
  },
  {
    id: "company-qualifier",
    name: "Qualify Companies",
    category: "data",
    icon: Building2,
    description: "Score companies against your ICP criteria",
  },
];

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "research", label: "Research" },
  { id: "content", label: "Content" },
  { id: "data", label: "Data Processing" },
];

type DataSource = "sheet" | "csv";

interface CsvData {
  headers: string[];
  rows: Record<string, string>[];
  fileName: string;
}

export default function EnrichPage() {
  const [dataSource, setDataSource] = useState<DataSource>("csv");
  const [sheetUrl, setSheetUrl] = useState("");
  const [csvData, setCsvData] = useState<CsvData | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredSkills =
    selectedCategory === "all"
      ? SKILLS
      : SKILLS.filter((s) => s.category === selectedCategory);

  function extractSpreadsheetId(url: string): string | null {
    const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
    return match?.[1] ?? null;
  }

  function handleConnect() {
    const id = extractSpreadsheetId(sheetUrl);
    if (id) {
      window.location.href = `/tables/${id}`;
    }
  }

  const handleCsvParse = useCallback((file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const rows = result.data as Record<string, string>[];
        if (rows.length > 0) {
          const headers = Object.keys(rows[0]!);
          setCsvData({ headers, rows, fileName: file.name });
        }
      },
      error: () => {
        // silent fail
      },
    });
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleCsvParse(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file && (file.name.endsWith(".csv") || file.type === "text/csv")) {
      handleCsvParse(file);
    }
  }

  function clearCsv() {
    setCsvData(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleRun() {
    if (!csvData || !selectedSkill) return;

    setCreating(true);
    setCreateError(null);

    try {
      // Create a Google Sheet from the CSV data
      const skillName = SKILLS.find((s) => s.id === selectedSkill)?.name ?? selectedSkill;
      const title = `${csvData.fileName.replace(/\.csv$/i, "")} — ${skillName}`;

      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          headers: csvData.headers,
          rows: csvData.rows,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to create sheet: ${res.status}`);
      }

      const result = await res.json();
      const spreadsheetId = result.spreadsheetId;

      // Save to connected sheets in localStorage
      const saved = localStorage.getItem("clay-sheets");
      const sheets = saved ? JSON.parse(saved) : [];
      sheets.unshift({
        id: spreadsheetId,
        title,
        rowCount: csvData.rows.length,
        lastRun: new Date().toLocaleDateString(),
      });
      localStorage.setItem("clay-sheets", JSON.stringify(sheets));

      // Navigate to table view
      router.push(`/tables/${spreadsheetId}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Something went wrong");
      setCreating(false);
    }
  }

  const canRun = dataSource === "csv" && csvData && selectedSkill;

  return (
    <>
      <Header
        title="Enrich"
        subtitle="Choose an enrichment to run on your data"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Step 1: Data Source */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  1
                </Badge>
                Add your data
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Tab toggle */}
              <div className="flex rounded-lg bg-muted p-1 w-fit">
                <button
                  onClick={() => setDataSource("csv")}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    dataSource === "csv"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Upload className="w-4 h-4" />
                  Upload CSV
                </button>
                <button
                  onClick={() => setDataSource("sheet")}
                  className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                    dataSource === "sheet"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Google Sheet
                </button>
              </div>

              {/* CSV Upload */}
              {dataSource === "csv" && !csvData && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                    dragOver
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={handleFileSelect}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm font-medium mb-1">
                    Drop a CSV file here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    CSV with headers in the first row
                  </p>
                </div>
              )}

              {/* CSV Preview */}
              {dataSource === "csv" && csvData && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Table2 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">
                        {csvData.fileName}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {csvData.rows.length} rows
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {csvData.headers.length} columns
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={clearCsv}>
                      <X className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Preview table — first 5 rows */}
                  <div className="rounded-md border border-border overflow-hidden">
                    <div className="overflow-x-auto max-h-[200px]">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-muted">
                          <tr>
                            {csvData.headers.map((h) => (
                              <th
                                key={h}
                                className="text-left px-3 py-2 font-medium text-muted-foreground whitespace-nowrap"
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvData.rows.slice(0, 5).map((row, i) => (
                            <tr
                              key={i}
                              className="border-t border-border/50"
                            >
                              {csvData.headers.map((h) => (
                                <td
                                  key={h}
                                  className="px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate"
                                >
                                  {row[h] || (
                                    <span className="text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {csvData.rows.length > 5 && (
                      <div className="px-3 py-1.5 text-xs text-muted-foreground border-t border-border bg-muted/50">
                        + {csvData.rows.length - 5} more rows
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Google Sheet URL */}
              {dataSource === "sheet" && (
                <div>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Paste your Google Sheet URL..."
                      value={sheetUrl}
                      onChange={(e) => setSheetUrl(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleConnect}
                      disabled={!extractSpreadsheetId(sheetUrl)}
                    >
                      <ArrowRight className="w-4 h-4 mr-1" />
                      Open
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Make sure the sheet is shared with the service account or is
                    publicly accessible.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Step 2: Pick Enrichment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  2
                </Badge>
                Choose an enrichment
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Category filters */}
              <div className="flex gap-2 mb-4">
                {CATEGORIES.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={
                      selectedCategory === cat.id ? "default" : "outline"
                    }
                    size="sm"
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>

              {/* Skill grid */}
              <div className="grid gap-3 sm:grid-cols-2">
                {filteredSkills.map((skill) => (
                  <button
                    key={skill.id}
                    onClick={() =>
                      setSelectedSkill(
                        selectedSkill === skill.id ? null : skill.id,
                      )
                    }
                    className={`text-left rounded-lg border p-4 transition-all ${
                      selectedSkill === skill.id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-muted-foreground/30 hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="rounded-md bg-muted p-2">
                        <skill.icon className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium">{skill.name}</h4>
                          <Badge variant="outline" className="text-[10px]">
                            {skill.category}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {skill.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Step 3: Run */}
          {dataSource === "csv" && (
            <Card
              className={
                canRun
                  ? "border-primary/30 bg-primary/5"
                  : "opacity-60"
              }
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">
                      3
                    </Badge>
                    <div>
                      <h3 className="text-sm font-medium">
                        {canRun
                          ? `Run ${SKILLS.find((s) => s.id === selectedSkill)?.name} on ${csvData?.rows.length} rows`
                          : "Upload data and choose an enrichment to continue"}
                      </h3>
                      {canRun && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Creates a Google Sheet from your CSV, then enriches it
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    onClick={handleRun}
                    disabled={!canRun || creating}
                    size="lg"
                  >
                    {creating ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Creating sheet...
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 mr-2" />
                        Run Enrichment
                      </>
                    )}
                  </Button>
                </div>
                {createError && (
                  <p className="text-sm text-destructive mt-3">{createError}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
