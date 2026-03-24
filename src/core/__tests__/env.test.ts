import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildSafeEnv } from "../env.js";
import type { PipelineConfig } from "../types.js";

describe("buildSafeEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Replace process.env with a controlled copy
    process.env = {
      ROWBOUND_WEBHOOK_TOKEN: "secret123",
      ROWBOUND_ALLOW_HTTP: "true",
      NODE_ENV: "test",
      PATH: "/usr/bin",
      API_KEY: "sk-secret",
      DATABASE_URL: "postgres://localhost/db",
      AWS_SECRET_ACCESS_KEY: "aws-secret",
      HOME: "/Users/test",
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("includes ROWBOUND_* prefixed vars", () => {
    const env = buildSafeEnv();
    expect(env.ROWBOUND_WEBHOOK_TOKEN).toBe("secret123");
    expect(env.ROWBOUND_ALLOW_HTTP).toBe("true");
  });

  it("includes NODE_ENV", () => {
    const env = buildSafeEnv();
    expect(env.NODE_ENV).toBe("test");
  });

  it("includes PATH", () => {
    const env = buildSafeEnv();
    expect(env.PATH).toBe("/usr/bin");
  });

  it("does NOT include arbitrary env vars without config", () => {
    const env = buildSafeEnv();
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
    // HOME is now included as an essential system var for CLI tools
  });

  it("includes env vars referenced in config templates", () => {
    const config: PipelineConfig = {
      version: "2",
      actions: [
        {
          id: "test",
          type: "http",
          target: "result",
          method: "GET",
          url: "https://api.example.com/v1?key={{env.API_KEY}}",
          extract: "$.data",
        },
      ],
      settings: {
        concurrency: 5,
        rateLimit: 10,
        retryAttempts: 3,
        retryBackoff: "exponential",
      },
    };

    const env = buildSafeEnv(config);
    expect(env.API_KEY).toBe("sk-secret");
  });

  it("does not include unreferenced vars even with config", () => {
    const config: PipelineConfig = {
      version: "2",
      actions: [
        {
          id: "test",
          type: "http",
          target: "result",
          method: "GET",
          url: "https://api.example.com/v1?key={{env.API_KEY}}",
          extract: "$.data",
        },
      ],
      settings: {
        concurrency: 5,
        rateLimit: 10,
        retryAttempts: 3,
        retryBackoff: "exponential",
      },
    };

    const env = buildSafeEnv(config);
    expect(env.DATABASE_URL).toBeUndefined();
    expect(env.AWS_SECRET_ACCESS_KEY).toBeUndefined();
  });

  it("scans tab-level actions for env references", () => {
    const config: PipelineConfig = {
      version: "2",
      tabs: {
        "0": {
          name: "Sheet1",
          columns: {},
          actions: [
            {
              id: "test",
              type: "http",
              target: "result",
              method: "GET",
              url: "https://api.example.com/v1",
              headers: { Authorization: "Bearer {{env.API_KEY}}" },
              extract: "$.data",
            },
          ],
        },
      },
      actions: [],
      settings: {
        concurrency: 5,
        rateLimit: 10,
        retryAttempts: 3,
        retryBackoff: "exponential",
      },
    };

    const env = buildSafeEnv(config);
    expect(env.API_KEY).toBe("sk-secret");
  });
});
