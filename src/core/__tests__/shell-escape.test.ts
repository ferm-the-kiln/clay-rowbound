import { describe, expect, it } from "vitest";
import { shellEscape } from "../shell-escape.js";

describe("shellEscape", () => {
  it("wraps a simple value in single quotes", () => {
    expect(shellEscape("hello")).toBe("'hello'");
  });

  it("escapes embedded single quotes", () => {
    expect(shellEscape("it's")).toBe("'it'\\''s'");
  });

  it("handles empty string", () => {
    expect(shellEscape("")).toBe("''");
  });

  it("neutralizes $() command substitution", () => {
    const escaped = shellEscape("$(evil)");
    expect(escaped).toBe("'$(evil)'");
  });

  it("neutralizes backtick command substitution", () => {
    const escaped = shellEscape("`evil`");
    expect(escaped).toBe("'`evil`'");
  });

  it("neutralizes semicolons", () => {
    const escaped = shellEscape("; rm -rf /");
    expect(escaped).toBe("'; rm -rf /'");
  });

  it("neutralizes pipes", () => {
    const escaped = shellEscape("| cat /etc/passwd");
    expect(escaped).toBe("'| cat /etc/passwd'");
  });

  it("handles newlines", () => {
    const escaped = shellEscape("line1\nline2");
    expect(escaped).toBe("'line1\nline2'");
  });

  it("handles double quotes", () => {
    const escaped = shellEscape('say "hello"');
    expect(escaped).toBe("'say \"hello\"'");
  });
});
