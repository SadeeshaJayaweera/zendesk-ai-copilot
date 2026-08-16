import { z } from "zod";

export const customerSentimentSchema = z.enum([
  "positive",
  "neutral",
  "negative",
  "frustrated",
  "angry"
]);
export type CustomerSentiment = z.infer<typeof customerSentimentSchema>;

export const customerIntentSchema = z.enum([
  "question",
  "bug_report",
  "feature_request",
  "billing",
  "cancellation",
  "praise",
  "general"
]);
export type CustomerIntent = z.infer<typeof customerIntentSchema>;

export const urgencyLevelSchema = z.enum(["low", "medium", "high", "urgent"]);
export type UrgencyLevel = z.infer<typeof urgencyLevelSchema>;

export const conversationAnalysisSchema = z.object({
  customer_sentiment: customerSentimentSchema,
  customer_intent: customerIntentSchema,
  urgency: urgencyLevelSchema,
  conversation_tone: z.string(),
  recommended_tone: z.string(),
  response_length: z.enum(["short", "medium", "long"]),
  needs_apology: z.boolean(),
  needs_clarification: z.boolean(),
  confidence: z.number().min(0).max(1)
});
export type ConversationAnalysis = z.infer<typeof conversationAnalysisSchema>;
