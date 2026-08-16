import type { TicketContext } from "../../../types/ticketContext.js";
import type { ConversationAnalysis } from "../../../types/ai.js";
import { getLatestCustomerMessage, getRecentMessages } from "../../zendesk/conversationHelpers.js";

export interface StyleProfileOptions {
  companyName?: string;
  formality?: "casual" | "neutral" | "formal";
  useEmojis?: boolean;
  preferredGreeting?: string;
  preferredClosing?: string;
}

export function buildGenerateReplyPrompts(
  context: TicketContext,
  analysis: ConversationAnalysis,
  tone: string,
  agentDraft?: string,
  styleProfile?: StyleProfileOptions
): {
  systemPrompt: string;
  userPrompt: string;
} {
  const company = styleProfile?.companyName || "Our Support Team";
  const formality = styleProfile?.formality || "neutral";
  const emojis = styleProfile?.useEmojis ? "Allowed and encouraged where appropriate." : "Do NOT use emojis.";
  const greeting = styleProfile?.preferredGreeting || "Hello";
  const closing = styleProfile?.preferredClosing || "Best regards,\nSupport Team";

  const systemPrompt = `You are an expert AI Support Copilot drafting replies for support agents on behalf of ${company}.
STRICT ANTI-HALLUCINATION RULES:
1. ONLY reference facts and information directly present in the ticket conversation.
2. NEVER invent refunds, financial credits, discounts, free subscriptions, or fee waivers.
3. NEVER promise unverified features, technical fixes, or specific future delivery timelines.
4. NEVER claim an action was taken unless explicitly stated in the conversation history.
5. If required information is missing to resolve the ticket, ask the customer clarifying questions and list missing items in missing_information.

STYLE GUIDELINES:
- Formality: ${formality}
- Emojis: ${emojis}
- Preferred greeting style: ${greeting}
- Preferred closing style: ${closing}
- Target tone: ${tone}

Output JSON matching:
{
  "reply": string,
  "missing_information": string[],
  "tone_used": string
}`;

  const recentMsgs = getRecentMessages(context, 6);
  const latestCustomer = getLatestCustomerMessage(context);

  const conversationText = recentMsgs
    .map((m) => `[${m.authorRole.toUpperCase()}]: ${m.body}`)
    .join("\n");

  const userPrompt = `=== TICKET DETAILS ===
Subject: ${context.subject}
Description: ${context.description}
Status: ${context.status}
Priority: ${context.priority || "normal"}

=== CONVERSATION HISTORY ===
${conversationText || "(No conversation history)"}

=== LATEST INQUIRY ===
${latestCustomer ? latestCustomer.body : "(No customer inquiry)"}

=== ANALYSIS DATA ===
Sentiment: ${analysis.customer_sentiment}
Intent: ${analysis.customer_intent}
Urgency: ${analysis.urgency}
Needs Apology: ${analysis.needs_apology}
Needs Clarification: ${analysis.needs_clarification}

=== EXISTING AGENT DRAFT (Optional starting point) ===
${agentDraft || "None provided."}

Generate the optimal customer reply following all hallucination prevention rules and tone guidelines.`;

  return { systemPrompt, userPrompt };
}
