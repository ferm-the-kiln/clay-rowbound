/**
 * Interval-based rate limiter.
 *
 * Enforces a minimum interval (in milliseconds) between requests.
 * Serialized via a promise chain to prevent race conditions.
 */
export class RateLimiter {
    intervalMs;
    lastRequest = 0;
    queue = Promise.resolve();
    constructor(intervalMs) {
        this.intervalMs = intervalMs;
    }
    /**
     * Wait until the minimum interval has elapsed since the last request.
     * The first request always goes through immediately.
     * Respects AbortSignal for early exit.
     */
    async acquire(signal) {
        this.queue = this.queue.then(() => this._acquire(signal));
        return this.queue;
    }
    async _acquire(signal) {
        if (signal?.aborted)
            return;
        const now = Date.now();
        const elapsed = now - this.lastRequest;
        const waitMs = Math.max(0, this.intervalMs - elapsed);
        if (waitMs > 0) {
            await this.sleep(waitMs, signal);
        }
        this.lastRequest = Date.now();
    }
    sleep(ms, signal) {
        return new Promise((resolve) => {
            if (signal?.aborted) {
                resolve();
                return;
            }
            const timer = setTimeout(resolve, ms);
            signal?.addEventListener("abort", () => {
                clearTimeout(timer);
                resolve();
            }, { once: true });
        });
    }
}
