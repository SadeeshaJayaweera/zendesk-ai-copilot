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

export const draftAnalysisIssueSchema = z.object({
  type: z.enum([
    "unanswered_question",
    "defensive_tone",
    "unsupported_promise",
    "grammar_error",
    "unclear_phrasing",
    "too_robotic",
    "too_verbose",
    "contradiction"
  ]),
  message: z.string(),
  severity: z.enum(["info", "warning", "critical"])
});
export type DraftAnalysisIssue = z.infer<typeof draftAnalysisIssueSchema>;

export const draftAnalysisSchema = z.object({
  score: z.number().int().min(0).max(100),
  scores: z.object({
    professionalism: z.number().int().min(0).max(100),
    friendliness: z.number().int().min(0).max(100),
    empathy: z.number().int().min(0).max(100),
    clarity: z.number().int().min(0).max(100)
  }),
  strengths: z.array(z.string()),
  issues: z.array(draftAnalysisIssueSchema),
  recommended_changes: z.array(z.string())
});
export type DraftAnalysis = z.infer<typeof draftAnalysisSchema>;

export const generateReplySchema = z.object({
  reply: z.string(),
  missing_information: z.array(z.string()).default([]),
  tone_used: z.string(),
  warnings: z.array(z.string()).optional()
});
export type GenerateReplyResult = z.infer<typeof generateReplySchema>;
