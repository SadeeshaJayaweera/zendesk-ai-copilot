import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { verifyZendeskJwt } from "../middleware/auth.js";
import {
  getAgentPreferences,
  upsertAgentPreferences,
  getAgentTelemetry
} from "../db/agentProfileRepo.js";

export const agentsRouter = Router();

agentsRouter.use(verifyZendeskJwt);

const agentPreferencesSchema = z.object({
  formality: z.number().min(0).max(1).default(0.5),
  warmth: z.number().min(0).max(1).default(0.5),
  conciseness: z.number().min(0).max(1).default(0.5),
  empathy: z.number().min(0).max(1).default(0.5),
  preferredGreeting: z.string().max(128).nullable().optional(),
  preferredClosing: z.string().max(128).nullable().optional(),
  toneBias: z.string().max(64).default("balanced")
});

agentsRouter.get("/:id/preferences", async (req: Request, res: Response) => {
  const agentId = Number.parseInt(req.params.id as string, 10);
  if (Number.isNaN(agentId)) {
    return res.status(400).json({ error: "invalid_id", message: "Agent ID must be numeric." });
  }

  const orgId = req.organizationId || "default";
  try {
    const preferences = await getAgentPreferences(orgId, agentId);
    return res.status(200).json({ preferences });
  } catch (err: any) {
    return res.status(500).json({
      error: "database_error",
      message: err.message || "Failed to retrieve agent preferences."
    });
  }
});

agentsRouter.put("/:id/preferences", async (req: Request, res: Response) => {
  const agentId = Number.parseInt(req.params.id as string, 10);
  if (Number.isNaN(agentId)) {
    return res.status(400).json({ error: "invalid_id", message: "Agent ID must be numeric." });
  }

  const parseResult = agentPreferencesSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "invalid_payload",
      message: "Agent preferences validation failed.",
      details: parseResult.error.issues
    });
  }

  const orgId = req.organizationId || "default";
  const prefs = {
    organizationId: orgId,
    agentId,
    formality: parseResult.data.formality,
    warmth: parseResult.data.warmth,
    conciseness: parseResult.data.conciseness,
    empathy: parseResult.data.empathy,
    preferredGreeting: parseResult.data.preferredGreeting ?? null,
    preferredClosing: parseResult.data.preferredClosing ?? null,
    toneBias: parseResult.data.toneBias
  };

  try {
    await upsertAgentPreferences(prefs);
    return res.status(200).json({ status: "updated", preferences: prefs });
  } catch (err: any) {
    return res.status(500).json({
      error: "database_error",
      message: err.message || "Failed to update agent preferences."
    });
  }
});

agentsRouter.get("/:id/telemetry", async (req: Request, res: Response) => {
  const agentId = Number.parseInt(req.params.id as string, 10);
  if (Number.isNaN(agentId)) {
    return res.status(400).json({ error: "invalid_id", message: "Agent ID must be numeric." });
  }

  const orgId = req.organizationId || "default";
  try {
    const telemetry = await getAgentTelemetry(orgId, agentId);
    return res.status(200).json({ telemetry });
  } catch (err: any) {
    return res.status(500).json({
      error: "database_error",
      message: err.message || "Failed to retrieve agent telemetry."
    });
  }
});
