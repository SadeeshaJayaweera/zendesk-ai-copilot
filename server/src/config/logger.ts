import pino from "pino";
import { env } from "./env.js";

/**
 * Redact paths that could contain customer PII or secrets.
 * Services must never log full ticket bodies; log ticket IDs,
 * hashes, and structured metadata instead.
 */
export const logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: [
      "req.headers.authorization",
      "*.OPENAI_API_KEY",
      "*.ZENDESK_CLIENT_SECRET",
      "*.customerMessage",
      "*.conversationText",
      "*.ticketBody"
    ],
    censor: "[REDACTED]"
  }
});
