import type { PipelineSettings } from "./types.js";

/** Default pipeline settings used during initialization. */
export const defaultSettings: PipelineSettings = {
  concurrency: 1,
  rateLimit: 10,
  retryAttempts: 3,
  retryBackoff: "exponential",
};
