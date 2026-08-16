import { OpenAI } from "openai";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { type z } from "zod";

export class AiServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 500,
    public readonly retryable = false
  ) {
    super(message);
    this.name = "AiServiceError";
  }
}

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY
});

interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
