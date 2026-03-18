import { execFile } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PipelineConfig, SheetRef } from "../../../core/types.js";
import {
  columnIndexToLetter,
  runGws,
  SheetsAdapter,
} from "../sheets-adapter.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

const mockExecFile = vi.mocked(execFile);

function mockGwsResponse(stdout: string) {
  mockExecFile.mockImplementation(((
    _cmd: unknown,
    _args: unknown,
    _opts: unknown,
    callback: unknown,
  ) => {
    (callback as (err: null, stdout: string, stderr: string) => void)(
      null,
      stdout,
      "",
    );
  }) as typeof execFile);
}

function mockGwsError(stderr: string) {
  mockExecFile.mockImplementation(((
    _cmd: unknown,
    _args: unknown,
    _opts: unknown,
    callback: unknown,
  ) => {
    const err = new Error("gws failed");
    (callback as (err: Error, stdout: string, stderr: string) => void)(
      err,
      "",
      stderr,
    );
  }) as typeof execFile);
}

/**
 * Mock execFile to return different responses based on call order.
 */
function mockGwsSequence(
  responses: Array<{ stdout?: string; error?: string }>,
) {
  let callIndex = 0;
  mockExecFile.mockImplementation(((
    _cmd: unknown,
    _args: unknown,
    _opts: unknown,
    callback: unknown,
  ) => {
    const resp = responses[callIndex] || responses[responses.length - 1];
    callIndex++;
    if (resp.error) {
      const err = new Error("gws failed");
      (callback as (err: Error, stdout: string, stderr: string) => void)(
        err,
        "",
        resp.error,
      );
    } else {
      (callback as (err: null, stdout: string, stderr: string) => void)(
        null,
        resp.stdout || "",
        "",
      );
    }
  }) as typeof execFile);
}

const ref: SheetRef = {
  spreadsheetId: "test-sheet-123",
  sheetName: "Sheet1",
};

describe("columnIndexToLetter", () => {
  it("converts 0 to A", () => {
    expect(columnIndexToLetter(0)).toBe("A");
  });

  it("converts 25 to Z", () => {
    expect(columnIndexToLetter(25)).toBe("Z");
  });

  it("converts 26 to AA", () => {
    expect(columnIndexToLetter(26)).toBe("AA");
  });

  it("converts 51 to AZ", () => {
    expect(columnIndexToLetter(51)).toBe("AZ");
  });

  it("converts 52 to BA", () => {
    expect(columnIndexToLetter(52)).toBe("BA");
  });

  it("converts 701 to ZZ", () => {
    expect(columnIndexToLetter(701)).toBe("ZZ");
  });

  it("converts 702 to AAA", () => {
    expect(columnIndexToLetter(702)).toBe("AAA");
  });
});

describe("runGws", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns stdout on success", async () => {
    mockGwsResponse("hello");
    const result = await runGws(["arg1", "arg2"]);
    expect(result).toBe("hello");
    expect(mockExecFile).toHaveBeenCalledWith(
      "gws",
      ["arg1", "arg2"],
      expect.objectContaining({ maxBuffer: 50 * 1024 * 1024 }),
      expect.any(Function),
    );
  });

  it("throws on error with stderr", async () => {
    mockGwsError("something went wrong");
    await expect(runGws(["arg1"])).rejects.toThrow(
      "gws failed: something went wrong",
    );
  });
});

describe("SheetsAdapter", () => {
  let adapter: SheetsAdapter;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = new SheetsAdapter();
  });

  describe("readRows", () => {
    it("parses header + data rows into Row objects", async () => {
      const response = JSON.stringify({
        range: "Sheet1!A1:C3",
        majorDimension: "ROWS",
        values: [
          ["Name", "Email", "Company"],
          ["Alice", "alice@example.com", "Acme"],
          ["Bob", "bob@example.com", "Beta"],
        ],
      });

      mockGwsResponse(response);
      const rows = await adapter.readRows(ref);

      expect(rows).toEqual([
        { Name: "Alice", Email: "alice@example.com", Company: "Acme" },
        { Name: "Bob", Email: "bob@example.com", Company: "Beta" },
      ]);

      expect(mockExecFile).toHaveBeenCalledWith(
        "gws",
        [
          "sheets",
          "spreadsheets",
          "values",
          "get",
          "--params",
          JSON.stringify({
            spreadsheetId: "test-sheet-123",
            range: "'Sheet1'",
          }),
          "--format",
          "json",
        ],
        expect.objectContaining({ maxBuffer: 50 * 1024 * 1024 }),
        expect.any(Function),
      );
    });

    it("handles empty rows by padding with empty strings", async () => {
      const response = JSON.stringify({
        range: "Sheet1!A1:C3",
        majorDimension: "ROWS",
        values: [
          ["Name", "Email", "Company"],
          ["Alice"], // short row
        ],
      });

      mockGwsResponse(response);
      const rows = await adapter.readRows(ref);

      expect(rows).toEqual([{ Name: "Alice", Email: "", Company: "" }]);
    });

    it("returns empty array when no values", async () => {
      mockGwsResponse(JSON.stringify({}));
      const rows = await adapter.readRows(ref);
      expect(rows).toEqual([]);
    });

    it("uses default sheet name when sheetName is not set", async () => {
      mockGwsResponse(JSON.stringify({ values: [["A"], ["1"]] }));
      await adapter.readRows({ spreadsheetId: "id123" });

      expect(mockExecFile).toHaveBeenCalledWith(
        "gws",
        expect.arrayContaining([
          "--params",
          JSON.stringify({ spreadsheetId: "id123", range: "'Sheet1'" }),
        ]),
        expect.objectContaining({ maxBuffer: 50 * 1024 * 1024 }),
        expect.any(Function),
      );
    });
  });

  describe("getHeaders", () => {
    it("reads first row and returns headers", async () => {
      const response = JSON.stringify({
        values: [["Name", "Email", "Company"]],
      });

      mockGwsResponse(response);
      const headers = await adapter.getHeaders(ref);

      expect(headers).toEqual(["Name", "Email", "Company"]);
      expect(mockExecFile).toHaveBeenCalledWith(
        "gws",
        [
          "sheets",
          "spreadsheets",
          "values",
          "get",
          "--params",
          JSON.stringify({
            spreadsheetId: "test-sheet-123",
            range: "'Sheet1'!1:1",
          }),
          "--format",
          "json",
        ],
        expect.objectContaining({ maxBuffer: 50 * 1024 * 1024 }),
        expect.any(Function),
      );
    });

    it("caches headers — second call does not invoke gws", async () => {
      const response = JSON.stringify({
        values: [["Name", "Email"]],
      });

      mockGwsResponse(response);

      const first = await adapter.getHeaders(ref);
      const second = await adapter.getHeaders(ref);

      expect(first).toEqual(["Name", "Email"]);
      expect(second).toEqual(["Name", "Email"]);
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it("returns empty array when no values", async () => {
      mockGwsResponse(JSON.stringify({}));
      const headers = await adapter.getHeaders(ref);
      expect(headers).toEqual([]);
    });
  });

  describe("writeBatch", () => {
    it("sends correct gws batchUpdate command with proper range formatting", async () => {
      // First call: getHeaders, second call: batchUpdate
      mockGwsSequence([
        {
          stdout: JSON.stringify({
            values: [["Name", "Email", "Company"]],
          }),
        },
        { stdout: "{}" },
      ]);

      await adapter.writeBatch(ref, [
        { row: 2, column: "Email", value: "new@example.com" },
        { row: 3, column: "Company", value: "NewCo" },
      ]);

      // Second call should be the batchUpdate
      expect(mockExecFile).toHaveBeenCalledTimes(2);

      const batchUpdateCall = mockExecFile.mock.calls[1];
      expect(batchUpdateCall[0]).toBe("gws");
      const args = batchUpdateCall[1] as string[];
      expect(args[0]).toBe("sheets");
      expect(args[1]).toBe("spreadsheets");
      expect(args[2]).toBe("values");
      expect(args[3]).toBe("batchUpdate");

      const jsonArg = JSON.parse(args[args.indexOf("--json") + 1]);
      expect(jsonArg.valueInputOption).toBe("USER_ENTERED");
      expect(jsonArg.data).toEqual([
        { range: "'Sheet1'!B2", values: [["new@example.com"]] },
        { range: "'Sheet1'!C3", values: [["NewCo"]] },
      ]);
    });

    it("throws when column not found in headers", async () => {
      mockGwsResponse(
        JSON.stringify({
          values: [["Name", "Email"]],
        }),
      );

      await expect(
        adapter.writeBatch(ref, [
          { row: 2, column: "NonExistent", value: "val" },
        ]),
      ).rejects.toThrow('Column "NonExistent" not found in headers');
    });
  });

  describe("writeCell", () => {
    it("delegates to writeBatch", async () => {
      mockGwsSequence([
        {
          stdout: JSON.stringify({
            values: [["Name", "Email"]],
          }),
        },
        { stdout: "{}" },
      ]);

      await adapter.writeCell(ref, {
        row: 5,
        column: "Name",
        value: "Charlie",
      });

      expect(mockExecFile).toHaveBeenCalledTimes(2);
    });
  });

  describe("readConfig", () => {
    it("parses config from developer metadata", async () => {
      const config: PipelineConfig = {
        version: "1",
        actions: [],
        settings: {
          concurrency: 5,
          rateLimit: 10,
          retryAttempts: 3,
          retryBackoff: "exponential",
        },
      };

      const response = JSON.stringify({
        matchedDeveloperMetadata: [
          {
            developerMetadata: {
              metadataId: 42,
              metadataKey: "rowbound_config",
              metadataValue: JSON.stringify(config),
              location: { spreadsheet: true },
              visibility: "DOCUMENT",
            },
          },
        ],
      });

      mockGwsResponse(response);
      const result = await adapter.readConfig(ref);
      expect(result).toEqual(config);
    });

    it("returns null when no metadata found", async () => {
      mockGwsResponse(JSON.stringify({ matchedDeveloperMetadata: [] }));
      const result = await adapter.readConfig(ref);
      expect(result).toBeNull();
    });

    it("returns null when gws command fails", async () => {
      mockGwsError("Not found");
      const result = await adapter.readConfig(ref);
      expect(result).toBeNull();
    });

    it("returns null when matchedDeveloperMetadata is absent", async () => {
      mockGwsResponse(JSON.stringify({}));
      const result = await adapter.readConfig(ref);
      expect(result).toBeNull();
    });
  });

  describe("writeConfig", () => {
    const config: PipelineConfig = {
      version: "1",
      actions: [],
      settings: {
        concurrency: 5,
        rateLimit: 10,
        retryAttempts: 3,
        retryBackoff: "exponential",
      },
    };

    it("creates new metadata when none exists", async () => {
      mockGwsSequence([
        {
          // search returns empty
          stdout: JSON.stringify({ matchedDeveloperMetadata: [] }),
        },
        {
          // create succeeds
          stdout: "{}",
        },
      ]);

      await adapter.writeConfig(ref, config);

      expect(mockExecFile).toHaveBeenCalledTimes(2);

      // Verify the create call
      const createCall = mockExecFile.mock.calls[1];
      const args = createCall[1] as string[];
      const jsonArg = JSON.parse(args[args.indexOf("--json") + 1]);
      expect(jsonArg.requests[0].createDeveloperMetadata).toBeDefined();
      expect(
        jsonArg.requests[0].createDeveloperMetadata.developerMetadata
          .metadataValue,
      ).toBe(JSON.stringify(config));
    });

    it("updates existing metadata when it exists", async () => {
      mockGwsSequence([
        {
          // search returns existing
          stdout: JSON.stringify({
            matchedDeveloperMetadata: [
              {
                developerMetadata: {
                  metadataId: 99,
                  metadataKey: "rowbound_config",
                  metadataValue: "{}",
                },
              },
            ],
          }),
        },
        {
          // update succeeds
          stdout: "{}",
        },
      ]);

      await adapter.writeConfig(ref, config);

      expect(mockExecFile).toHaveBeenCalledTimes(2);

      // Verify the update call
      const updateCall = mockExecFile.mock.calls[1];
      const args = updateCall[1] as string[];
      const jsonArg = JSON.parse(args[args.indexOf("--json") + 1]);
      const update = jsonArg.requests[0].updateDeveloperMetadata;
      expect(update).toBeDefined();
      expect(update.dataFilters[0].developerMetadataLookup.metadataId).toBe(99);
      expect(update.developerMetadata.metadataValue).toBe(
        JSON.stringify(config),
      );
      expect(update.fields).toBe("metadataValue");
    });

    it("creates new metadata when search fails", async () => {
      mockGwsSequence([
        { error: "Not found" }, // search fails
        { stdout: "{}" }, // create succeeds
      ]);

      await adapter.writeConfig(ref, config);

      expect(mockExecFile).toHaveBeenCalledTimes(2);
      const createCall = mockExecFile.mock.calls[1];
      const args = createCall[1] as string[];
      const jsonArg = JSON.parse(args[args.indexOf("--json") + 1]);
      expect(jsonArg.requests[0].createDeveloperMetadata).toBeDefined();
    });
  });

  describe("getSheetGid", () => {
    it("returns the numeric sheet ID for the target sheet", async () => {
      mockGwsResponse(
        JSON.stringify({
          sheets: [
            { properties: { sheetId: 0, title: "Sheet1" } },
            { properties: { sheetId: 12345, title: "Data" } },
          ],
        }),
      );

      const gid = await adapter.getSheetGid(ref);
      expect(gid).toBe(0);

      expect(mockExecFile).toHaveBeenCalledWith(
        "gws",
        [
          "sheets",
          "spreadsheets",
          "get",
          "--params",
          JSON.stringify({
            spreadsheetId: "test-sheet-123",
            fields: "sheets.properties",
          }),
          "--format",
          "json",
        ],
        expect.objectContaining({ maxBuffer: 50 * 1024 * 1024 }),
        expect.any(Function),
      );
    });

    it("throws when sheet name not found", async () => {
      mockGwsResponse(
        JSON.stringify({
          sheets: [{ properties: { sheetId: 0, title: "OtherSheet" } }],
        }),
      );

      await expect(adapter.getSheetGid(ref)).rejects.toThrow(
        'Sheet "Sheet1" not found',
      );
    });
  });

  describe("createColumnRange", () => {
    it("sends correct gws command with addNamedRange request", async () => {
      // First call: getSheetGid, second call: batchUpdate
      mockGwsSequence([
        {
          stdout: JSON.stringify({
            sheets: [{ properties: { sheetId: 42, title: "Sheet1" } }],
          }),
        },
        { stdout: "{}" },
      ]);

      await adapter.createColumnRange(ref, "action1", 3);

      expect(mockExecFile).toHaveBeenCalledTimes(2);

      const batchCall = mockExecFile.mock.calls[1];
      const args = batchCall[1] as string[];
      const jsonArg = JSON.parse(args[args.indexOf("--json") + 1]);
      const addReq = jsonArg.requests[0].addNamedRange;

      expect(addReq).toBeDefined();
      expect(addReq.namedRange.name).toBe("_rowbound_action1");
      expect(addReq.namedRange.range).toEqual({
        sheetId: 42,
        startColumnIndex: 3,
        endColumnIndex: 4,
      });
    });
  });

  describe("readColumnRanges", () => {
    it("parses named ranges and returns actionId -> column index map", async () => {
      mockGwsResponse(
        JSON.stringify({
          namedRanges: [
            {
              name: "_rowbound_action1",
              namedRangeId: "nr1",
              range: { sheetId: 0, startColumnIndex: 2, endColumnIndex: 3 },
            },
            {
              name: "_rowbound_action2",
              namedRangeId: "nr2",
              range: { sheetId: 0, startColumnIndex: 5, endColumnIndex: 6 },
            },
          ],
        }),
      );

      const map = await adapter.readColumnRanges(ref);

      expect(map.size).toBe(2);
      expect(map.get("action1")).toBe(2);
      expect(map.get("action2")).toBe(5);
    });

    it("filters to _rowbound_ prefixed ranges only", async () => {
      mockGwsResponse(
        JSON.stringify({
          namedRanges: [
            {
              name: "_rowbound_action1",
              namedRangeId: "nr1",
              range: { sheetId: 0, startColumnIndex: 0, endColumnIndex: 1 },
            },
            {
              name: "user_defined_range",
              namedRangeId: "nr2",
              range: { sheetId: 0, startColumnIndex: 3, endColumnIndex: 4 },
            },
            {
              name: "another_range",
              namedRangeId: "nr3",
              range: { sheetId: 0, startColumnIndex: 7, endColumnIndex: 8 },
            },
          ],
        }),
      );

      const map = await adapter.readColumnRanges(ref);

      expect(map.size).toBe(1);
      expect(map.get("action1")).toBe(0);
    });

    it("returns empty map when no named ranges exist", async () => {
      mockGwsResponse(JSON.stringify({}));

      const map = await adapter.readColumnRanges(ref);
      expect(map.size).toBe(0);
    });

    it("sends correct gws command", async () => {
      mockGwsResponse(JSON.stringify({}));

      await adapter.readColumnRanges(ref);

      expect(mockExecFile).toHaveBeenCalledWith(
        "gws",
        [
          "sheets",
          "spreadsheets",
          "get",
          "--params",
          JSON.stringify({
            spreadsheetId: "test-sheet-123",
            fields: "namedRanges",
          }),
          "--format",
          "json",
        ],
        expect.objectContaining({ maxBuffer: 50 * 1024 * 1024 }),
        expect.any(Function),
      );
    });
  });

  describe("deleteColumnRange", () => {
    it("reads named ranges then deletes the matching one", async () => {
      mockGwsSequence([
        {
          // read named ranges
          stdout: JSON.stringify({
            namedRanges: [
              {
                name: "_rowbound_action1",
                namedRangeId: "nr-abc-123",
                range: { sheetId: 0, startColumnIndex: 2, endColumnIndex: 3 },
              },
            ],
          }),
        },
        { stdout: "{}" }, // delete succeeds
      ]);

      await adapter.deleteColumnRange(ref, "action1");

      expect(mockExecFile).toHaveBeenCalledTimes(2);

      const deleteCall = mockExecFile.mock.calls[1];
      const args = deleteCall[1] as string[];
      const jsonArg = JSON.parse(args[args.indexOf("--json") + 1]);
      expect(jsonArg.requests[0].deleteNamedRange).toEqual({
        namedRangeId: "nr-abc-123",
      });
    });

    it("silently returns when named range not found", async () => {
      mockGwsResponse(
        JSON.stringify({
          namedRanges: [
            {
              name: "_rowbound_other_action",
              namedRangeId: "nr-xyz",
              range: { sheetId: 0, startColumnIndex: 0, endColumnIndex: 1 },
            },
          ],
        }),
      );

      // Should not throw
      await adapter.deleteColumnRange(ref, "nonexistent_action");

      // Only 1 call (the read), no delete call
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it("silently returns when no named ranges exist at all", async () => {
      mockGwsResponse(JSON.stringify({}));

      await adapter.deleteColumnRange(ref, "action1");

      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });
  });
});
