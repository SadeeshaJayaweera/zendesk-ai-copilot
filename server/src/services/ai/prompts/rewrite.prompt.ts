import type { RewriteAction } from "../../../types/ai.js";
import type { TicketContext } from "../../../types/ticketContext.js";

export const REWRITE_INSTRUCTIONS: Record<RewriteAction, string> = {
  improveTone: "Improve overall tone to be natural, polite, respectful, and helpful without changing factual meaning.",
  makeMoreProfessional: "Make the language polished, formal, and strictly professional for enterprise correspondence.",
  makeMoreFriendly: "Make the message warm, inviting, approachable, and friendly while retaining clarity.",
  makeMoreEmpathetic: "Acknowledge customer frustration with genuine empathy, validation, and supportive phrasing.",
  makeMoreConcise: "Trim all filler, redundancy, and fluff to make the draft direct, brief, and to the point.",
  makeMoreClear: "Simplify complex wording and clarify instructions with clear, unambiguous sentences.",
  makeLessRobotic: "Remove stiff or repetitive corporate jargon to make the text sound human and authentic.",
  makeMoreConfident: "Remove hesitant qualifiers (e.g. 'I think', 'maybe', 'perhaps') and project confident authority.",
  deEscalate: "De-escalate tension, diffuse conflict, validate customer concerns, and focus constructively on solution steps.",
  rewriteCompletely: "Completely restructure and rewrite the reply for maximum effectiveness and customer satisfaction."
};

export function buildRewritePrompts(
  draft: string,
  action: RewriteAction,
  context?: TicketContext
): {
  systemPrompt: string;
  userPrompt: string;
} {
  const actionInstruction = REWRITE_INSTRUCTIONS[action] || REWRITE_INSTRUCTIONS.improveTone;

  const systemPrompt = `You are an expert AI customer service editor.
Apply the following rewrite action to the agent's draft reply:
ACTION: ${action}
INSTRUCTION: ${actionInstruction}

STRICT CONSTRAINTS:
1. Preserve all factual instructions, technical details, links, and accurate steps.
2. NEVER introduce fabricated refunds, credits, discounts, or unauthorized policy promises.
3. Return ONLY valid JSON matching:
{
  "rewrittenText": string,
  "actionApplied": "${action}"
}`;

  const userPrompt = `=== SOURCE DRAFT ===
${draft}

${context ? `=== TICKET CONTEXT ===\nSubject: ${context.subject}\nStatus: ${context.status}` : ""}

Rewrite the draft following the specific action instruction.`;

  return { systemPrompt, userPrompt };
}
