import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../rate-limiter.js";

describe("RateLimiter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows first request immediately", async () => {
    const limiter = new RateLimiter(10000); // 10s interval
    await limiter.acquire();
  });

  it("blocks second request until interval has elapsed", async () => {
    const limiter = new RateLimiter(1000); // 1s interval

    await limiter.acquire();

    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });

    // Should not be resolved yet
    expect(resolved).toBe(false);

    // Advance past the interval
    await vi.advanceTimersByTimeAsync(1100);
    await promise;
    expect(resolved).toBe(true);
  });

  it("handles fast rate (100ms interval)", async () => {
    const limiter = new RateLimiter(100); // 0.1s interval

    await limiter.acquire();

    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });

    // 50ms is not enough
    await vi.advanceTimersByTimeAsync(50);
    expect(resolved).toBe(false);

    // 100ms total should be enough
    await vi.advanceTimersByTimeAsync(60);
    await promise;
    expect(resolved).toBe(true);
  });

  it("handles slow rate (10s interval)", async () => {
    const limiter = new RateLimiter(10000); // 10s interval

    await limiter.acquire();

    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });

    // 5s not enough
    await vi.advanceTimersByTimeAsync(5000);
    expect(resolved).toBe(false);

    // 10s total should be enough
    await vi.advanceTimersByTimeAsync(5100);
    await promise;
    expect(resolved).toBe(true);
  });

  it("serializes concurrent acquire() calls", async () => {
    const limiter = new RateLimiter(1000); // 1s interval

    const resolved: number[] = [];

    const promises = Array.from({ length: 3 }, (_, i) =>
      limiter.acquire().then(() => {
        resolved.push(i);
      }),
    );

    // First should resolve immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(resolved.length).toBe(1);

    // Second after 1s
    await vi.advanceTimersByTimeAsync(1100);
    expect(resolved.length).toBe(2);

    // Third after another 1s
    await vi.advanceTimersByTimeAsync(1100);
    expect(resolved.length).toBe(3);

    await Promise.all(promises);
  });

  it("allows immediate acquire if interval already elapsed", async () => {
    const limiter = new RateLimiter(500); // 0.5s interval

    await limiter.acquire();

    // Wait longer than the interval
    await vi.advanceTimersByTimeAsync(2000);

    // Should resolve immediately without waiting
    let resolved = false;
    const promise = limiter.acquire().then(() => {
      resolved = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    await promise;
    expect(resolved).toBe(true);
  });
});
