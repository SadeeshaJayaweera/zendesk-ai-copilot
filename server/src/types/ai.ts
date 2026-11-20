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
  "outage_report",
  "security_incident",
  "general"
]);
export type CustomerIntent = z.infer<typeof customerIntentSchema>;

export const urgencyLevelSchema = z.enum(["low", "medium", "high", "urgent"]);
export type UrgencyLevel = z.infer<typeof urgencyLevelSchema>;

export const businessImpactSchema = z.enum(["none", "low", "medium", "high", "critical"]);
export type BusinessImpact = z.infer<typeof businessImpactSchema>;

export const technicalComplexitySchema = z.enum(["low", "medium", "high", "expert"]);
export type TechnicalComplexity = z.infer<typeof technicalComplexitySchema>;

export const frustrationLevelSchema = z.enum(["none", "mild", "moderate", "severe"]);
export type FrustrationLevel = z.infer<typeof frustrationLevelSchema>;

export const conversationAnalysisSchema = z.object({
  // Core / Backward-Compatible fields
  customer_sentiment: customerSentimentSchema,
  customer_intent: customerIntentSchema,
  urgency: urgencyLevelSchema,
  conversation_tone: z.string(),
  recommended_tone: z.string(),
  response_length: z.enum(["short", "medium", "long"]),
  needs_apology: z.boolean(),
  needs_clarification: z.boolean(),
  confidence: z.number().min(0).max(1),

  // Advanced Enterprise Intelligence fields
  business_impact: businessImpactSchema.default("medium"),
  technical_complexity: technicalComplexitySchema.default("medium"),
  frustration_level: frustrationLevelSchema.default("none"),
  repeated_contact_indicators: z.boolean().default(false),
  unanswered_questions: z.array(z.string()).default([]),
  missing_information: z.array(z.string()).default([]),
  escalation_recommended: z.boolean().default(false),
  escalation_reason: z.string().nullable().default(null),
  observed_facts: z.array(z.string()).default([]),
  hypotheses: z.array(z.string()).default([]),
  customer_commitments: z.array(z.string()).default([])
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
    "contradiction",
    "security_risk",
    "policy_violation"
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
    clarity: z.number().int().min(0).max(100),
    technical_accuracy: z.number().int().min(0).max(100).default(80),
    policy_compliance: z.number().int().min(0).max(100).default(90)
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
  warnings: z.array(z.string()).optional(),
  citations: z.array(z.string()).optional()
});
export type GenerateReplyResult = z.infer<typeof generateReplySchema>;

export const rewriteActionSchema = z.enum([
  "improveTone",
  "makeMoreProfessional",
  "makeMoreFriendly",
  "makeMoreEmpathetic",
  "makeMoreConcise",
  "makeMoreClear",
  "makeLessRobotic",
  "makeMoreConfident",
  "deEscalate",
  "rewriteCompletely",
  "technicalExplanation",
  "executiveSummary"
]);
export type RewriteAction = z.infer<typeof rewriteActionSchema>;

export const rewriteResponseSchema = z.object({
  rewrittenText: z.string(),
  actionApplied: rewriteActionSchema,
  warnings: z.array(z.string()).optional()
});
export type RewriteResponse = z.infer<typeof rewriteResponseSchema>;
