import type { TicketContext } from "../../types/ticketContext.js";
import { conversationAnalysisSchema, type ConversationAnalysis } from "../../types/ai.js";
import { createStructuredCompletion } from "./openaiClient.js";
import { buildAnalyzeConversationPrompts } from "./prompts/analyzeConversation.prompt.js";

export async function analyzeConversation(context: TicketContext): Promise<ConversationAnalysis> {
  const { systemPrompt, userPrompt } = buildAnalyzeConversationPrompts(context);
  return createStructuredCompletion(systemPrompt, userPrompt, conversationAnalysisSchema);
}
