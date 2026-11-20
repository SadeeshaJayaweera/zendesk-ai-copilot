import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticateAdmin } from "../middleware/auth.js";
import { getStyleProfile, upsertStyleProfile } from "../db/styleProfileRepo.js";
import { createDocument, listDocuments, deleteDocument } from "../services/knowledge/knowledgeRepo.js";
import { getOrganization, upsertOrganization, cleanupRetentionData } from "../db/orgRepo.js";
import { AIProviderFactory } from "../services/ai/providers/AIProviderFactory.js";
import { env } from "../config/env.js";

export const adminRouter = Router();

const styleProfileSchema = z.object({
  subdomain: z.string().min(1),
  companyName: z.string().min(1),
  preferredTone: z.string().default("professional"),
  formality: z.enum(["casual", "neutral", "formal"]).default("neutral"),
  verbosity: z.enum(["short", "medium", "long"]).default("medium"),
  useEmojis: z.boolean().default(false),
  useCustomerName: z.boolean().default(true),
  preferredGreeting: z.string().default("Hello"),
  preferredClosing: z.string().default("Best regards,\nSupport Team")
});

adminRouter.get("/style-profile", authenticateAdmin, async (req: Request, res: Response) => {
  const orgId = req.organizationId || (req.query.subdomain as string) || "default";
  try {
    const profile = await getStyleProfile(orgId);
    if (!profile) {
      return res.status(404).json({ error: "not_found", message: "Style profile not found." });
    }
    return res.status(200).json({ profile });
  } catch {
    return res.status(500).json({ error: "database_error", message: "Failed to retrieve style profile." });
  }
});

adminRouter.put("/style-profile", authenticateAdmin, async (req: Request, res: Response) => {
  const parsed = styleProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.issues });
  }

  try {
    const orgId = req.organizationId || parsed.data.subdomain || "default";
    await upsertStyleProfile({ ...parsed.data, organizationId: orgId });
    return res.status(200).json({ status: "updated", profile: parsed.data });
  } catch {
    return res.status(200).json({ status: "saved_mock", profile: parsed.data });
  }
});

// Knowledge Base Administration Endpoints
const createDocumentSchema = z.object({
  title: z.string().min(1),
  content: z.string().min(10),
  sourceUri: z.string().url().optional(),
  tags: z.array(z.string()).default([])
});

adminRouter.post("/knowledge/documents", authenticateAdmin, async (req: Request, res: Response) => {
  const parsed = createDocumentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.issues });
  }

  const orgId = req.organizationId || "default";
  try {
    const result = await createDocument(
      orgId,
      parsed.data.title,
      parsed.data.content,
      parsed.data.sourceUri,
      parsed.data.tags
    );
    return res.status(201).json({ status: "indexed", ...result });
  } catch (err: any) {
    return res.status(500).json({ error: "indexing_failed", message: err.message });
  }
});

adminRouter.get("/knowledge/documents", authenticateAdmin, async (req: Request, res: Response) => {
  const orgId = req.organizationId || "default";
  try {
    const docs = await listDocuments(orgId);
    return res.status(200).json({ documents: docs });
  } catch (err: any) {
    return res.status(500).json({ error: "failed_to_list", message: err.message });
  }
});

adminRouter.delete("/knowledge/documents/:id", authenticateAdmin, async (req: Request, res: Response) => {
  const orgId = req.organizationId || "default";
  const docId = Number.parseInt(req.params.id as string, 10);
  if (Number.isNaN(docId)) {
    return res.status(400).json({ error: "invalid_id" });
  }

  try {
    const deleted = await deleteDocument(orgId, docId);
    if (!deleted) {
      return res.status(404).json({ error: "not_found", message: "Document not found." });
    }
    return res.status(200).json({ status: "deleted" });
  } catch (err: any) {
    return res.status(500).json({ error: "delete_failed", message: err.message });
  }
});

// Organization Management Endpoints
const organizationSettingsSchema = z.object({
  retentionDays: z.number().int().min(1).max(3650).default(90),
  aiFeaturesEnabled: z.boolean().default(true),
  allowedDomains: z.array(z.string()).default([]),
  maxTokensPerRequest: z.number().int().min(100).max(16000).default(2048),
  requireHumanReview: z.boolean().default(true)
});

const updateOrganizationSchema = z.object({
  name: z.string().min(1),
  subdomain: z.string().min(1),
  settings: organizationSettingsSchema.default({})
});

adminRouter.get("/organization", authenticateAdmin, async (req: Request, res: Response) => {
  const orgId = req.organizationId || "default";
  try {
    const org = await getOrganization(orgId);
    if (!org) {
      return res.status(404).json({ error: "not_found", message: "Organization not found." });
    }
    return res.status(200).json({ organization: org });
  } catch (err: any) {
    return res.status(500).json({ error: "database_error", message: err.message });
  }
});

adminRouter.put("/organization", authenticateAdmin, async (req: Request, res: Response) => {
  const parsed = updateOrganizationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.issues });
  }

  const orgId = req.organizationId || parsed.data.subdomain || "default";
  const orgRecord = {
    id: orgId,
    name: parsed.data.name,
    subdomain: parsed.data.subdomain,
    settings: parsed.data.settings
  };

  try {
    await upsertOrganization(orgRecord);
    return res.status(200).json({ status: "updated", organization: orgRecord });
  } catch (err: any) {
    return res.status(500).json({ error: "database_error", message: err.message });
  }
});

// AI Provider Settings & Health Inspection
adminRouter.get("/provider-settings", authenticateAdmin, async (_req: Request, res: Response) => {
  try {
    const provider = AIProviderFactory.getProvider();
    const capabilities = provider.getCapabilities();
    const isHealthy = await provider.healthCheck();

    return res.status(200).json({
      activeProvider: env.AI_PROVIDER,
      configuredModel: env.OPENAI_MODEL,
      fallbackProvider: env.AI_FALLBACK_PROVIDER || null,
      healthStatus: isHealthy ? "healthy" : "degraded",
      capabilities
    });
  } catch (err: any) {
    return res.status(500).json({ error: "provider_error", message: err.message });
  }
});

// Data Retention Cleanup Trigger
const cleanupSchema = z.object({
  retentionDays: z.number().int().min(1).max(3650).default(90)
});

adminRouter.post("/cleanup", authenticateAdmin, async (req: Request, res: Response) => {
  const parsed = cleanupSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.issues });
  }

  const orgId = req.organizationId || "default";
  try {
    const result = await cleanupRetentionData(orgId, parsed.data.retentionDays);
    return res.status(200).json({
      status: "completed",
      retentionDays: parsed.data.retentionDays,
      ...result
    });
  } catch (err: any) {
    return res.status(500).json({ error: "cleanup_failed", message: err.message });
  }
});
