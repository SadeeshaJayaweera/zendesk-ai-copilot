import type { TicketContext } from "../../types/ticketContext.js";
import { generateReplySchema, type ConversationAnalysis, type GenerateReplyResult } from "../../types/ai.js";
import { createStructuredCompletion } from "./openaiClient.js";
import { recommendTone } from "./recommendTone.js";
import { detectHallucinations } from "./hallucinationGuard.js";
import { buildGenerateReplyPrompts, type StyleProfileOptions } from "./prompts/generateReply.prompt.js";

export async function generateReply(
  context: TicketContext,
  analysis: ConversationAnalysis,
  toneOverride?: string,
  agentDraft?: string,
  styleProfile?: StyleProfileOptions
): Promise<GenerateReplyResult> {
  const tone = toneOverride || recommendTone(analysis);
  const { systemPrompt, userPrompt } = buildGenerateReplyPrompts(
    context,
    analysis,
    tone,
    agentDraft,
    styleProfile
  );

  const result = await createStructuredCompletion(systemPrompt, userPrompt, generateReplySchema);

  const guard = detectHallucinations(result.reply, context);

  return {
    reply: result.reply,
    tone_used: result.tone_used,
    missing_information: result.missing_information || [],
    warnings: guard.hasWarning ? guard.warnings : undefined
  };
}
