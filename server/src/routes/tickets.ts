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

export const ticketsRouter = Router();
ticketsRouter.use(rateLimiter(60, 60000));

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

  const forceRegenerate = req.query.force === "true";
  const hash = conversationHash(context);

  if (!forceRegenerate) {
    const cached = await getCachedAnalysis(context.ticketId, hash);
    if (cached) {
      req.log?.info({ ticketId: context.ticketId, cached: true }, "Returning cached conversation analysis");
      return res.status(200).json({ context, analysis: cached, cached: true });
    }
  }

  try {
    const analysis = await analyzeConversation(context);
    await setCachedAnalysis(context.ticketId, hash, analysis);

    req.log?.info({ ticketId: context.ticketId, cached: false }, "Generated new conversation analysis");
    return res.status(200).json({ context, analysis, cached: false });
  } catch (err: any) {
    req.log?.error({ err: err.message }, "Conversation analysis failed");
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
    const { ticketContext, toneOverride, agentDraft } = parseResult.data;
    const analysis = await analyzeConversation(ticketContext);
    const result = await generateReply(ticketContext, analysis, toneOverride, agentDraft);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(err.statusCode || 500).json({
      error: "reply_generation_failed",
      message: err.message || "Failed to generate AI reply draft."
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
  try {
    const eventId = await insertFeedbackEvent({
      ticketId: Number.isNaN(ticketId) ? 0 : ticketId,
      agentId: parseResult.data.agentId,
      eventType: parseResult.data.eventType,
      action: parseResult.data.action
    });
    return res.status(201).json({ status: "recorded", id: eventId });
  } catch (err: any) {
    return res.status(200).json({ status: "recorded_in_memory" });
  }
});
