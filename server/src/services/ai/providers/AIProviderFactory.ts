import { type z } from "zod";
import type { AIProvider, AICompletionResult, CompletionOptions } from "./types.js";
import { AIProviderError } from "./types.js";
import { MockProvider } from "./MockProvider.js";
import { OpenAIProvider } from "./OpenAIProvider.js";
import { OllamaProvider } from "./OllamaProvider.js";
import { env } from "../../../config/env.js";
import { logger } from "../../../config/logger.js";

export interface FallbackPolicy {
  allowFallback: boolean;
  allowedFallbackProviders: string[];
}

export class AIProviderFactory {
  private static providers = new Map<string, AIProvider>();

  public static initialize(): void {
    // 1. Always register deterministic mock provider
    this.registerProvider(new MockProvider());

    // 2. Register OpenAI provider if key exists or not empty
    if (env.OPENAI_API_KEY && !env.OPENAI_API_KEY.includes("mock")) {
      this.registerProvider(
        new OpenAIProvider({
          apiKey: env.OPENAI_API_KEY,
          defaultModel: env.OPENAI_MODEL
        })
      );
    } else {
      // In development/test with mock key, register Mock as fallback for openai
      this.registerProvider(new MockProvider(), "openai");
    }

    // 3. Register Ollama provider
    this.registerProvider(
      new OllamaProvider({
        baseUrl: env.OLLAMA_BASE_URL,
        defaultModel: env.OLLAMA_MODEL
      })
    );
  }

  public static registerProvider(provider: AIProvider, alias?: string): void {
    const key = alias || provider.name;
    this.providers.set(key, provider);
  }

  public static getProvider(name?: string): AIProvider {
    if (this.providers.size === 0) {
      this.initialize();
    }

    const targetName = name || env.AI_PROVIDER || "mock";
    const provider = this.providers.get(targetName);

    if (!provider) {
      logger.warn({ requested: targetName }, "Requested AI provider not found, falling back to mock provider");
      return this.providers.get("mock") || new MockProvider();
    }

    return provider;
  }

  /**
   * Executes completion with optional privacy-governed fallback.
   * Under Non-Negotiable Principle #8 and #14: Never silently leak customer data to unapproved providers.
   */
  public static async executeWithFallback<T>(
    systemPrompt: string,
    userPrompt: string,
    schema: z.ZodType<T>,
    options?: CompletionOptions,
    primaryProviderName?: string,
    fallbackPolicy?: FallbackPolicy
  ): Promise<AICompletionResult<T>> {
    const primary = this.getProvider(primaryProviderName);

    try {
      return await primary.generateStructured(systemPrompt, userPrompt, schema, options);
    } catch (err: any) {
      // Check if fallback is authorized
      if (!fallbackPolicy?.allowFallback || fallbackPolicy.allowedFallbackProviders.length === 0) {
        throw err;
      }

      for (const fallbackName of fallbackPolicy.allowedFallbackProviders) {
        if (fallbackName === primary.name) continue;

        logger.warn(
          { primary: primary.name, fallback: fallbackName, reason: err.message },
          "Primary AI provider failed, attempting authorized fallback"
        );

        const fallbackProvider = this.getProvider(fallbackName);
        try {
          return await fallbackProvider.generateStructured(systemPrompt, userPrompt, schema, options);
        } catch (fallbackErr: any) {
          logger.error({ fallback: fallbackName, err: fallbackErr.message }, "Fallback AI provider also failed");
        }
      }

      throw new AIProviderError(
        `All configured AI providers failed. Primary error: ${err.message}`,
        500,
        false,
        primary.name
      );
    }
  }
}
