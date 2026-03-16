import { describe, expect, it } from "vitest";
import { extractValue } from "../extractor.js";

describe("extractValue", () => {
  it("extracts a simple top-level field", () => {
    const data = { name: "Alice", age: 30 };
    expect(extractValue(data, "$.name")).toBe("Alice");
  });

  it("extracts a nested field", () => {
    const data = { user: { profile: { email: "alice@example.com" } } };
    expect(extractValue(data, "$.user.profile.email")).toBe(
      "alice@example.com",
    );
  });

  it("extracts from an array — takes first element", () => {
    const data = { items: ["first", "second", "third"] };
    expect(extractValue(data, "$.items[0]")).toBe("first");
  });

  it("returns first match when path matches multiple values", () => {
    const data = { items: [{ name: "a" }, { name: "b" }] };
    expect(extractValue(data, "$.items[*].name")).toBe("a");
  });

  it("returns empty string for missing paths", () => {
    const data = { name: "Alice" };
    expect(extractValue(data, "$.nonexistent")).toBe("");
  });

  it("returns empty string for deeply missing paths", () => {
    const data = { a: { b: 1 } };
    expect(extractValue(data, "$.a.b.c.d")).toBe("");
  });

  it("coerces numbers to string", () => {
    const data = { count: 42 };
    expect(extractValue(data, "$.count")).toBe("42");
  });

  it("coerces booleans to string", () => {
    const data = { active: true };
    expect(extractValue(data, "$.active")).toBe("true");
  });

  it("JSON.stringifies object results", () => {
    const data = { user: { name: "Alice", age: 30 } };
    const result = extractValue(data, "$.user");
    expect(result).toBe(JSON.stringify({ name: "Alice", age: 30 }));
  });

  it("handles null values", () => {
    const data = { value: null };
    expect(extractValue(data, "$.value")).toBe("");
  });

  it("handles root-level access with $", () => {
    const data = { key: "value" };
    expect(extractValue(data, "$.key")).toBe("value");
  });

  it("returns empty string for invalid JSONPath expression", () => {
    const data = { name: "Alice" };
    // Invalid expression should not throw
    expect(extractValue(data, "")).toBe("");
  });

  it("handles undefined data gracefully", () => {
    expect(extractValue(undefined, "$.name")).toBe("");
  });

  it("handles array at root", () => {
    const data = [{ name: "Alice" }, { name: "Bob" }];
    expect(extractValue(data, "$[0].name")).toBe("Alice");
  });

  it("extracts using wildcard deep scan", () => {
    const data = {
      company: {
        employees: [
          { name: "Alice", role: "eng" },
          { name: "Bob", role: "design" },
        ],
      },
    };
    // Deep scan for first 'name' found
    expect(extractValue(data, "$..name")).toBe("Alice");
  });
});
