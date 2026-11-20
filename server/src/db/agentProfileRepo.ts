import { pool } from "./pool.js";

export interface AgentPreferences {
  organizationId: string;
  agentId: number;
  formality: number; // 0.0 - 1.0
  warmth: number; // 0.0 - 1.0
  conciseness: number; // 0.0 - 1.0
  empathy: number; // 0.0 - 1.0
  preferredGreeting?: string | null;
  preferredClosing?: string | null;
  toneBias?: string;
  updatedAt?: string;
}

export interface AgentTelemetrySummary {
  agentId: number;
  organizationId: string;
  totalEvents: number;
  acceptedCount: number;
  editedCount: number;
  rejectedCount: number;
  acceptanceRate: number; // 0.0 - 1.0
  editRate: number; // 0.0 - 1.0
  rejectionRate: number; // 0.0 - 1.0
  topActions: Array<{ action: string; count: number }>;
  recommendedStyleAdjustment: string;
}

const inMemoryPrefs = new Map<string, AgentPreferences>();

export async function getAgentPreferences(
  organizationId: string,
  agentId: number
): Promise<AgentPreferences> {
  const key = `${organizationId}:${agentId}`;
  try {
    const query = `
      SELECT organization_id, agent_id, formality, warmth, conciseness, empathy,
             preferred_greeting, preferred_closing, tone_bias, updated_at
      FROM agent_preferences
      WHERE organization_id = $1 AND agent_id = $2;
    `;
    const res = await pool.query(query, [organizationId, agentId]);
    if (res.rows.length > 0) {
      const row = res.rows[0];
      const result: AgentPreferences = {
        organizationId: row.organization_id,
        agentId: Number(row.agent_id),
        formality: Number(row.formality),
        warmth: Number(row.warmth),
        conciseness: Number(row.conciseness),
        empathy: Number(row.empathy),
        preferredGreeting: row.preferred_greeting || null,
        preferredClosing: row.preferred_closing || null,
        toneBias: row.tone_bias || "balanced",
        updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
      };
      inMemoryPrefs.set(key, result);
      return result;
    }
  } catch {
    // In-memory fallback if database query fails or in test environment
  }

  if (inMemoryPrefs.has(key)) {
    return inMemoryPrefs.get(key)!;
  }

  // Default balanced baseline preferences
  const defaultPrefs: AgentPreferences = {
    organizationId,
    agentId,
    formality: 0.5,
    warmth: 0.5,
    conciseness: 0.5,
    empathy: 0.5,
    preferredGreeting: null,
    preferredClosing: null,
    toneBias: "balanced"
  };
  return defaultPrefs;
}

export async function upsertAgentPreferences(prefs: AgentPreferences): Promise<void> {
  const key = `${prefs.organizationId}:${prefs.agentId}`;
  inMemoryPrefs.set(key, { ...prefs, updatedAt: new Date().toISOString() });

  try {
    const query = `
      INSERT INTO agent_preferences (
        organization_id, agent_id, formality, warmth, conciseness, empathy,
        preferred_greeting, preferred_closing, tone_bias, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (organization_id, agent_id) DO UPDATE SET
        formality = EXCLUDED.formality,
        warmth = EXCLUDED.warmth,
        conciseness = EXCLUDED.conciseness,
        empathy = EXCLUDED.empathy,
        preferred_greeting = EXCLUDED.preferred_greeting,
        preferred_closing = EXCLUDED.preferred_closing,
        tone_bias = EXCLUDED.tone_bias,
        updated_at = NOW();
    `;
    await pool.query(query, [
      prefs.organizationId,
      prefs.agentId,
      prefs.formality,
      prefs.warmth,
      prefs.conciseness,
      prefs.empathy,
      prefs.preferredGreeting || null,
      prefs.preferredClosing || null,
      prefs.toneBias || "balanced"
    ]);
  } catch {
    // In-memory fallback succeeded
  }
}

export async function getAgentTelemetry(
  organizationId: string,
  agentId: number
): Promise<AgentTelemetrySummary> {
  let totalEvents = 0;
  let acceptedCount = 0;
  let editedCount = 0;
  let rejectedCount = 0;
  const actionCounts = new Map<string, number>();

  try {
    const query = `
      SELECT event_type, action, COUNT(*)::int as count
      FROM feedback_events
      WHERE organization_id = $1 AND agent_id = $2
      GROUP BY event_type, action;
    `;
    const res = await pool.query(query, [organizationId, agentId]);
    for (const row of res.rows) {
      const c = Number(row.count);
      totalEvents += c;
      if (row.event_type === "accepted") acceptedCount += c;
      else if (row.event_type === "edited") editedCount += c;
      else if (row.event_type === "rejected") rejectedCount += c;

      if (row.action) {
        actionCounts.set(row.action, (actionCounts.get(row.action) || 0) + c);
      }
    }
  } catch {
    // Database unavailable in offline/test mode
  }

  const acceptanceRate = totalEvents > 0 ? Number((acceptedCount / totalEvents).toFixed(2)) : 0;
  const editRate = totalEvents > 0 ? Number((editedCount / totalEvents).toFixed(2)) : 0;
  const rejectionRate = totalEvents > 0 ? Number((rejectedCount / totalEvents).toFixed(2)) : 0;

  const topActions = Array.from(actionCounts.entries())
    .map(([action, count]) => ({ action, count }))
    .sort((a, b) => b.count - a.count);

  // Compute adaptive style recommendation without touching customer text (Strict Privacy Rule #9 & #13)
  let recommendedStyleAdjustment = "Profile balanced. Suggestion quality is optimal.";
  if (editRate > 0.4) {
    const topAction = topActions[0]?.action?.toLowerCase();
    if (topAction?.includes("concise") || topAction?.includes("short")) {
      recommendedStyleAdjustment = "Agent frequently shortens drafts. Recommend increasing conciseness to 0.75+.";
    } else if (topAction?.includes("formal")) {
      recommendedStyleAdjustment = "Agent frequently applies formal rewrites. Recommend increasing formality to 0.75+.";
    } else if (topAction?.includes("empathy") || topAction?.includes("friendly")) {
      recommendedStyleAdjustment = "Agent frequently adds empathetic tone. Recommend increasing empathy setting.";
    } else {
      recommendedStyleAdjustment = "High edit rate observed. Recommend reviewing agent-specific greeting and closing.";
    }
  } else if (rejectionRate > 0.3) {
    recommendedStyleAdjustment = "Elevated rejection rate. Check grounding knowledge sources and tone preferences.";
  }

  return {
    agentId,
    organizationId,
    totalEvents,
    acceptedCount,
    editedCount,
    rejectedCount,
    acceptanceRate,
    editRate,
    rejectionRate,
    topActions,
    recommendedStyleAdjustment
  };
}
