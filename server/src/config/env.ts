import "dotenv/config";
import { z } from "zod";

const isTest = process.env.NODE_ENV === "test";

/**
 * Single source of truth for environment configuration.
 * Fails fast at boot in production if required variables are missing or malformed,
 * while providing safe deterministic defaults during unit and integration testing.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  // AI Provider configuration
  AI_PROVIDER: z.enum(["mock", "openai", "ollama", "gemini", "anthropic"]).default(isTest ? "mock" : "openai"),
  AI_FALLBACK_PROVIDER: z.string().optional(),
  OPENAI_API_KEY: z.string().default(isTest ? "mock-test-openai-key" : ""),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  OLLAMA_BASE_URL: z.string().default("http://127.0.0.1:11434"),
  OLLAMA_MODEL: z.string().default("llama3:8b"),

  // Zendesk Integration & Auth
  ZENDESK_SUBDOMAIN: z.string().default(isTest ? "mock-subdomain" : ""),
  ZENDESK_CLIENT_ID: z.string().default(isTest ? "mock-client-id" : ""),
  ZENDESK_CLIENT_SECRET: z.string().default(isTest ? "mock-client-secret-min-32-chars-long" : ""),
  ADMIN_API_KEY: z.string().default(isTest ? "mock-admin-api-key-test-value" : ""),
  JWT_SECRET: z.string().default(isTest ? "mock-jwt-secret-min-32-chars-long" : ""),

  // Database
  DATABASE_URL: z.string().default(isTest ? "postgresql://copilot:copilot@localhost:5432/copilot_test" : ""),

  // CORS and Origins
  ALLOWED_ORIGINS: z.string().default("https://static.zdassets.com"),

  // Observability
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default(isTest ? "warn" : "info")
}).superRefine((data, ctx) => {
  if (data.NODE_ENV === "production") {
    if (!data.DATABASE_URL || data.DATABASE_URL.includes("mock")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "DATABASE_URL is required in production", path: ["DATABASE_URL"] });
    }
    if (data.AI_PROVIDER === "openai" && (!data.OPENAI_API_KEY || data.OPENAI_API_KEY.includes("mock"))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "OPENAI_API_KEY is required in production when AI_PROVIDER=openai", path: ["OPENAI_API_KEY"] });
    }
    if (!data.ADMIN_API_KEY || data.ADMIN_API_KEY.includes("mock")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "ADMIN_API_KEY is required in production", path: ["ADMIN_API_KEY"] });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

export function loadEnv(customEnv?: Record<string, string | undefined>): Env {
  const source = customEnv ?? process.env;
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}

export const env = loadEnv();
