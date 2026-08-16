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
