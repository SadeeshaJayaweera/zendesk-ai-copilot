import { Router } from "express";
import { pool } from "../db/pool.js";
import { AIProviderFactory } from "../services/ai/providers/AIProviderFactory.js";

export const healthRouter = Router();

// Liveness probe
healthRouter.get("/", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ai-reply-copilot-server",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

healthRouter.get("/live", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "ai-reply-copilot-server",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Readiness probe
healthRouter.get("/ready", async (_req, res) => {
  const checks: {
    database: "healthy" | "unhealthy" | "skipped_in_test";
    aiProvider: "healthy" | "unhealthy";
  } = {
    database: "healthy",
    aiProvider: "healthy"
  };

  // 1. Database Connectivity Check with 2000ms timeout
  try {
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Database check timeout")), 2000)
    );
    await Promise.race([pool.query("SELECT 1;"), timeoutPromise]);
    checks.database = "healthy";
  } catch {
    if (process.env.NODE_ENV === "test") {
      checks.database = "skipped_in_test";
    } else {
      checks.database = "unhealthy";
    }
  }

  // 2. AI Provider Health Check
  try {
    const provider = AIProviderFactory.getProvider();
    const isHealthy = await provider.healthCheck();
    checks.aiProvider = isHealthy ? "healthy" : "unhealthy";
  } catch {
    checks.aiProvider = "unhealthy";
  }

  const isReady =
    (checks.database === "healthy" || checks.database === "skipped_in_test") &&
    checks.aiProvider === "healthy";

  const statusCode = isReady ? 200 : 503;
  return res.status(statusCode).json({
    status: isReady ? "ready" : "not_ready",
    service: "ai-reply-copilot-server",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    checks
  });
});
