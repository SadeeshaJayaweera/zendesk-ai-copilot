import type { TicketContext } from "../../../types/ticketContext.js";
import { getLatestCustomerMessage, getRecentMessages } from "../../zendesk/conversationHelpers.js";

export function buildAnalyzeConversationPrompts(context: TicketContext): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are an expert Zendesk customer support conversation analyst.
Analyze the support ticket conversation and return a structured JSON object containing:
- customer_sentiment: "positive" | "neutral" | "negative" | "frustrated" | "angry"
- customer_intent: "question" | "bug_report" | "feature_request" | "billing" | "cancellation" | "praise" | "general"
- urgency: "low" | "medium" | "high" | "urgent"
- conversation_tone: concise descriptive string of the customer's current emotional state
- recommended_tone: recommended tone for the agent reply (e.g. empathetic, professional, direct, reassuring)
- response_length: "short" | "medium" | "long"
- needs_apology: boolean
- needs_clarification: boolean
- confidence: float between 0 and 1

Return ONLY valid JSON matching this specification.`;

  const recentMsgs = getRecentMessages(context, 8);
  const latestCustomer = getLatestCustomerMessage(context);

  const conversationText = recentMsgs
    .map((m) => `[${m.authorRole.toUpperCase()} at ${m.createdAt}]: ${m.body}`)
    .join("\n");

  const userPrompt = `=== TICKET CONTEXT ===
Ticket ID: ${context.ticketId}
Subject: ${context.subject}
Description: ${context.description}
Status: ${context.status}
Priority: ${context.priority || "normal"}
Tags: ${context.tags.join(", ") || "none"}

=== CONVERSATION HISTORY (Most recent messages) ===
${conversationText || "(No messages yet)"}

=== LATEST CUSTOMER MESSAGE ===
${latestCustomer ? latestCustomer.body : "(No customer message)"}

Perform conversation analysis and output JSON.`;

  return { systemPrompt, userPrompt };
}
