import type { TicketContext } from "../../types/ticketContext.js";
import { draftAnalysisSchema, type DraftAnalysis } from "../../types/ai.js";
import { createStructuredCompletion } from "./openaiClient.js";
import { buildAnalyzeDraftPrompts } from "./prompts/analyzeDraft.prompt.js";
import { detectHallucinations } from "./hallucinationGuard.js";

/**
 * Analyzes agent draft replies with multi-dimensional scoring and deterministic policy enforcement.
 * Enforces Non-Negotiable Principle #12: Even if phrased professionally, an unauthorized commitment
 * or hallucinated resolution caps the quality score.
 */
export async function analyzeDraft(context: TicketContext, draft: string): Promise<DraftAnalysis> {
  const trimmed = draft.trim();
  if (!trimmed) {
    throw new Error("agentDraft cannot be empty or whitespace.");
  }

  const { systemPrompt, userPrompt } = buildAnalyzeDraftPrompts(context, trimmed);
  const result = await createStructuredCompletion(systemPrompt, userPrompt, draftAnalysisSchema);

  // Deterministic Safety & Policy Cross-Check
  const guard = detectHallucinations(trimmed, context);
  if (guard.blocked || guard.hasWarning) {
    for (const violation of guard.warnings) {
      const alreadyReported = result.issues.some((i) => i.message.includes(violation));
      if (!alreadyReported) {
        result.issues.unshift({
          type: violation.includes("Private data") ? "security_risk" : "unsupported_promise",
          message: violation,
          severity: "critical"
        });
      }
    }

    if (guard.blocked) {
      // Hard cap on score for critical policy violations
      result.scores.policy_compliance = Math.min(result.scores.policy_compliance, 30);
      result.scores.technical_accuracy = Math.min(result.scores.technical_accuracy, 50);
      result.score = Math.min(result.score, 45);
      result.recommended_changes.unshift(
        "CRITICAL: Remove unauthorized commitments or unverified statements before sending."
      );
    }
  }

  return result;
}
