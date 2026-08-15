import "dotenv/config";
import { z } from "zod";

/**
 * Single source of truth for environment configuration.
 * Fails fast at boot if required variables are missing or malformed,
 * rather than surfacing confusing errors deep in a request handler.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),

  // Server-side only. Never sent to the browser/Zendesk iframe.
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),

  ZENDESK_SUBDOMAIN: z.string().min(1, "ZENDESK_SUBDOMAIN is required"),
  ZENDESK_CLIENT_ID: z.string().min(1, "ZENDESK_CLIENT_ID is required"),
  ZENDESK_CLIENT_SECRET: z.string().min(1, "ZENDESK_CLIENT_SECRET is required"),

  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  // Comma-separated list of origins allowed to call this API.
  // Zendesk apps are served from https://<subdomain>.zendesk.com and
  // https://static.zdassets.com in the sandboxed iframe context.
  ALLOWED_ORIGINS: z.string().default("https://static.zdassets.com")
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    // Intentionally throw synchronously so the process cannot start
    // in a half-configured state.
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }

  return parsed.data;
}

export const env = loadEnv();
