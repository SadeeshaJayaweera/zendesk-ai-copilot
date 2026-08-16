import type { TicketContext } from "../../../types/ticketContext.js";
import { getLatestCustomerMessage, getRecentMessages } from "../../zendesk/conversationHelpers.js";

export function buildAnalyzeDraftPrompts(context: TicketContext, draft: string): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are an expert customer service quality assurance coach.
Evaluate the support agent's draft reply against the customer's inquiry and ticket history.
Check for:
1. Professionalism, friendliness, empathy, clarity, grammar, and conciseness (scores 0-100).
2. Does it directly answer the customer's actual question?
3. Is there defensive, dismissive, or robotic wording?
4. Are there unsupported promises (e.g. unauthorized refunds, free credits, fabricated timelines)?
5. Are there contradictions with ticket context?

Return ONLY valid JSON matching this schema:
{
  "score": number,
  "scores": {
    "professionalism": number,
    "friendliness": number,
    "empathy": number,
    "clarity": number
  },
  "strengths": string[],
  "issues": [
    {
      "type": "unanswered_question" | "defensive_tone" | "unsupported_promise" | "grammar_error" | "unclear_phrasing" | "too_robotic" | "too_verbose" | "contradiction",
      "message": string,
      "severity": "info" | "warning" | "critical"
    }
  ],
  "recommended_changes": string[]
}`;

  const recentMsgs = getRecentMessages(context, 5);
  const latestCustomer = getLatestCustomerMessage(context);

  const conversationText = recentMsgs
    .map((m) => `[${m.authorRole.toUpperCase()}]: ${m.body}`)
    .join("\n");

  const userPrompt = `=== TICKET CONTEXT ===
Subject: ${context.subject}
Description: ${context.description}

=== RECENT CONVERSATION ===
${conversationText || "No previous history."}

=== LATEST CUSTOMER INQUIRY ===
${latestCustomer ? latestCustomer.body : "(No customer message)"}

=== AGENT DRAFT TO EVALUATE ===
${draft}

Analyze this draft and provide the structured QA report in JSON.`;

  return { systemPrompt, userPrompt };
}
