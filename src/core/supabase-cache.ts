/**
 * Supabase-backed enrichment cache.
 *
 * Prevents re-enriching the same entity twice. Reuses the existing
 * enrichment_cache table from Clay Webhook OS's Supabase schema.
 *
 * Degrades gracefully: if SUPABASE_URL/SUPABASE_ANON_KEY are not set,
 * all methods return null and callers fall through to live execution.
 *
 * Ported from: app/core/enrichment_cache.py
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Default TTL: 7 days
const DEFAULT_TTL_SECONDS = 604800;

let client: SupabaseClient | null = null;
let initialized = false;

function getClient(): SupabaseClient | null {
  if (initialized) return client;
  initialized = true;

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  client = createClient(url, key);
  return client;
}

/**
 * Check the cache for a previously enriched result.
 *
 * @returns The cached result object, or null on miss/expiry/error.
 */
export async function checkCache(
  skillId: string,
  entityType: string,
  entityId: string,
): Promise<Record<string, unknown> | null> {
  const sb = getClient();
  if (!sb) return null;

  try {
    const { data, error } = await sb
      .from("enrichment_cache")
      .select("result, expires_at, hit_count, id")
      .eq("entity_type", entityType)
      .eq("entity_id", entityId)
      .eq("provider", "claude")
      .eq("operation", skillId)
      .maybeSingle();

    if (error || !data) return null;

    // Check expiry
    const expiresAt = new Date(data.expires_at);
    if (expiresAt < new Date()) return null;

    // Increment hit count (fire-and-forget)
    sb.from("enrichment_cache")
      .update({ hit_count: (data.hit_count ?? 0) + 1 })
      .eq("id", data.id)
      .then(() => {});

    return data.result as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Store an enrichment result in the cache (upsert).
 */
export async function writeCache(
  skillId: string,
  entityType: string,
  entityId: string,
  result: Record<string, unknown>,
  model?: string,
  ttlSeconds = DEFAULT_TTL_SECONDS,
): Promise<void> {
  const sb = getClient();
  if (!sb) return;

  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  const resultHash = simpleHash(JSON.stringify(result));

  try {
    await sb.from("enrichment_cache").upsert(
      {
        entity_type: entityType,
        entity_id: entityId,
        provider: "claude",
        operation: skillId,
        result,
        result_hash: resultHash,
        ttl_seconds: ttlSeconds,
        hit_count: 0,
        expires_at: expiresAt,
      },
      { onConflict: "entity_type,entity_id,provider,operation" },
    );
  } catch {
    // Non-critical — skip silently
  }
}

/** Simple hash for result dedup. */
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(16).slice(0, 16);
}
