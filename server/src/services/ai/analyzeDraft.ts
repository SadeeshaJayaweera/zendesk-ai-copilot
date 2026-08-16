import type { TicketContext } from "../../types/ticketContext.js";
import { draftAnalysisSchema, type DraftAnalysis } from "../../types/ai.js";
import { createStructuredCompletion } from "./openaiClient.js";
import { buildAnalyzeDraftPrompts } from "./prompts/analyzeDraft.prompt.js";

export async function analyzeDraft(context: TicketContext, draft: string): Promise<DraftAnalysis> {
  const trimmed = draft.trim();
  if (!trimmed) {
    throw new Error("agentDraft cannot be empty or whitespace.");
  }
  const { systemPrompt, userPrompt } = buildAnalyzeDraftPrompts(context, trimmed);
  return createStructuredCompletion(systemPrompt, userPrompt, draftAnalysisSchema);
}
