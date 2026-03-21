import { describe, expect, it } from "vitest";
import type {
  Adapter,
  CellUpdate,
  ExecutionContext,
  PipelineConfig,
  Row,
  SheetRef,
  WriteAction,
} from "../types.js";
import { executeWrite, type WriteOptions } from "../write-action.js";

/** Mock adapter that tracks writes and serves per-tab data */
class MockAdapter implements Adapter {
  public writtenBatches: Array<{ ref: SheetRef; updates: CellUpdate[] }> = [];
  private tabData: Map<string, Row[]>;
  private tabHeaders: Map<string, string[]>;

  constructor(
    tabData: Map<string, Row[]> = new Map(),
    tabHeaders?: Map<string, string[]>,
  ) {
    this.tabData = tabData;
    this.tabHeaders =
      tabHeaders ??
      new Map(
        [...tabData.entries()].map(([name, rows]) => [
          name,
          rows.length > 0 ? Object.keys(rows[0]!) : [],
        ]),
      );
  }

  async readRows(ref: SheetRef): Promise<Row[]> {
    return this.tabData.get(ref.sheetName ?? "Sheet1") ?? [];
  }

  async writeCell(_ref: SheetRef, _update: CellUpdate): Promise<void> {}

  async writeBatch(ref: SheetRef, updates: CellUpdate[]): Promise<void> {
    this.writtenBatches.push({ ref, updates });
  }

  async readConfig(_ref: SheetRef): Promise<PipelineConfig | null> {
    return null;
  }
  async writeConfig(_ref: SheetRef, _config: PipelineConfig): Promise<void> {}

  async getHeaders(ref: SheetRef): Promise<string[]> {
    const tabName = ref.sheetName ?? "Sheet1";
    const headers = this.tabHeaders.get(tabName);
    if (!headers) throw new Error(`Tab "${tabName}" not found`);
    return headers;
  }
}

const SPREADSHEET_ID = "test-sheet-id";

function makeAction(overrides: Partial<WriteAction> = {}): WriteAction {
  return {
    id: "write_1",
    type: "write",
    target: "write_status",
    destTab: "Leads",
    columns: {
      Name: "{{row.full_name}}",
      Email: "{{row.email}}",
    },
    ...overrides,
  };
}

function makeContext(
  row: Row = {},
  item?: Record<string, string>,
): ExecutionContext {
  return { row, env: {}, item };
}

function makeOptions(adapter: MockAdapter, dryRun = false): WriteOptions {
  return { adapter, spreadsheetId: SPREADSHEET_ID, dryRun };
}

describe("executeWrite", () => {
  describe("append mode", () => {
    it("writes a new row after existing data", async () => {
      const destData: Row[] = [
        { Name: "Existing", Email: "existing@test.com" },
      ];
      const adapter = new MockAdapter(new Map([["Leads", destData]]));
      const action = makeAction();
      const context = makeContext({
        full_name: "Alice Smith",
        email: "alice@acme.com",
      });

      const result = await executeWrite(action, context, makeOptions(adapter));

      expect(result).toBe("wrote 1 row to Leads");
      expect(adapter.writtenBatches).toHaveLength(1);

      const updates = adapter.writtenBatches[0]!.updates;
      // Row 3: row 1 = headers, row 2 = existing data, row 3 = new row
      expect(updates).toContainEqual({
        row: 3,
        column: "Name",
        value: "Alice Smith",
      });
      expect(updates).toContainEqual({
        row: 3,
        column: "Email",
        value: "alice@acme.com",
      });
    });

    it("writes to row 2 when destination is empty", async () => {
      const adapter = new MockAdapter(
        new Map([["Leads", []]]),
        new Map([["Leads", ["Name", "Email"]]]),
      );
      const action = makeAction();
      const context = makeContext({
        full_name: "Alice",
        email: "alice@acme.com",
      });

      const result = await executeWrite(action, context, makeOptions(adapter));

      expect(result).toBe("wrote 1 row to Leads");
      const updates = adapter.writtenBatches[0]!.updates;
      expect(updates[0]!.row).toBe(2); // First data row
    });

    it("skips columns not in destination headers", async () => {
      const adapter = new MockAdapter(
        new Map([["Leads", []]]),
        new Map([["Leads", ["Name"]]]), // Only "Name" header, no "Email"
      );
      const action = makeAction();
      const context = makeContext({
        full_name: "Alice",
        email: "alice@acme.com",
      });

      await executeWrite(action, context, makeOptions(adapter));

      const updates = adapter.writtenBatches[0]!.updates;
      expect(updates).toHaveLength(1);
      expect(updates[0]!.column).toBe("Name");
    });

    it("does not write in dry run mode", async () => {
      const adapter = new MockAdapter(
        new Map([["Leads", []]]),
        new Map([["Leads", ["Name", "Email"]]]),
      );
      const action = makeAction();
      const context = makeContext({
        full_name: "Alice",
        email: "alice@acme.com",
      });

      const result = await executeWrite(
        action,
        context,
        makeOptions(adapter, true),
      );

      expect(result).toBe("wrote 1 row to Leads");
      expect(adapter.writtenBatches).toHaveLength(0);
    });
  });

  describe("upsert mode", () => {
    it("updates existing row when match found", async () => {
      const destData: Row[] = [
        { Name: "Old Name", Email: "alice@acme.com" },
        { Name: "Bob", Email: "bob@acme.com" },
      ];
      const adapter = new MockAdapter(new Map([["Leads", destData]]));
      const action = makeAction({
        mode: "upsert",
        upsertMatch: {
          column: "Email",
          value: "{{row.email}}",
        },
      });
      const context = makeContext({
        full_name: "Alice Updated",
        email: "alice@acme.com",
      });

      const result = await executeWrite(action, context, makeOptions(adapter));

      expect(result).toBe("upserted 1 row to Leads");
      const updates = adapter.writtenBatches[0]!.updates;
      // alice@acme.com is at index 0 → sheet row 2
      expect(updates).toContainEqual({
        row: 2,
        column: "Name",
        value: "Alice Updated",
      });
    });

    it("appends when no match found", async () => {
      const destData: Row[] = [{ Name: "Bob", Email: "bob@acme.com" }];
      const adapter = new MockAdapter(new Map([["Leads", destData]]));
      const action = makeAction({
        mode: "upsert",
        upsertMatch: {
          column: "Email",
          value: "{{row.email}}",
        },
      });
      const context = makeContext({
        full_name: "Alice New",
        email: "alice@new.com",
      });

      const result = await executeWrite(action, context, makeOptions(adapter));

      expect(result).toBe("upserted 1 row to Leads");
      const updates = adapter.writtenBatches[0]!.updates;
      // No match → append at row 3 (after 1 existing data row + header)
      expect(updates).toContainEqual({
        row: 3,
        column: "Name",
        value: "Alice New",
      });
    });

    it("returns error when upsertMatch is missing", async () => {
      const adapter = new MockAdapter(
        new Map([["Leads", []]]),
        new Map([["Leads", ["Name", "Email"]]]),
      );
      const action = makeAction({ mode: "upsert" }); // no upsertMatch
      const context = makeContext({ full_name: "Alice", email: "a@b.com" });

      const result = await executeWrite(action, context, makeOptions(adapter));

      expect(result).toBe(
        "error: upsert requires upsertMatch.column and upsertMatch.value",
      );
    });
  });

  describe("array expansion", () => {
    it("creates multiple rows from JSON array", async () => {
      const adapter = new MockAdapter(
        new Map([["Contacts", []]]),
        new Map([["Contacts", ["Name", "Email", "Company"]]]),
      );
      const action = makeAction({
        destTab: "Contacts",
        columns: {
          Name: "{{item.name}}",
          Email: "{{item.email}}",
          Company: "{{row.company}}",
        },
        expand: "{{row.contacts_json}}",
      });
      const context = makeContext({
        company: "Acme Corp",
        contacts_json: JSON.stringify([
          { name: "Alice", email: "alice@acme.com" },
          { name: "Bob", email: "bob@acme.com" },
        ]),
      });

      const result = await executeWrite(action, context, makeOptions(adapter));

      expect(result).toBe("wrote 2 rows to Contacts");
      const updates = adapter.writtenBatches[0]!.updates;

      // Row 2: Alice
      expect(updates).toContainEqual({
        row: 2,
        column: "Name",
        value: "Alice",
      });
      expect(updates).toContainEqual({
        row: 2,
        column: "Email",
        value: "alice@acme.com",
      });
      expect(updates).toContainEqual({
        row: 2,
        column: "Company",
        value: "Acme Corp",
      });

      // Row 3: Bob
      expect(updates).toContainEqual({
        row: 3,
        column: "Name",
        value: "Bob",
      });
      expect(updates).toContainEqual({
        row: 3,
        column: "Email",
        value: "bob@acme.com",
      });
    });

    it("returns null when expand resolves to invalid JSON", async () => {
      const adapter = new MockAdapter(
        new Map([["Contacts", []]]),
        new Map([["Contacts", ["Name"]]]),
      );
      const action = makeAction({
        destTab: "Contacts",
        columns: { Name: "{{item.name}}" },
        expand: "{{row.bad_json}}",
      });
      const context = makeContext({ bad_json: "not json" });

      const result = await executeWrite(action, context, makeOptions(adapter));

      expect(result).toBeNull();
    });

    it("returns null when expand resolves to empty array", async () => {
      const adapter = new MockAdapter(
        new Map([["Contacts", []]]),
        new Map([["Contacts", ["Name"]]]),
      );
      const action = makeAction({
        destTab: "Contacts",
        columns: { Name: "{{item.name}}" },
        expand: "{{row.arr}}",
      });
      const context = makeContext({ arr: "[]" });

      const result = await executeWrite(action, context, makeOptions(adapter));

      expect(result).toBeNull();
    });

    it("handles scalar array elements via {{item._value}}", async () => {
      const adapter = new MockAdapter(
        new Map([["Tags", []]]),
        new Map([["Tags", ["Tag", "Source"]]]),
      );
      const action = makeAction({
        destTab: "Tags",
        columns: {
          Tag: "{{item._value}}",
          Source: "{{row.company}}",
        },
        expand: "{{row.tags}}",
      });
      const context = makeContext({
        company: "Acme",
        tags: JSON.stringify(["saas", "b2b", "enterprise"]),
      });

      const result = await executeWrite(action, context, makeOptions(adapter));

      expect(result).toBe("wrote 3 rows to Tags");
      const updates = adapter.writtenBatches[0]!.updates;
      expect(updates).toContainEqual({
        row: 2,
        column: "Tag",
        value: "saas",
      });
      expect(updates).toContainEqual({
        row: 3,
        column: "Tag",
        value: "b2b",
      });
      expect(updates).toContainEqual({
        row: 4,
        column: "Tag",
        value: "enterprise",
      });
    });

    it("extracts array from object using expandPath", async () => {
      const adapter = new MockAdapter(
        new Map([["Contacts", []]]),
        new Map([["Contacts", ["Name", "Title", "Company"]]]),
      );
      const action = makeAction({
        destTab: "Contacts",
        columns: {
          Name: "{{item.name}}",
          Title: "{{item.title}}",
          Company: "{{row.company}}",
        },
        expand: "{{row.contacts_json}}",
        expandPath: "$.contacts",
      });
      const context = makeContext({
        company: "Acme Corp",
        contacts_json: JSON.stringify({
          contacts: [
            { name: "Alice", title: "CEO" },
            { name: "Bob", title: "CTO" },
          ],
        }),
      });

      const result = await executeWrite(action, context, makeOptions(adapter));

      expect(result).toBe("wrote 2 rows to Contacts");
      const updates = adapter.writtenBatches[0]!.updates;
      expect(updates).toContainEqual({
        row: 2,
        column: "Name",
        value: "Alice",
      });
      expect(updates).toContainEqual({
        row: 2,
        column: "Company",
        value: "Acme Corp",
      });
      expect(updates).toContainEqual({
        row: 3,
        column: "Name",
        value: "Bob",
      });
    });

    it("returns null when expandPath points to missing field", async () => {
      const adapter = new MockAdapter(
        new Map([["Contacts", []]]),
        new Map([["Contacts", ["Name"]]]),
      );
      const action = makeAction({
        destTab: "Contacts",
        columns: { Name: "{{item.name}}" },
        expand: "{{row.data}}",
        expandPath: "$.nonexistent",
      });
      const context = makeContext({
        data: JSON.stringify({ other: "value" }),
      });

      const result = await executeWrite(action, context, makeOptions(adapter));

      expect(result).toBeNull();
    });
  });

  describe("error handling", () => {
    it("returns error when destination tab does not exist", async () => {
      // Adapter has no tab data for "Leads"
      const adapter = new MockAdapter(new Map());
      const action = makeAction();
      const context = makeContext({
        full_name: "Alice",
        email: "alice@acme.com",
      });

      const result = await executeWrite(action, context, makeOptions(adapter));

      expect(result).toContain("error:");
      expect(result).toContain("Leads");
    });

    it("returns null when expand template resolves to empty string", async () => {
      const adapter = new MockAdapter(
        new Map([["Contacts", []]]),
        new Map([["Contacts", ["Name"]]]),
      );
      const action = makeAction({
        destTab: "Contacts",
        columns: { Name: "{{item.name}}" },
        expand: "{{row.missing}}",
      });
      const context = makeContext({}); // no "missing" key

      const result = await executeWrite(action, context, makeOptions(adapter));

      expect(result).toBeNull();
    });
  });

  describe("defaults", () => {
    it("defaults mode to append", async () => {
      const adapter = new MockAdapter(
        new Map([["Leads", []]]),
        new Map([["Leads", ["Name"]]]),
      );
      const action = makeAction({ mode: undefined });
      const context = makeContext({ full_name: "Alice", email: "a@b.com" });

      const result = await executeWrite(action, context, makeOptions(adapter));

      expect(result).toBe("wrote 1 row to Leads");
    });
  });
});
