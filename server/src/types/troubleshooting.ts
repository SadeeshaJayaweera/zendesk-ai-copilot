import { z } from "zod";
import { ticketContextSchema } from "./ticketContext.js";

export const diagnosticCategorySchema = z.enum([
  "http_error",
  "authentication_failure",
  "authorization_failure",
  "timeout",
  "rate_limit",
  "webhook_failure",
  "data_mismatch",
  "integration_error",
  "invalid_payload",
  "database_connectivity",
  "configuration_problem",
  "general"
]);
export type DiagnosticCategory = z.infer<typeof diagnosticCategorySchema>;

export const diagnosticInputSchema = z.object({
  ticketContext: ticketContextSchema.optional(),
  integrationName: z.string().optional(),
  httpStatusCode: z.number().int().optional(),
  endpointUrl: z.string().optional(),
  errorMessage: z.string().optional(),
  requestPayload: z.string().optional(),
  responsePayload: z.string().optional(),
  headers: z.record(z.string()).optional(),
  rawLogs: z.string().optional(),
  category: diagnosticCategorySchema.default("general")
});
export type DiagnosticInput = z.infer<typeof diagnosticInputSchema>;

export const diagnosticStepSchema = z.object({
  stepNumber: z.number().int(),
  description: z.string(),
  safeCommandOrQuery: z.string().optional(),
  expectedOutcome: z.string(),
  isReadOnly: z.boolean().default(true)
});
export type DiagnosticStep = z.infer<typeof diagnosticStepSchema>;

export const troubleshootingSuggestionSchema = z.object({
  potentialRootCause: z.string(),
  isHypothesis: z.boolean().default(true),
  confidence: z.number().min(0).max(1),
  riskLevel: z.enum(["low", "medium", "high", "critical"]),
  supportingEvidence: z.array(z.string()),
  diagnosticSteps: z.array(diagnosticStepSchema),
  recommendedNextAction: z.string(),
  requiredAdditionalInformation: z.array(z.string())
});
export type TroubleshootingSuggestion = z.infer<typeof troubleshootingSuggestionSchema>;

export const troubleshootingReportSchema = z.object({
  primaryIssueSummary: z.string(),
  classifiedCategory: diagnosticCategorySchema,
  severity: z.enum(["low", "medium", "high", "critical"]),
  suggestions: z.array(troubleshootingSuggestionSchema),
  safeCustomerExplanation: z.string(),
  redactedTokensCount: z.number().int().default(0)
});
export type TroubleshootingReport = z.infer<typeof troubleshootingReportSchema>;
