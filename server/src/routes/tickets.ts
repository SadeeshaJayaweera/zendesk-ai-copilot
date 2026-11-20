import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { ticketContextSchema } from "../types/ticketContext.js";
import { rewriteActionSchema } from "../types/ai.js";
import { conversationHash } from "../services/zendesk/conversationHelpers.js";
import { analyzeConversation } from "../services/ai/analyzeConversation.js";
import { analyzeDraft } from "../services/ai/analyzeDraft.js";
import { generateReply } from "../services/ai/generateReply.js";
import { rewriteDraft } from "../services/ai/rewrite.js";
import { insertFeedbackEvent } from "../db/feedbackRepo.js";
import { getCachedAnalysis, setCachedAnalysis } from "../db/cacheRepo.js";
import { rateLimiter } from "../middleware/rateLimiter.js";
import { verifyZendeskJwt } from "../middleware/auth.js";
import { retrieveRelevantKnowledge } from "../services/knowledge/knowledgeRetriever.js";
import { diagnosticInputSchema } from "../types/troubleshooting.js";
import { diagnoseTechnicalIssue } from "../services/troubleshooting/diagnoseIssue.js";
import { analyzeSlaAndEscalation } from "../services/escalation/escalationAnalyzer.js";
import { getStyleProfile } from "../db/styleProfileRepo.js";
import { getAgentPreferences } from "../db/agentProfileRepo.js";
import type { StyleProfileOptions } from "../services/ai/prompts/generateReply.prompt.js";

export const ticketsRouter = Router();

// 1. Rate limiting
ticketsRouter.use(rateLimiter(60, 60000));

// 2. Authentication & Tenant Authorization
ticketsRouter.use(verifyZendeskJwt);

ticketsRouter.post("/:id/context", async (req: Request, res: Response) => {
  const parseResult = ticketContextSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "invalid_payload",
      message: "Ticket context failed schema validation.",
      details: parseResult.error.issues
    });
  }

  const context = parseResult.data;
  const paramId = Number.parseInt(req.params.id as string, 10);
  if (!Number.isNaN(paramId) && context.ticketId !== paramId) {
    return res.status(400).json({
      error: "ticket_id_mismatch",
      message: `URL ticket ID (${paramId}) does not match body ticketId (${context.ticketId}).`
    });
  }

  const orgId = req.organizationId || "default";
  const forceRegenerate = req.query.force === "true";
  const hash = conversationHash(context);

  if (!forceRegenerate) {
    const cached = await getCachedAnalysis(orgId, context.ticketId, hash);
    if (cached) {
      req.log?.info({ ticketId: context.ticketId, orgId, cached: true }, "Returning cached conversation analysis");
      return res.status(200).json({ context, analysis: cached, cached: true });
    }
  }

  try {
    const analysis = await analyzeConversation(context);
    await setCachedAnalysis(orgId, context.ticketId, hash, analysis);

    req.log?.info({ ticketId: context.ticketId, orgId, cached: false }, "Generated new conversation analysis");
    return res.status(200).json({ context, analysis, cached: false });
  } catch (err: any) {
    req.log?.error({ err: err.message, orgId }, "Conversation analysis failed");
    return res.status(err.statusCode || 500).json({
      error: "ai_analysis_failed",
      message: err.message || "Failed to analyze ticket conversation."
    });
  }
});

const draftAnalysisRequestSchema = z.object({
  ticketContext: ticketContextSchema,
  agentDraft: z.string().min(1, "agentDraft cannot be empty")
});

ticketsRouter.post("/:id/draft-analysis", async (req: Request, res: Response) => {
  const parseResult = draftAnalysisRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "invalid_payload",
      message: "Invalid draft analysis payload.",
      details: parseResult.error.issues
    });
  }

  try {
    const result = await analyzeDraft(parseResult.data.ticketContext, parseResult.data.agentDraft);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      error: "draft_analysis_failed",
      message: err.message || "Failed to evaluate agent draft."
    });
  }
});

const generateReplyRequestSchema = z.object({
  ticketContext: ticketContextSchema,
  toneOverride: z.string().optional(),
  agentDraft: z.string().optional()
});

ticketsRouter.post("/:id/generate-reply", async (req: Request, res: Response) => {
  const parseResult = generateReplyRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "invalid_payload",
      message: "Invalid reply generation payload.",
      details: parseResult.error.issues
    });
  }

  try {
    const orgId = req.organizationId || "default";
    const { ticketContext, toneOverride, agentDraft } = parseResult.data;
    const analysis = await analyzeConversation(ticketContext);
    const knowledge = await retrieveRelevantKnowledge(orgId, ticketContext);

    // Blend company style profile with agent personal preferences
    const baseProfile = await getStyleProfile(orgId).catch(() => null);
    let styleOpts: StyleProfileOptions | undefined = baseProfile ? {
      companyName: baseProfile.companyName,
      formality: baseProfile.formality,
      useEmojis: baseProfile.useEmojis,
      preferredGreeting: baseProfile.preferredGreeting,
      preferredClosing: baseProfile.preferredClosing,
      responseLength: baseProfile.verbosity
    } : undefined;

    const agentId = req.user?.userId || (req.body as any).agentId;
    if (agentId) {
      const agentPrefs = await getAgentPreferences(orgId, agentId).catch(() => null);
      if (agentPrefs) {
        styleOpts = {
          ...styleOpts,
          preferredGreeting: agentPrefs.preferredGreeting || styleOpts?.preferredGreeting,
          preferredClosing: agentPrefs.preferredClosing || styleOpts?.preferredClosing,
          formality: agentPrefs.formality > 0.65 ? "formal" : agentPrefs.formality < 0.35 ? "casual" : styleOpts?.formality || "neutral"
        };
      }
    }

    const result = await generateReply(ticketContext, analysis, toneOverride, agentDraft, styleOpts);
    if (knowledge.hasGrounding) {
      result.citations = knowledge.citations.map((c) => c.citationTag);
    }
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      error: "reply_generation_failed",
      message: err.message || "Failed to generate AI reply draft."
    });
  }
});

ticketsRouter.post("/:id/knowledge-suggestions", async (req: Request, res: Response) => {
  const parseResult = ticketContextSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "invalid_payload",
      message: "Invalid ticket context payload.",
      details: parseResult.error.issues
    });
  }

  const orgId = req.organizationId || "default";
  try {
    const suggestions = await retrieveRelevantKnowledge(orgId, parseResult.data);
    return res.status(200).json(suggestions);
  } catch (err: any) {
    return res.status(500).json({
      error: "knowledge_retrieval_failed",
      message: err.message || "Failed to retrieve knowledge suggestions."
    });
  }
});

const rewriteRequestSchema = z.object({
  ticketContext: ticketContextSchema.optional(),
  agentDraft: z.string().min(1, "agentDraft cannot be empty"),
  action: rewriteActionSchema
});

ticketsRouter.post("/:id/rewrite", async (req: Request, res: Response) => {
  const parseResult = rewriteRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "invalid_payload",
      message: "Invalid rewrite request payload.",
      details: parseResult.error.issues
    });
  }

  try {
    const { agentDraft, action, ticketContext } = parseResult.data;
    const result = await rewriteDraft(agentDraft, action, ticketContext);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      error: "rewrite_failed",
      message: err.message || "Failed to rewrite draft."
    });
  }
});

const feedbackSchema = z.object({
  agentId: z.number().default(1),
  eventType: z.enum(["helpful", "not_helpful", "accepted", "edited", "rejected"]),
  action: z.string().optional()
});

ticketsRouter.post("/:id/feedback", async (req: Request, res: Response) => {
  const parseResult = feedbackSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "invalid_payload",
      message: "Invalid feedback event payload.",
      details: parseResult.error.issues
    });
  }

  const ticketId = Number.parseInt(req.params.id as string, 10);
  const orgId = req.organizationId || "default";
  try {
    const eventId = await insertFeedbackEvent({
      organizationId: orgId,
      ticketId: Number.isNaN(ticketId) ? 0 : ticketId,
      agentId: parseResult.data.agentId,
      eventType: parseResult.data.eventType,
      action: parseResult.data.action
    });
    return res.status(201).json({ status: "recorded", id: eventId });
  } catch {
    return res.status(200).json({ status: "recorded_in_memory" });
  }
});

ticketsRouter.post("/:id/diagnose", async (req: Request, res: Response) => {
  const parseResult = diagnosticInputSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "invalid_payload",
      message: "Invalid technical diagnosis payload.",
      details: parseResult.error.issues
    });
  }

  try {
    const report = await diagnoseTechnicalIssue(parseResult.data);
    return res.status(200).json(report);
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      error: "diagnosis_failed",
      message: err.message || "Failed to analyze technical incident."
    });
  }
});

ticketsRouter.post("/:id/escalation-analysis", async (req: Request, res: Response) => {
  const parseResult = ticketContextSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({
      error: "invalid_payload",
      message: "Ticket context failed schema validation.",
      details: parseResult.error.issues
    });
  }

  try {
    const report = analyzeSlaAndEscalation(parseResult.data);
    return res.status(200).json(report);
  } catch (err: any) {
    return res.status(500).json({
      error: "escalation_analysis_failed",
      message: err.message || "Failed to analyze SLA and escalation indicators."
    });
  }
});
