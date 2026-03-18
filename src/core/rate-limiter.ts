/**
 * Interval-based rate limiter.
 *
 * Enforces a minimum interval (in milliseconds) between requests.
 * Serialized via a promise chain to prevent race conditions.
 */
export class RateLimiter {
  private lastRequest = 0;
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly intervalMs: number) {}

  /**
   * Wait until the minimum interval has elapsed since the last request.
   * The first request always goes through immediately.
   * Respects AbortSignal for early exit.
   */
  async acquire(signal?: AbortSignal): Promise<void> {
    this.queue = this.queue.then(() => this._acquire(signal));
    return this.queue;
  }

  private async _acquire(signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return;

    const now = Date.now();
    const elapsed = now - this.lastRequest;
    const waitMs = Math.max(0, this.intervalMs - elapsed);

    if (waitMs > 0) {
      await this.sleep(waitMs, signal);
    }

    this.lastRequest = Date.now();
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
