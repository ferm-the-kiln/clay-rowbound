import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecutionContext, WaterfallAction } from "../types.js";
import { executeWaterfall } from "../waterfall.js";

// Mock dependencies
vi.mock("../http-client.js", () => ({
  httpRequest: vi.fn(),
  StopProviderError: class StopProviderError extends Error {
    constructor(message = "Provider stopped") {
      super(message);
      this.name = "StopProviderError";
    }
  },
}));

vi.mock("../extractor.js", () => ({
  extractValue: vi.fn(),
}));

import { extractValue } from "../extractor.js";
// Import the mocked modules to control them
import { httpRequest, StopProviderError } from "../http-client.js";

const mockHttpRequest = vi.mocked(httpRequest);
const mockExtractValue = vi.mocked(extractValue);

function makeAction(
  providers: WaterfallAction["providers"] = [],
): WaterfallAction {
  return {
    id: "find_email",
    type: "waterfall",
    target: "email",
    providers,
  };
}

function makeContext(
  row: Record<string, string> = {},
  env: Record<string, string> = {},
): ExecutionContext {
  return { row, env };
}

describe("executeWaterfall", () => {
  beforeEach(() => {
    mockHttpRequest.mockReset();
    mockExtractValue.mockReset();
  });

  it("tries providers in order and returns first success", async () => {
    const action = makeAction([
      {
        name: "provider-a",
        method: "GET",
        url: "https://a.example.com/{{row.domain}}",
        extract: "$.email",
      },
      {
        name: "provider-b",
        method: "GET",
        url: "https://b.example.com/{{row.domain}}",
        extract: "$.email",
      },
    ]);

    const context = makeContext({ domain: "acme.com" }, { API_KEY: "key123" });

    mockHttpRequest.mockResolvedValueOnce({
      status: 200,
      data: { email: "alice@acme.com" },
    });
    mockExtractValue.mockReturnValueOnce("alice@acme.com");

    const result = await executeWaterfall(action, context);

    expect(result).toEqual({
      value: "alice@acme.com",
      provider: "provider-a",
    });

    // Should only call the first provider
    expect(mockHttpRequest).toHaveBeenCalledTimes(1);
    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        url: "https://a.example.com/acme.com",
      }),
    );
  });

  it("skips failed providers and tries next", async () => {
    const action = makeAction([
      {
        name: "provider-a",
        method: "GET",
        url: "https://a.example.com",
        extract: "$.email",
      },
      {
        name: "provider-b",
        method: "GET",
        url: "https://b.example.com",
        extract: "$.email",
      },
    ]);

    const context = makeContext();

    // First provider returns null (skipped/failed)
    mockHttpRequest.mockResolvedValueOnce(null);

    // Second provider succeeds
    mockHttpRequest.mockResolvedValueOnce({
      status: 200,
      data: { email: "bob@acme.com" },
    });
    mockExtractValue.mockReturnValueOnce("bob@acme.com");

    const result = await executeWaterfall(action, context);

    expect(result).toEqual({
      value: "bob@acme.com",
      provider: "provider-b",
    });
    expect(mockHttpRequest).toHaveBeenCalledTimes(2);
  });

  it("skips provider when extraction returns empty string", async () => {
    const action = makeAction([
      {
        name: "provider-a",
        method: "GET",
        url: "https://a.example.com",
        extract: "$.email",
      },
      {
        name: "provider-b",
        method: "GET",
        url: "https://b.example.com",
        extract: "$.email",
      },
    ]);

    const context = makeContext();

    // First provider returns data but extraction is empty
    mockHttpRequest.mockResolvedValueOnce({
      status: 200,
      data: { name: "Alice" },
    });
    mockExtractValue.mockReturnValueOnce("");

    // Second provider succeeds
    mockHttpRequest.mockResolvedValueOnce({
      status: 200,
      data: { email: "alice@acme.com" },
    });
    mockExtractValue.mockReturnValueOnce("alice@acme.com");

    const result = await executeWaterfall(action, context);

    expect(result).toEqual({
      value: "alice@acme.com",
      provider: "provider-b",
    });
  });

  it("handles StopProviderError by moving to next provider", async () => {
    const action = makeAction([
      {
        name: "provider-a",
        method: "GET",
        url: "https://a.example.com",
        extract: "$.email",
        onError: { "403": "stop_provider" },
      },
      {
        name: "provider-b",
        method: "GET",
        url: "https://b.example.com",
        extract: "$.email",
      },
    ]);

    const context = makeContext();

    // First provider throws StopProviderError
    mockHttpRequest.mockRejectedValueOnce(
      new StopProviderError("Provider stopped: HTTP 403"),
    );

    // Second provider succeeds
    mockHttpRequest.mockResolvedValueOnce({
      status: 200,
      data: { email: "found@example.com" },
    });
    mockExtractValue.mockReturnValueOnce("found@example.com");

    const result = await executeWaterfall(action, context);

    expect(result).toEqual({
      value: "found@example.com",
      provider: "provider-b",
    });
    expect(mockHttpRequest).toHaveBeenCalledTimes(2);
  });

  it("handles generic errors by moving to next provider", async () => {
    const action = makeAction([
      {
        name: "provider-a",
        method: "GET",
        url: "https://a.example.com",
        extract: "$.email",
      },
      {
        name: "provider-b",
        method: "GET",
        url: "https://b.example.com",
        extract: "$.email",
      },
    ]);

    const context = makeContext();

    // First provider throws a generic error
    mockHttpRequest.mockRejectedValueOnce(new Error("Network timeout"));

    // Second provider succeeds
    mockHttpRequest.mockResolvedValueOnce({
      status: 200,
      data: { email: "fallback@example.com" },
    });
    mockExtractValue.mockReturnValueOnce("fallback@example.com");

    const result = await executeWaterfall(action, context);

    expect(result).toEqual({
      value: "fallback@example.com",
      provider: "provider-b",
    });
  });

  it("returns null when all providers fail", async () => {
    const action = makeAction([
      {
        name: "provider-a",
        method: "GET",
        url: "https://a.example.com",
        extract: "$.email",
      },
      {
        name: "provider-b",
        method: "GET",
        url: "https://b.example.com",
        extract: "$.email",
      },
    ]);

    const context = makeContext();

    // Both providers return null
    mockHttpRequest.mockResolvedValueOnce(null);
    mockHttpRequest.mockResolvedValueOnce(null);

    const result = await executeWaterfall(action, context);

    expect(result).toBeNull();
    expect(mockHttpRequest).toHaveBeenCalledTimes(2);
  });

  it("returns null for empty provider list", async () => {
    const action = makeAction([]);
    const context = makeContext();

    const result = await executeWaterfall(action, context);

    expect(result).toBeNull();
  });

  it("resolves templates in url, headers, and body", async () => {
    const action = makeAction([
      {
        name: "provider-a",
        method: "POST",
        url: "https://api.example.com/{{row.domain}}",
        headers: {
          Authorization: "Bearer {{env.API_KEY}}",
        },
        body: { query: "{{row.name}}" },
        extract: "$.result",
      },
    ]);

    const context = makeContext(
      { domain: "acme.com", name: "Alice" },
      { API_KEY: "secret123" },
    );

    mockHttpRequest.mockResolvedValueOnce({
      status: 200,
      data: { result: "found" },
    });
    mockExtractValue.mockReturnValueOnce("found");

    await executeWaterfall(action, context);

    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        method: "POST",
        url: "https://api.example.com/acme.com",
        headers: { Authorization: "Bearer secret123" },
        body: { query: "Alice" },
      }),
    );
  });

  it("passes rate limiter and retry attempts to httpRequest", async () => {
    const action = makeAction([
      {
        name: "provider-a",
        method: "GET",
        url: "https://api.example.com",
        extract: "$.value",
      },
    ]);

    const context = makeContext();
    const mockLimiter = {
      acquire: vi.fn().mockResolvedValue(undefined),
    } as any;

    mockHttpRequest.mockResolvedValueOnce({
      status: 200,
      data: { value: "test" },
    });
    mockExtractValue.mockReturnValueOnce("test");

    await executeWaterfall(action, context, {
      rateLimiter: mockLimiter,
      retryAttempts: 3,
    });

    expect(mockHttpRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        rateLimiter: mockLimiter,
        retryAttempts: 3,
      }),
    );
  });
});
