import { pool } from "./pool.js";
import type { ConversationAnalysis } from "../types/ai.js";

const inMemoryCache = new Map<string, { analysis: ConversationAnalysis; expiresAt: number }>();

/**
 * Tenant-aware cache lookup.
 * Supports both legacy (ticketId, hash) and multi-tenant (orgId, ticketId, hash).
 */
export async function getCachedAnalysis(
  arg1: string | number,
  arg2: string | number,
  arg3?: string
): Promise<ConversationAnalysis | null> {
  let orgId = "default";
  let ticketId: number;
  let hash: string;

  if (typeof arg1 === "string" && typeof arg2 === "number" && typeof arg3 === "string") {
    orgId = arg1;
    ticketId = arg2;
    hash = arg3;
  } else {
    ticketId = Number(arg1);
    hash = String(arg2);
  }

  const query = `
    SELECT analysis_json
    FROM analysis_cache
    WHERE organization_id = $1 AND ticket_id = $2 AND conversation_hash = $3 AND expires_at > NOW();
  `;
  try {
    const res = await pool.query(query, [orgId, ticketId, hash]);
    if (res.rows.length === 0) return null;
    return res.rows[0].analysis_json as ConversationAnalysis;
  } catch {
    const key = `${orgId}:${ticketId}:${hash}`;
    const cached = inMemoryCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.analysis;
    }
    return null;
  }
}

/**
 * Tenant-aware cache write.
 * Supports both legacy (ticketId, hash, analysis, ttl) and multi-tenant (orgId, ticketId, hash, analysis, ttl).
 */
export async function setCachedAnalysis(
  arg1: string | number,
  arg2: string | number,
  arg3: ConversationAnalysis | string,
  arg4?: ConversationAnalysis | number,
  arg5 = 15
): Promise<void> {
  let orgId = "default";
  let ticketId: number;
  let hash: string;
  let analysis: ConversationAnalysis;
  let ttlMinutes = 15;

  if (typeof arg1 === "string" && typeof arg2 === "number" && typeof arg3 === "string" && typeof arg4 === "object") {
    orgId = arg1;
    ticketId = arg2;
    hash = arg3;
    analysis = arg4 as ConversationAnalysis;
    ttlMinutes = typeof arg5 === "number" ? arg5 : 15;
  } else {
    ticketId = Number(arg1);
    hash = String(arg2);
    analysis = arg3 as ConversationAnalysis;
    ttlMinutes = typeof arg4 === "number" ? arg4 : 15;
  }

  const key = `${orgId}:${ticketId}:${hash}`;
  inMemoryCache.set(key, {
    analysis,
    expiresAt: Date.now() + ttlMinutes * 60 * 1000
  });

  const query = `
    INSERT INTO analysis_cache (organization_id, ticket_id, conversation_hash, analysis_json, created_at, expires_at)
    VALUES ($1, $2, $3, $4, NOW(), NOW() + ($5 || ' minutes')::INTERVAL)
    ON CONFLICT (ticket_id, conversation_hash) DO UPDATE SET
      organization_id = EXCLUDED.organization_id,
      analysis_json = EXCLUDED.analysis_json,
      expires_at = EXCLUDED.expires_at;
  `;
  try {
    await pool.query(query, [orgId, ticketId, hash, JSON.stringify(analysis), ttlMinutes]);
  } catch {
    // Non-blocking cache write failure - in-memory fallback preserved
  }
}

export async function cleanupExpiredCache(): Promise<number> {
  try {
    const res = await pool.query("DELETE FROM analysis_cache WHERE expires_at <= NOW();");
    return res.rowCount || 0;
  } catch {
    return 0;
  }
}
