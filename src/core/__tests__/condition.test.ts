import { describe, expect, it, vi } from "vitest";
import { evaluateCondition, preCheckExpression } from "../condition.js";

describe("evaluateCondition", () => {
  const context = {
    row: { email: "test@example.com", status: "new", score: "85" },
    env: { THRESHOLD: "50" },
    results: { lookup: { found: true } },
  };

  it("returns true for empty expression", () => {
    expect(evaluateCondition("", context)).toBe(true);
  });

  it("returns true for undefined expression", () => {
    expect(evaluateCondition(undefined, context)).toBe(true);
  });

  it("returns true for whitespace-only expression", () => {
    expect(evaluateCondition("   ", context)).toBe(true);
  });

  it("evaluates truthy expressions", () => {
    expect(evaluateCondition("true", context)).toBe(true);
    expect(evaluateCondition("1 === 1", context)).toBe(true);
  });

  it("evaluates falsy expressions", () => {
    expect(evaluateCondition("false", context)).toBe(false);
    expect(evaluateCondition("1 === 2", context)).toBe(false);
  });

  it("accesses row data", () => {
    expect(evaluateCondition('row.email === "test@example.com"', context)).toBe(
      true,
    );
    expect(evaluateCondition('row.status === "new"', context)).toBe(true);
    expect(evaluateCondition('row.status === "processed"', context)).toBe(
      false,
    );
  });

  it("accesses env data", () => {
    expect(evaluateCondition('env.THRESHOLD === "50"', context)).toBe(true);
  });

  it("accesses results data", () => {
    expect(evaluateCondition("results.lookup.found === true", context)).toBe(
      true,
    );
  });

  it("supports complex expressions", () => {
    expect(
      evaluateCondition(
        'row.email.includes("@") && Number(row.score) > 50',
        context,
      ),
    ).toBe(true);
  });

  it("throws on syntax errors instead of silently returning false", () => {
    expect(() => evaluateCondition("not valid js !!!", context)).toThrow(
      /Condition evaluation failed/,
    );
  });

  it("returns false with warning on timeout (infinite loop)", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(evaluateCondition("while(true) {}", context)).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("threw at runtime"),
    );
    warnSpy.mockRestore();
  }, 5000);

  it("returns false for empty row check on missing field", () => {
    expect(evaluateCondition("row.missing !== undefined", context)).toBe(false);
  });

  it("does not expose global scope", () => {
    // process, require, etc. should be blocked by pre-check
    expect(() =>
      evaluateCondition("typeof process !== 'undefined'", context),
    ).toThrow(/forbidden keyword.*process/);
    expect(() =>
      evaluateCondition("typeof require !== 'undefined'", context),
    ).toThrow(/forbidden keyword.*require/);
  });

  it("does not allow prototype chain escape", () => {
    // The classic vm escape: this.constructor.constructor('return process')()
    // Now blocked by pre-check for "this" and "constructor" keywords
    expect(() =>
      evaluateCondition(
        "this.constructor.constructor('return process')().exit()",
        context,
      ),
    ).toThrow(/forbidden keyword/);
  });

  describe("forbidden keyword pre-check", () => {
    it("blocks 'process' keyword", () => {
      expect(() => evaluateCondition("process.exit()", context)).toThrow(
        /forbidden keyword.*process/,
      );
    });

    it("blocks 'require' keyword", () => {
      expect(() => evaluateCondition("require('fs')", context)).toThrow(
        /forbidden keyword.*require/,
      );
    });

    it("blocks 'import' keyword", () => {
      expect(() => evaluateCondition("import('fs')", context)).toThrow(
        /forbidden keyword.*import/,
      );
    });

    it("blocks 'globalThis' keyword", () => {
      expect(() =>
        evaluateCondition("globalThis.constructor", context),
      ).toThrow(/forbidden keyword.*globalThis/);
    });

    it("blocks 'Function' keyword", () => {
      expect(() =>
        evaluateCondition("Function('return 1')()", context),
      ).toThrow(/forbidden keyword.*Function/);
    });

    it("blocks '__proto__' keyword", () => {
      expect(() => evaluateCondition("row.__proto__", context)).toThrow(
        /forbidden keyword.*__proto__/,
      );
    });

    it("blocks 'prototype' keyword", () => {
      expect(() =>
        evaluateCondition("Object.prototype.toString", context),
      ).toThrow(/forbidden keyword.*prototype/);
    });

    it("blocks 'constructor' keyword", () => {
      expect(() => evaluateCondition("row.constructor", context)).toThrow(
        /forbidden keyword.*constructor/,
      );
    });

    it("blocks 'eval' keyword", () => {
      expect(() => evaluateCondition("eval('1')", context)).toThrow(
        /forbidden keyword/,
      );
    });

    it("blocks 'Reflect' keyword", () => {
      expect(() => evaluateCondition("Reflect.ownKeys(row)", context)).toThrow(
        /forbidden keyword.*Reflect/,
      );
    });

    it("blocks 'Proxy' keyword", () => {
      expect(() => evaluateCondition("new Proxy({}, {})", context)).toThrow(
        /forbidden keyword.*Proxy/,
      );
    });

    it("blocks 'Symbol' keyword", () => {
      expect(() => evaluateCondition("Symbol('test')", context)).toThrow(
        /forbidden keyword.*Symbol/,
      );
    });

    it("blocks 'WeakRef' keyword", () => {
      expect(() => evaluateCondition("new WeakRef(row)", context)).toThrow(
        /forbidden keyword.*WeakRef/,
      );
    });

    it("blocks 'this' keyword", () => {
      expect(() => evaluateCondition("this === true", context)).toThrow(
        /forbidden keyword.*this/,
      );
    });

    it("allows legitimate expressions without forbidden keywords", () => {
      // These should all work fine
      expect(evaluateCondition("row.email.includes('@')", context)).toBe(true);
      expect(evaluateCondition("Number(row.score) > 50", context)).toBe(true);
      expect(evaluateCondition("true", context)).toBe(true);
    });
  });
});

describe("preCheckExpression", () => {
  it("does not throw for safe expressions", () => {
    expect(() => preCheckExpression("row.name === 'test'")).not.toThrow();
    expect(() => preCheckExpression("1 + 2")).not.toThrow();
    expect(() => preCheckExpression("true")).not.toThrow();
  });

  it("throws for each forbidden keyword", () => {
    const forbidden = [
      "process",
      "require",
      "import",
      "globalThis",
      "global",
      "Function",
      "__proto__",
      "prototype",
      "constructor",
      "eval",
      "Reflect",
      "Proxy",
      "Symbol",
      "WeakRef",
      "this",
    ];
    for (const keyword of forbidden) {
      expect(() => preCheckExpression(keyword)).toThrow(
        `Expression contains forbidden keyword: "${keyword}"`,
      );
    }
  });

  it("does not match partial words", () => {
    // "processing" should not match "process"
    expect(() => preCheckExpression("row.processing")).not.toThrow();
    // "imported" should not match "import"
    expect(() => preCheckExpression("row.imported")).not.toThrow();
  });
});
