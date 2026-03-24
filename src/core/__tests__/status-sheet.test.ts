import { describe, expect, it, vi } from "vitest";
import { StatusAccumulator } from "../status-sheet.js";
import type { Adapter, CellUpdate, SheetRef } from "../types.js";

function makeMockAdapter(): Adapter & {
  batches: Array<{ ref: SheetRef; updates: CellUpdate[] }>;
} {
  const batches: Array<{ ref: SheetRef; updates: CellUpdate[] }> = [];
  return {
    batches,
    readRows: async () => [],
    writeCell: async () => {},
    writeBatch: async (ref: SheetRef, updates: CellUpdate[]) => {
      batches.push({ ref, updates });
    },
    readConfig: async () => null,
    writeConfig: async () => {},
    getHeaders: async () => [],
  };
}

describe("StatusAccumulator", () => {
  it("accumulates entries and flushes them", async () => {
    const adapter = makeMockAdapter();
    const acc = new StatusAccumulator(adapter, "sheet123", "Leads");

    acc.record({ row: 2, actionId: "get_email", status: "success" });
    acc.record({
      row: 2,
      actionId: "get_company",
      status: "error",
      errorMessage: "404",
    });

    expect(acc.getEntries()).toHaveLength(2);
    expect(adapter.batches).toHaveLength(0);

    await acc.flush();

    expect(adapter.batches).toHaveLength(1);
    expect(adapter.batches[0]!.ref.sheetName).toBe("_rowbound_status");
    expect(adapter.batches[0]!.updates).toHaveLength(2);
    // After flush, entries are cleared
    expect(acc.getEntries()).toHaveLength(0);
  });

  it("does nothing on flush when no entries", async () => {
    const adapter = makeMockAdapter();
    const acc = new StatusAccumulator(adapter, "sheet123", "Leads");
    await acc.flush();
    expect(adapter.batches).toHaveLength(0);
  });

  it("includes tab, timestamp, and error message in entries", () => {
    const adapter = makeMockAdapter();
    const acc = new StatusAccumulator(adapter, "sheet123", "Leads");

    acc.record({
      row: 5,
      actionId: "enrich",
      status: "error",
      errorMessage: "Timeout",
      durationMs: 5000,
    });

    const entries = acc.getEntries();
    expect(entries[0]!.tab).toBe("Leads");
    expect(entries[0]!.timestamp).toBeTruthy();
    expect(entries[0]!.errorMessage).toBe("Timeout");
    expect(entries[0]!.durationMs).toBe(5000);
  });

  it("survives flush failure without crashing", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const adapter = makeMockAdapter();
    adapter.writeBatch = async () => {
      throw new Error("Sheets API error");
    };

    const acc = new StatusAccumulator(adapter, "sheet123", "Leads");
    acc.record({ row: 2, actionId: "test", status: "success" });

    // Should not throw
    await acc.flush();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("failed to write status"),
    );
    warnSpy.mockRestore();
  });
});
