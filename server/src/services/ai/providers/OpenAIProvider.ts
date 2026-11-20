import { OpenAI } from "openai";
import { type z } from "zod";
import type {
  AIProvider,
  AIProviderCapabilities,
  AICompletionResult,
  CompletionOptions,
  ProviderHealth
} from "./types.js";
import { AIProviderError } from "./types.js";
import { logger } from "../../../config/logger.js";

export interface OpenAIProviderConfig {
  apiKey: string;
  defaultModel?: string;
  maxRetries?: number;
}

export class OpenAIProvider implements AIProvider {
  public readonly name = "openai";
  private client: OpenAI;
  private defaultModel: string;
  private maxRetries: number;

  constructor(config: OpenAIProviderConfig) {
    this.client = new OpenAI({ apiKey: config.apiKey });
    this.defaultModel = config.defaultModel || "gpt-4o-mini";
    this.maxRetries = config.maxRetries ?? 2;
  }

  public getCapabilities(): AIProviderCapabilities {
    return {
      structuredOutput: true,
      streaming: true,
      toolCalling: true,
      vision: true,
      localInference: false
    };
  }

  public async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      await this.client.models.list();
      return { status: "healthy", latencyMs: Date.now() - start };
    } catch (err: any) {
      return { status: "unhealthy", latencyMs: Date.now() - start, message: err.message };
    }
  }

  public async generateStructured<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodType<T>,
    options: CompletionOptions = {}
  ): Promise<AICompletionResult<T>> {
    const model = options.model ?? this.defaultModel;
    const timeoutMs = options.timeoutMs ?? 20000;
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt <= this.maxRetries) {
      const startTime = Date.now();
      try {
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), timeoutMs);

        const completion = await this.client.chat.completions.create(
          {
            model,
            messages: [
              { role: "system", content: systemPrompt },
              { role: "user", content: userPrompt }
            ],
            response_format: { type: "json_object" },
            temperature: options.temperature ?? 0.2,
            max_tokens: options.maxTokens
          },
          { signal: abortController.signal }
        );

        clearTimeout(timeoutId);

        const latencyMs = Date.now() - startTime;
        const rawContent = completion.choices[0]?.message?.content ?? "{}";

        let parsedJson: unknown;
        try {
          parsedJson = JSON.parse(rawContent);
        } catch {
          if (attempt < this.maxRetries) {
            attempt++;
            logger.warn({ attempt }, "Malformed JSON from OpenAI, retrying");
            continue;
          }
          throw new AIProviderError("OpenAI returned invalid JSON response.", 502, true, this.name);
        }

        const validated = schema.safeParse(parsedJson);
        if (!validated.success) {
          if (attempt < this.maxRetries) {
            attempt++;
            logger.warn({ issues: validated.error.issues }, "Schema validation failed on AI output, retrying");
            continue;
          }
          throw new AIProviderError("AI completion did not match expected schema.", 502, false, this.name);
        }

        const usage = completion.usage
          ? {
              promptTokens: completion.usage.prompt_tokens,
              completionTokens: completion.usage.completion_tokens,
              totalTokens: completion.usage.total_tokens
            }
          : undefined;

        return {
          data: validated.data,
          rawText: rawContent,
          usage,
          modelUsed: model,
          latencyMs
        };
      } catch (err: any) {
        lastError = err;
        const latencyMs = Date.now() - startTime;

        if (err.name === "AbortError") {
          logger.error({ model, latencyMs }, "OpenAI request timed out");
          throw new AIProviderError(`OpenAI request timed out after ${timeoutMs}ms.`, 504, true, this.name);
        }

        const isRateLimit = err?.status === 429;
        const isServerError = err?.status >= 500 && err?.status < 600;

        if ((isRateLimit || isServerError) && attempt < this.maxRetries) {
          attempt++;
          const backoffMs = Math.pow(2, attempt) * 500;
          logger.warn({ attempt, backoffMs, status: err.status }, "Rate limit or 5xx from OpenAI, backing off");
          await new Promise((r) => setTimeout(r, backoffMs));
          continue;
        }

        logger.error({ model, latencyMs, err: err?.message }, "OpenAI request failed");
        throw new AIProviderError(
          err?.message || "Error communicating with OpenAI service.",
          err?.status || 500,
          isRateLimit || isServerError,
          this.name
        );
      }
    }

    throw new AIProviderError(lastError?.message || "Max retries exceeded for OpenAI.", 500, false, this.name);
  }
}
