/**
 * Token bucket rate limiter.
 *
 * Refills tokens based on elapsed time, with max capacity equal to
 * tokensPerSecond. Used globally across all HTTP requests.
 */
export class RateLimiter {
  private tokens: number;
  private readonly maxTokens: number;
  private lastRefill: number;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly tokensPerSecond: number) {
    this.maxTokens = tokensPerSecond;
    this.tokens = tokensPerSecond;
    this.lastRefill = Date.now();
  }

  /**
   * Acquire a single token. Resolves immediately if a token is available,
   * otherwise waits until one is refilled. Respects AbortSignal for early exit.
   *
   * Serialized via a promise chain to prevent race conditions when
   * multiple callers invoke acquire() concurrently.
   */
  async acquire(signal?: AbortSignal): Promise<void> {
    this.queue = this.queue.then(() => this._acquire(signal));
    return this.queue;
  }

  private async _acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return;

    this.refill();

    if (this.tokens >= 1) {
      this.tokens -= 1;
      return;
    }

    // Calculate wait time until at least one token is available
    const deficit = 1 - this.tokens;
    const waitMs = (deficit / this.tokensPerSecond) * 1000;

    await this.sleep(waitMs, signal);

    this.refill();
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(
      this.maxTokens,
      this.tokens + elapsed * this.tokensPerSecond,
    );
    this.lastRefill = now;
  }

  private sleep(ms: number, signal?: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
      if (signal?.aborted) {
        resolve();
        return;
      }
      const timer = setTimeout(resolve, ms);
      signal?.addEventListener(
        "abort",
        () => {
          clearTimeout(timer);
          resolve();
        },
        { once: true },
      );
    });
  }
}
