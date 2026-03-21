import { describe, expect, it } from "vitest";
import { executeLookup, type LookupOptions } from "../lookup.js";
import type {
  Adapter,
  CellUpdate,
  ExecutionContext,
  LookupAction,
  PipelineConfig,
  Row,
  SheetRef,
} from "../types.js";

/** Minimal mock adapter for testing */
class MockAdapter implements Adapter {
  public readRowsCalls: SheetRef[] = [];
  private tabData: Map<string, Row[]>;

  constructor(tabData: Map<string, Row[]> = new Map()) {
    this.tabData = tabData;
  }

  async readRows(ref: SheetRef): Promise<Row[]> {
    this.readRowsCalls.push(ref);
    return this.tabData.get(ref.sheetName ?? "Sheet1") ?? [];
  }

  async writeCell(_ref: SheetRef, _update: CellUpdate): Promise<void> {}
  async writeBatch(_ref: SheetRef, _updates: CellUpdate[]): Promise<void> {}
  async readConfig(_ref: SheetRef): Promise<PipelineConfig | null> {
    return null;
  }
  async writeConfig(_ref: SheetRef, _config: PipelineConfig): Promise<void> {}
  async getHeaders(_ref: SheetRef): Promise<string[]> {
    return [];
  }
}

const SPREADSHEET_ID = "test-sheet-id";

function makeAction(overrides: Partial<LookupAction> = {}): LookupAction {
  return {
    id: "lookup_1",
    type: "lookup",
    target: "result_col",
    sourceTab: "Companies",
    matchColumn: "domain",
    matchValue: "{{row.company_domain}}",
    returnColumn: "name",
    ...overrides,
  };
}

function makeContext(row: Row = {}): ExecutionContext {
  return { row, env: {} };
}

function makeOptions(
  adapter: MockAdapter,
  tabDataCache: Map<string, Row[]> = new Map(),
): LookupOptions {
  return {
    adapter,
    spreadsheetId: SPREADSHEET_ID,
    tabDataCache,
  };
}

describe("executeLookup", () => {
  it("returns first matched value with equals operator", async () => {
    const companiesData: Row[] = [
      { domain: "acme.com", name: "Acme Corp", industry: "Tech" },
      { domain: "globex.com", name: "Globex Inc", industry: "Finance" },
    ];
    const adapter = new MockAdapter(new Map([["Companies", companiesData]]));
    const action = makeAction();
    const context = makeContext({ company_domain: "acme.com" });

    const result = await executeLookup(action, context, makeOptions(adapter));

    expect(result).toBe("Acme Corp");
  });

  it("returns null when no match found", async () => {
    const companiesData: Row[] = [{ domain: "acme.com", name: "Acme Corp" }];
    const adapter = new MockAdapter(new Map([["Companies", companiesData]]));
    const action = makeAction();
    const context = makeContext({ company_domain: "unknown.com" });

    const result = await executeLookup(action, context, makeOptions(adapter));

    expect(result).toBeNull();
  });

  it("returns null when match value resolves to empty", async () => {
    const adapter = new MockAdapter(
      new Map([["Companies", [{ domain: "acme.com", name: "Acme" }]]]),
    );
    const action = makeAction();
    const context = makeContext({}); // no company_domain

    const result = await executeLookup(action, context, makeOptions(adapter));

    expect(result).toBeNull();
  });

  it("uses contains operator", async () => {
    const companiesData: Row[] = [
      { domain: "mail.acme.com", name: "Acme Corp" },
      { domain: "globex.com", name: "Globex Inc" },
    ];
    const adapter = new MockAdapter(new Map([["Companies", companiesData]]));
    const action = makeAction({ matchOperator: "contains" });
    const context = makeContext({ company_domain: "acme" });

    const result = await executeLookup(action, context, makeOptions(adapter));

    expect(result).toBe("Acme Corp");
  });

  it('returns all matches as JSON array in "all" mode', async () => {
    const companiesData: Row[] = [
      { domain: "acme.com", name: "Acme US" },
      { domain: "acme.com", name: "Acme EU" },
      { domain: "globex.com", name: "Globex" },
    ];
    const adapter = new MockAdapter(new Map([["Companies", companiesData]]));
    const action = makeAction({ matchMode: "all" });
    const context = makeContext({ company_domain: "acme.com" });

    const result = await executeLookup(action, context, makeOptions(adapter));

    expect(result).toBe(JSON.stringify(["Acme US", "Acme EU"]));
  });

  it('returns null in "all" mode when return column is empty for all matches', async () => {
    const companiesData: Row[] = [
      { domain: "acme.com", name: "" },
      { domain: "acme.com", name: "" },
    ];
    const adapter = new MockAdapter(new Map([["Companies", companiesData]]));
    const action = makeAction({ matchMode: "all" });
    const context = makeContext({ company_domain: "acme.com" });

    const result = await executeLookup(action, context, makeOptions(adapter));

    expect(result).toBeNull();
  });

  it("returns null when return column does not exist on matched row", async () => {
    const companiesData: Row[] = [{ domain: "acme.com" }]; // no "name" column
    const adapter = new MockAdapter(new Map([["Companies", companiesData]]));
    const action = makeAction();
    const context = makeContext({ company_domain: "acme.com" });

    const result = await executeLookup(action, context, makeOptions(adapter));

    expect(result).toBeNull();
  });

  it("uses tab data cache and does not re-read the same tab", async () => {
    const companiesData: Row[] = [{ domain: "acme.com", name: "Acme Corp" }];
    const adapter = new MockAdapter(new Map([["Companies", companiesData]]));
    const action = makeAction();
    const cache = new Map<string, Row[]>();
    const opts = makeOptions(adapter, cache);

    // First lookup — should read from adapter
    const ctx1 = makeContext({ company_domain: "acme.com" });
    await executeLookup(action, ctx1, opts);

    // Second lookup — should use cache
    const ctx2 = makeContext({ company_domain: "acme.com" });
    await executeLookup(action, ctx2, opts);

    // Adapter should have been called only once
    expect(adapter.readRowsCalls).toHaveLength(1);
    expect(cache.has("Companies")).toBe(true);
  });

  it("uses pre-seeded cache for same-tab lookups", async () => {
    const currentTabRows: Row[] = [
      { email: "alice@acme.com", score: "90" },
      { email: "bob@acme.com", score: "75" },
    ];
    const adapter = new MockAdapter(new Map());
    const cache = new Map<string, Row[]>([["Sheet1", currentTabRows]]);

    const action = makeAction({
      sourceTab: "Sheet1",
      matchColumn: "email",
      matchValue: "{{row.lookup_email}}",
      returnColumn: "score",
    });
    const context = makeContext({ lookup_email: "bob@acme.com" });

    const result = await executeLookup(
      action,
      context,
      makeOptions(adapter, cache),
    );

    expect(result).toBe("75");
    // Should NOT have called adapter.readRows (data was in cache)
    expect(adapter.readRowsCalls).toHaveLength(0);
  });

  it("defaults matchOperator to equals", async () => {
    const companiesData: Row[] = [{ domain: "acme.com", name: "Acme Corp" }];
    const adapter = new MockAdapter(new Map([["Companies", companiesData]]));
    // No matchOperator set — should default to "equals"
    const action = makeAction({ matchOperator: undefined });
    const context = makeContext({ company_domain: "acme" });

    const result = await executeLookup(action, context, makeOptions(adapter));

    // "acme" !== "acme.com" with equals
    expect(result).toBeNull();
  });

  it("defaults matchMode to first", async () => {
    const companiesData: Row[] = [
      { domain: "acme.com", name: "Acme US" },
      { domain: "acme.com", name: "Acme EU" },
    ];
    const adapter = new MockAdapter(new Map([["Companies", companiesData]]));
    const action = makeAction({ matchMode: undefined });
    const context = makeContext({ company_domain: "acme.com" });

    const result = await executeLookup(action, context, makeOptions(adapter));

    // Should return only first match, not JSON array
    expect(result).toBe("Acme US");
  });
});
