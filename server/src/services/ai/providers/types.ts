import { type z } from "zod";

export interface AIProviderCapabilities {
  structuredOutput: boolean;
  streaming: boolean;
  toolCalling: boolean;
  vision: boolean;
  localInference: boolean;
}

export interface CompletionOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface AICompletionResult<T> {
  data: T;
  rawText: string;
  usage?: TokenUsage;
  modelUsed: string;
  latencyMs: number;
}

export interface ProviderHealth {
  status: "healthy" | "degraded" | "unhealthy";
  latencyMs?: number;
  message?: string;
}

export class AIProviderError extends Error {
  public readonly statusCode: number;
  public readonly retryable: boolean;
  public readonly providerName: string;

  constructor(message: string, statusCode = 500, retryable = false, providerName = "unknown") {
    super(message);
    this.name = "AIProviderError";
    this.statusCode = statusCode;
    this.retryable = retryable;
    this.providerName = providerName;
  }
}

export interface AIProvider {
  readonly name: string;
  getCapabilities(): AIProviderCapabilities;
  healthCheck(): Promise<ProviderHealth>;
  generateStructured<T>(
    _systemPrompt: string,
    _userPrompt: string,
    _schema: z.ZodType<T, any, any>,
    _options?: CompletionOptions
  ): Promise<AICompletionResult<T>>;
}
