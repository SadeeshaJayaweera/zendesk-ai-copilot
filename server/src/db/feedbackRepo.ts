import { pool } from "./pool.js";

export interface FeedbackEventInput {
  ticketId: number;
  agentId: number;
  eventType: "helpful" | "not_helpful" | "accepted" | "edited" | "rejected";
  action?: string | null;
}

export async function insertFeedbackEvent(event: FeedbackEventInput): Promise<number> {
  const query = `
    INSERT INTO feedback_events (ticket_id, agent_id, event_type, action, created_at)
    VALUES ($1, $2, $3, $4, NOW())
    RETURNING id;
  `;
  const values = [event.ticketId, event.agentId, event.eventType, event.action || null];
  const res = await pool.query(query, values);
  return res.rows[0].id;
}
