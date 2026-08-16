import { pool } from "./pool.js";
import type { ConversationAnalysis } from "../types/ai.js";

export async function getCachedAnalysis(
  ticketId: number,
  hash: string
): Promise<ConversationAnalysis | null> {
  const query = `
    SELECT analysis_json
    FROM analysis_cache
    WHERE ticket_id = $1 AND conversation_hash = $2 AND expires_at > NOW();
  `;
  try {
    const res = await pool.query(query, [ticketId, hash]);
    if (res.rows.length === 0) return null;
    return res.rows[0].analysis_json as ConversationAnalysis;
  } catch {
    return null;
  }
}

export async function setCachedAnalysis(
  ticketId: number,
  hash: string,
  analysis: ConversationAnalysis,
  ttlMinutes = 15
): Promise<void> {
  const query = `
    INSERT INTO analysis_cache (ticket_id, conversation_hash, analysis_json, created_at, expires_at)
    VALUES ($1, $2, $3, NOW(), NOW() + ($4 || ' minutes')::INTERVAL)
    ON CONFLICT (ticket_id, conversation_hash) DO UPDATE SET
      analysis_json = EXCLUDED.analysis_json,
      expires_at = EXCLUDED.expires_at;
  `;
  try {
    await pool.query(query, [ticketId, hash, JSON.stringify(analysis), ttlMinutes]);
  } catch {
    // Non-blocking cache write failure
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
