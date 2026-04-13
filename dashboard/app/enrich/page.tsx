"use client";

import { useState } from "react";
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

export default function EnrichPage() {
  const [sheetUrl, setSheetUrl] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedSkill, setSelectedSkill] = useState<string | null>(null);

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

  return (
    <>
      <Header
        title="Enrich"
        subtitle="Choose an enrichment to run on your data"
      />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Step 1: Connect Sheet */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Badge variant="secondary" className="text-xs">
                  1
                </Badge>
                Connect a Google Sheet
              </CardTitle>
            </CardHeader>
            <CardContent>
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
        </div>
      </div>
    </>
  );
}
