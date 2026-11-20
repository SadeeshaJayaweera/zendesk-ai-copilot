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

export interface OllamaProviderConfig {
  baseUrl?: string;
  defaultModel?: string;
}

export class OllamaProvider implements AIProvider {
  public readonly name = "ollama";
  private baseUrl: string;
  private defaultModel: string;

  constructor(config: OllamaProviderConfig = {}) {
    this.baseUrl = (config.baseUrl || "http://127.0.0.1:11434").replace(/\/$/, "");
    this.defaultModel = config.defaultModel || "llama3:8b";
  }

  public getCapabilities(): AIProviderCapabilities {
    return {
      structuredOutput: true,
      streaming: true,
      toolCalling: false,
      vision: false,
      localInference: true
    };
  }

  public async healthCheck(): Promise<ProviderHealth> {
    const start = Date.now();
    try {
      const res = await fetch(`${this.baseUrl}/api/tags`, { method: "GET" });
      if (res.ok) {
        return { status: "healthy", latencyMs: Date.now() - start };
      }
      return { status: "unhealthy", latencyMs: Date.now() - start, message: `HTTP ${res.status}` };
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
    const timeoutMs = options.timeoutMs ?? 30000;
    const startTime = Date.now();

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt }
          ],
          format: "json",
          stream: false,
          options: {
            temperature: options.temperature ?? 0.2
          }
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        throw new AIProviderError(`Ollama request failed with HTTP ${res.status}: ${errText}`, res.status, true, this.name);
      }

      const body: any = await res.json();
      const rawText = body.message?.content ?? "{}";
      const latencyMs = Date.now() - startTime;

      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawText);
      } catch {
        logger.error({ rawText }, "Ollama returned invalid JSON");
        throw new AIProviderError("Ollama response was not valid JSON.", 502, false, this.name);
      }

      const validated = schema.safeParse(parsedJson);
      if (!validated.success) {
        logger.error({ issues: validated.error.issues }, "Ollama JSON failed schema validation");
        throw new AIProviderError("Ollama JSON output failed schema validation.", 502, false, this.name);
      }

      const usage = body.prompt_eval_count && body.eval_count
        ? {
            promptTokens: body.prompt_eval_count,
            completionTokens: body.eval_count,
            totalTokens: body.prompt_eval_count + body.eval_count
          }
        : undefined;

      return {
        data: validated.data,
        rawText,
        usage,
        modelUsed: model,
        latencyMs
      };
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") {
        throw new AIProviderError(`Ollama request timed out after ${timeoutMs}ms.`, 504, true, this.name);
      }
      if (err instanceof AIProviderError) {
        throw err;
      }
      throw new AIProviderError(err.message || "Failed to communicate with local Ollama service.", 500, true, this.name);
    }
  }
}
