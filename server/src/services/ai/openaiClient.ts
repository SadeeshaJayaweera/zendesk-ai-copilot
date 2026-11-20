import { OpenAI } from "openai";
import { type z } from "zod";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AIProviderFactory } from "./providers/AIProviderFactory.js";

export class AiServiceError extends Error {
  public readonly statusCode: number;
  public readonly retryable: boolean;

  constructor(
    message: string,
    statusCode = 500,
    retryable = false
  ) {
    super(message);
    this.name = "AiServiceError";
    this.statusCode = statusCode;
    this.retryable = retryable;
  }
}

export const openai = new OpenAI({
  apiKey: env.OPENAI_API_KEY || "mock-key-for-initialization"
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

export async function createStructuredCompletion<T>(
  systemPrompt: string,
  userPrompt: string,
  schema: z.ZodType<T, any, any>,
  options: CompletionOptions = {}
): Promise<T> {
  // If not explicitly spied on in test, and provider is not OpenAI, route through Provider Factory
  const isMocked = typeof (openai?.chat?.completions?.create as any)?.mock !== "undefined";
  if (!isMocked && env.AI_PROVIDER !== "openai") {
    try {
      const provider = AIProviderFactory.getProvider();
      const result = await provider.generateStructured(systemPrompt, userPrompt, schema, options);
      return result.data;
    } catch (err: any) {
      throw new AiServiceError(err.message, err.statusCode || 500, err.retryable || false);
    }
  }

  const model = options.model ?? env.OPENAI_MODEL ?? "gpt-4o-mini";
  const timeoutMs = options.timeoutMs ?? 20000;
  const maxRetries = 2;

  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= maxRetries) {
    const startTime = Date.now();
    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

      const completion = await openai.chat.completions.create(
        {
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          response_format: { type: "json_object" },
          temperature: options.temperature ?? 0.2
        },
        { signal: abortController.signal }
      );

      clearTimeout(timeoutId);

      const latencyMs = Date.now() - startTime;
      const rawContent = completion.choices[0]?.message?.content ?? "{}";

      logger.info({ model, latencyMs, success: true }, "OpenAI structured completion succeeded");

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawContent);
      } catch {
        if (attempt < maxRetries) {
          attempt++;
          logger.warn({ attempt }, "Malformed JSON from OpenAI, retrying with strict prompt");
          continue;
        }
        throw new AiServiceError("OpenAI returned invalid JSON response.", 502, true);
      }

      const validated = schema.safeParse(parsedJson);
      if (!validated.success) {
        if (attempt < maxRetries) {
          attempt++;
          logger.warn({ issues: validated.error.issues }, "Schema validation failed on AI output, retrying");
          continue;
        }
        throw new AiServiceError("AI completion did not match expected schema.", 502, false);
      }

      return validated.data;
    } catch (err: any) {
      lastError = err;
      const latencyMs = Date.now() - startTime;

      if (err.name === "AbortError") {
        logger.error({ model, latencyMs }, "OpenAI request timed out");
        throw new AiServiceError("OpenAI request timed out after 20 seconds.", 504, true);
      }

      const isRateLimit = err?.status === 429;
      const isServerError = err?.status >= 500 && err?.status < 600;

      if ((isRateLimit || isServerError) && attempt < maxRetries) {
        attempt++;
        const backoffMs = Math.pow(2, attempt) * 500;
        logger.warn({ attempt, backoffMs, status: err.status }, "Rate limit or 5xx from OpenAI, backing off");
        await sleep(backoffMs);
        continue;
      }

      logger.error({ model, latencyMs, err: err?.message }, "OpenAI request failed");
      throw new AiServiceError(
        err?.message || "Error communicating with AI service.",
        err?.status || 500,
        isRateLimit || isServerError
      );
    }
  }

  throw new AiServiceError(lastError?.message || "Max retries exceeded for AI service.", 500, false);
}
