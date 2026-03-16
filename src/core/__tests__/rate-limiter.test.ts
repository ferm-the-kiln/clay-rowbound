import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../rate-limiter.js";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows immediate acquire when tokens are available", async () => {
    const limiter = new RateLimiter(10);
    // Should resolve immediately — 10 tokens available
    await limiter.acquire();
  });

  it("allows acquiring up to tokensPerSecond tokens immediately", async () => {
    const limiter = new RateLimiter(3);
    await limiter.acquire();
    await limiter.acquire();
    await limiter.acquire();
    // All 3 should succeed without waiting
  });

  it("blocks when tokens are exhausted", async () => {
    const limiter = new RateLimiter(2);

    // Exhaust tokens
    await limiter.acquire();
    await limiter.acquire();

    // Next acquire should block
    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });

    // Should not be resolved yet
    expect(resolved).toBe(false);

    // Advance time to allow refill
    await vi.advanceTimersByTimeAsync(600);

    await promise;
    expect(resolved).toBe(true);
  });

  it("refills tokens based on elapsed time", async () => {
    const limiter = new RateLimiter(10);

    // Exhaust all tokens
    for (let i = 0; i < 10; i++) {
      await limiter.acquire();
    }

    // Advance 500ms — should refill 5 tokens
    await vi.advanceTimersByTimeAsync(500);

    // Should be able to acquire 5 more without blocking
    for (let i = 0; i < 5; i++) {
      await limiter.acquire();
    }
  });

  it("does not exceed max capacity", async () => {
    const limiter = new RateLimiter(2);

    // Wait a long time — tokens should cap at 2
    await vi.advanceTimersByTimeAsync(5000);

    await limiter.acquire();
    await limiter.acquire();

    // Third should block
    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });

    expect(resolved).toBe(false);

    await vi.advanceTimersByTimeAsync(600);
    await promise;
    expect(resolved).toBe(true);
  });

  it("handles fractional token refill", async () => {
    const limiter = new RateLimiter(1);

    // Use the one token
    await limiter.acquire();

    // Next acquire should block — need ~1000ms for a full token
    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });

    // Advance 500ms — only half a token, still not enough
    await vi.advanceTimersByTimeAsync(500);
    // The sleep inside acquire resolves, but refill gives <1 token,
    // so we need to ensure the timer fully covers the deficit.

    // Advance the remaining time
    await vi.advanceTimersByTimeAsync(600);
    await promise;
    expect(resolved).toBe(true);
  });

  it("serializes concurrent acquire() calls without negative tokens", async () => {
    // With 3 tokens available and 5 concurrent callers, the first 3 should
    // resolve immediately and the remaining 2 should wait for refills.
    // Without serialization, all 5 could read tokens >= 1 simultaneously.
    const limiter = new RateLimiter(3);

    const resolved: number[] = [];

    // Fire 5 acquire() calls concurrently (without awaiting)
    const promises = Array.from({ length: 5 }, (_, i) =>
      limiter.acquire().then(() => {
        resolved.push(i);
      }),
    );

    // Let microtasks flush — first 3 should resolve via the serialized chain
    await vi.advanceTimersByTimeAsync(0);
    expect(resolved.length).toBe(3);

    // Advance enough time for the remaining 2 to refill (each needs ~333ms)
    await vi.advanceTimersByTimeAsync(400);
    expect(resolved.length).toBe(4);

    await vi.advanceTimersByTimeAsync(400);
    expect(resolved.length).toBe(5);

    // All promises should resolve without error
    await Promise.all(promises);
    expect(resolved).toHaveLength(5);
  });
});
