import { z } from "zod";

export const customerSentimentSchema = z.enum([
  "positive",
  "neutral",
  "negative",
  "frustrated",
  "angry"
]);
export type CustomerSentiment = z.infer<typeof customerSentimentSchema>;
