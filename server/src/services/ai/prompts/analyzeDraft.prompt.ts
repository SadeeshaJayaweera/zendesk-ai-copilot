import type { TicketContext } from "../../../types/ticketContext.js";
import { getLatestCustomerMessage, getRecentMessages } from "../../zendesk/conversationHelpers.js";

export function buildAnalyzeDraftPrompts(context: TicketContext, draft: string): {
  systemPrompt: string;
  userPrompt: string;
} {
  const systemPrompt = `You are a Principal Customer Service Quality and Policy Assurance Auditor.
Evaluate the support agent's draft reply against the customer's actual inquiry, technical ticket context, and company policies.

CRITICAL EVALUATION STANDARDS:
1. EXPLAINABILITY & RIGOR: Do NOT award a high score simply because a reply sounds polite or professional. A beautifully phrased but factually or technically incorrect draft MUST receive a score below 60.
2. QUESTION COVERAGE: Does the draft directly answer every specific question asked by the customer? If not, flag an 'unanswered_question' issue.
3. POLICY & COMMITMENT INTEGRITY: Check for unauthorized commitments (e.g. unverified refunds, credits, discounts, fee waivers, unverified delivery promises). Flag 'unsupported_promise' or 'policy_violation' with critical severity.
4. TONE & DEFENSIVENESS: Check for defensive, dismissive, or robotic language.

OUTPUT JSON SPECIFICATION:
Return ONLY valid JSON matching:
{
  "score": number (0 to 100),
  "scores": {
    "professionalism": number (0 to 100),
    "friendliness": number (0 to 100),
    "empathy": number (0 to 100),
    "clarity": number (0 to 100),
    "technical_accuracy": number (0 to 100),
    "policy_compliance": number (0 to 100)
  },
  "strengths": string[],
  "issues": [
    {
      "type": "unanswered_question" | "defensive_tone" | "unsupported_promise" | "grammar_error" | "unclear_phrasing" | "too_robotic" | "too_verbose" | "contradiction" | "security_risk" | "policy_violation",
      "message": string,
      "severity": "info" | "warning" | "critical"
    }
  ],
  "recommended_changes": string[]
}`;

  const recentMsgs = getRecentMessages(context, 6);
  const latestCustomer = getLatestCustomerMessage(context);

  const conversationText = recentMsgs
    .map((m) => `[${m.authorRole.toUpperCase()}]: ${m.body}`)
    .join("\n");

  const userPrompt = `<untrusted_ticket_context>
Subject: ${context.subject}
Description: ${context.description}
Status: ${context.status}
Priority: ${context.priority || "normal"}
</untrusted_ticket_context>

<untrusted_recent_conversation>
${conversationText || "(No previous history)"}
</untrusted_recent_conversation>

<untrusted_latest_customer_inquiry>
${latestCustomer ? latestCustomer.body : "(No customer message)"}
</untrusted_latest_customer_inquiry>

<untrusted_agent_draft_to_evaluate>
${draft}
</untrusted_agent_draft_to_evaluate>

Perform rigorous QA audit and output JSON.`;

  return { systemPrompt, userPrompt };
}
