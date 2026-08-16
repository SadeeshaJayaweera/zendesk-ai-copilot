import type { TicketContext } from "../../types/ticketContext.js";
import { rewriteResponseSchema, type RewriteAction, type RewriteResponse } from "../../types/ai.js";
import { createStructuredCompletion } from "./openaiClient.js";
import { detectHallucinations } from "./hallucinationGuard.js";
import { buildRewritePrompts } from "./prompts/rewrite.prompt.js";

export async function rewriteDraft(
  draft: string,
  action: RewriteAction,
  context?: TicketContext
): Promise<RewriteResponse> {
  const trimmed = draft.trim();
  if (!trimmed) {
    throw new Error("agentDraft cannot be empty or whitespace.");
  }

  const { systemPrompt, userPrompt } = buildRewritePrompts(trimmed, action, context);
  const result = await createStructuredCompletion(systemPrompt, userPrompt, rewriteResponseSchema);

  if (context) {
    const guard = detectHallucinations(result.rewrittenText, context);
    if (guard.hasWarning) {
      result.warnings = guard.warnings;
    }
  }

  return result;
}
