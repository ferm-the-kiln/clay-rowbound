/**
 * Interval-based rate limiter.
 *
 * Enforces a minimum interval (in milliseconds) between requests.
 * Serialized via a promise chain to prevent race conditions.
 */
export declare class RateLimiter {
    private readonly intervalMs;
    private lastRequest;
    private queue;
    constructor(intervalMs: number);
    /**
     * Wait until the minimum interval has elapsed since the last request.
     * The first request always goes through immediately.
     * Respects AbortSignal for early exit.
     */
    acquire(signal?: AbortSignal): Promise<void>;
    private _acquire;
    private sleep;
}
