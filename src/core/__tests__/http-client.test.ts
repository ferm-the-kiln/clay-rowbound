import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { httpRequest, StopProviderError } from "../http-client.js";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function textResponse(status: number, body: string): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/plain" },
  });
}

describe("httpRequest", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("makes a successful GET request", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(200, { name: "Alice" }));

    const result = await httpRequest({
      method: "GET",
      url: "https://api.example.com/user",
    });

    expect(result).toEqual({
      status: 200,
      data: { name: "Alice" },
    });
    expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/user", {
      method: "GET",
      headers: undefined,
      body: undefined,
      signal: undefined,
    });
  });

  it("sends JSON body for POST requests", async () => {
    mockFetch.mockResolvedValueOnce(jsonResponse(201, { id: 1 }));

    await httpRequest({
      method: "POST",
      url: "https://api.example.com/user",
      headers: { "Content-Type": "application/json" },
      body: { name: "Alice" },
    });

    expect(mockFetch).toHaveBeenCalledWith("https://api.example.com/user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: '{"name":"Alice"}',
      signal: undefined,
    });
  });

  it("parses text responses when content-type is not JSON", async () => {
    mockFetch.mockResolvedValueOnce(textResponse(200, "hello"));

    const result = await httpRequest({
      method: "GET",
      url: "https://api.example.com/text",
    });

    expect(result).toEqual({ status: 200, data: "hello" });
  });

  describe("retry behavior", () => {
    it("retries on 429 status", async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse(429, { error: "rate limited" }))
        .mockResolvedValueOnce(jsonResponse(200, { name: "Alice" }));

      const promise = httpRequest({
        method: "GET",
        url: "https://api.example.com/user",
        retryAttempts: 1,
      });

      // Advance past backoff timer (100ms for first retry)
      await vi.advanceTimersByTimeAsync(150);

      const result = await promise;
      expect(result).toEqual({ status: 200, data: { name: "Alice" } });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("retries on 5xx status", async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse(500, { error: "server error" }))
        .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

      const promise = httpRequest({
        method: "GET",
        url: "https://api.example.com/data",
        retryAttempts: 1,
      });

      await vi.advanceTimersByTimeAsync(150);

      const result = await promise;
      expect(result).toEqual({ status: 200, data: { ok: true } });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("uses exponential backoff timing", async () => {
      mockFetch
        .mockResolvedValueOnce(jsonResponse(500, {}))
        .mockResolvedValueOnce(jsonResponse(500, {}))
        .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

      const promise = httpRequest({
        method: "GET",
        url: "https://api.example.com/data",
        retryAttempts: 2,
      });

      // First retry: 2^0 * 100 = 100ms
      await vi.advanceTimersByTimeAsync(150);
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Second retry: 2^1 * 100 = 200ms
      await vi.advanceTimersByTimeAsync(250);

      const result = await promise;
      expect(result).toEqual({ status: 200, data: { ok: true } });
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it("gives up after exhausting retry attempts", async () => {
      mockFetch.mockResolvedValue(jsonResponse(500, { error: "server error" }));

      const promise = httpRequest({
        method: "GET",
        url: "https://api.example.com/data",
        retryAttempts: 2,
        onError: { default: "skip" },
      });

      // Advance through all backoffs
      await vi.advanceTimersByTimeAsync(1000);

      const result = await promise;
      expect(result).toBeNull();
      expect(mockFetch).toHaveBeenCalledTimes(3); // 1 + 2 retries
    });
  });

  describe("onError handling", () => {
    it("returns null for 'skip' action", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(404, {}));

      const result = await httpRequest({
        method: "GET",
        url: "https://api.example.com/user",
        onError: { "404": "skip" },
      });

      expect(result).toBeNull();
    });

    it("throws StopProviderError for 'stop_provider' action", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(403, {}));

      await expect(
        httpRequest({
          method: "GET",
          url: "https://api.example.com/user",
          onError: { "403": "stop_provider" },
        }),
      ).rejects.toThrow(StopProviderError);
    });

    it("returns fallback value for 'write' action", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(404, {}));

      const result = await httpRequest({
        method: "GET",
        url: "https://api.example.com/user",
        onError: { "404": { write: "N/A" } },
      });

      expect(result).toEqual({ status: 404, data: "N/A" });
    });

    it("uses 'default' key as catch-all", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(418, {}));

      const result = await httpRequest({
        method: "GET",
        url: "https://api.example.com/user",
        onError: { default: "skip" },
      });

      expect(result).toBeNull();
    });

    it("prefers specific status over default", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(404, {}));

      const result = await httpRequest({
        method: "GET",
        url: "https://api.example.com/user",
        onError: {
          "404": { write: "not found" },
          default: "skip",
        },
      });

      expect(result).toEqual({ status: 404, data: "not found" });
    });

    it("throws generic error when no onError config matches", async () => {
      mockFetch.mockResolvedValueOnce(jsonResponse(404, {}));

      await expect(
        httpRequest({
          method: "GET",
          url: "https://api.example.com/user",
        }),
      ).rejects.toThrow("HTTP request failed with status 404");
    });
  });

  describe("AbortSignal", () => {
    it("throws on abort before request", async () => {
      const controller = new AbortController();
      controller.abort();

      await expect(
        httpRequest({
          method: "GET",
          url: "https://api.example.com/user",
          signal: controller.signal,
        }),
      ).rejects.toThrow("Request aborted");
    });

    it("passes signal to fetch", async () => {
      const controller = new AbortController();
      mockFetch.mockResolvedValueOnce(jsonResponse(200, {}));

      await httpRequest({
        method: "GET",
        url: "https://api.example.com/user",
        signal: controller.signal,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/user",
        expect.objectContaining({ signal: controller.signal }),
      );
    });
  });

  describe("rate limiter integration", () => {
    it("acquires token before each request", async () => {
      const mockAcquire = vi.fn().mockResolvedValue(undefined);
      const mockLimiter = { acquire: mockAcquire } as any;

      mockFetch.mockResolvedValueOnce(jsonResponse(200, {}));

      await httpRequest({
        method: "GET",
        url: "https://api.example.com/user",
        rateLimiter: mockLimiter,
      });

      expect(mockAcquire).toHaveBeenCalledTimes(1);
    });

    it("acquires token on each retry attempt", async () => {
      const mockAcquire = vi.fn().mockResolvedValue(undefined);
      const mockLimiter = { acquire: mockAcquire } as any;

      mockFetch
        .mockResolvedValueOnce(jsonResponse(500, {}))
        .mockResolvedValueOnce(jsonResponse(200, {}));

      const promise = httpRequest({
        method: "GET",
        url: "https://api.example.com/user",
        retryAttempts: 1,
        rateLimiter: mockLimiter,
      });

      await vi.advanceTimersByTimeAsync(150);
      await promise;

      expect(mockAcquire).toHaveBeenCalledTimes(2);
    });
  });

  describe("network errors", () => {
    it("retries on network failure", async () => {
      mockFetch
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(jsonResponse(200, { ok: true }));

      const promise = httpRequest({
        method: "GET",
        url: "https://api.example.com/data",
        retryAttempts: 1,
      });

      await vi.advanceTimersByTimeAsync(150);

      const result = await promise;
      expect(result).toEqual({ status: 200, data: { ok: true } });
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("applies onError after exhausting retries on network failure", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      const promise = httpRequest({
        method: "GET",
        url: "https://api.example.com/data",
        retryAttempts: 1,
        onError: { default: { write: "offline" } },
      });

      await vi.advanceTimersByTimeAsync(500);

      const result = await promise;
      expect(result).toEqual({ status: 0, data: "offline" });
    });
  });
});
