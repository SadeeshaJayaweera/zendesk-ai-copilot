import { rewriteActionSchema } from "../types/ai.js";
import { rewriteDraft } from "../services/ai/rewrite.js";
import { generateReply } from "../services/ai/generateReply.js";
import { z } from "zod";
import { analyzeDraft } from "../services/ai/analyzeDraft.js";
import { Router, type Request, type Response } from "express";
import { ticketContextSchema } from "../types/ticketContext.js";
import { conversationHash } from "../services/zendesk/conversationHelpers.js";
import { analyzeConversation } from "../services/ai/analyzeConversation.js";
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
  const hash = conversationHash(context);
  const analysis = await analyzeConversation(context);
  return res.status(200).json({ context, analysis, cached: false });
});

const draftAnalysisRequestSchema = z.object({
  ticketContext: ticketContextSchema,
  agentDraft: z.string().min(1, "agentDraft cannot be empty")
});

ticketsRouter.post("/:id/draft-analysis", async (req: Request, res: Response) => {
  const parseResult = draftAnalysisRequestSchema.safeParse(req.body);
  if (!parseResult.success) {
    return res.status(400).json({ error: "invalid_payload", details: parseResult.error.issues });
  }
  const result = await analyzeDraft(parseResult.data.ticketContext, parseResult.data.agentDraft);
  return res.status(200).json(result);
});

const generateReplyRequestSchema = z.object({
  ticketContext: ticketContextSchema,
  toneOverride: z.string().optional(),
  agentDraft: z.string().optional()
});

ticketsRouter.post("/:id/generate-reply", async (req: Request, res: Response) => {
  const parseResult = generateReplyRequestSchema.safeParse(req.body);
  if (!parseResult.success) return res.status(400).json({ error: "invalid_payload" });
  const { ticketContext, toneOverride, agentDraft } = parseResult.data;
  const analysis = await analyzeConversation(ticketContext);
  const result = await generateReply(ticketContext, analysis, toneOverride, agentDraft);
  return res.status(200).json(result);
});

const rewriteRequestSchema = z.object({
  ticketContext: ticketContextSchema.optional(),
  agentDraft: z.string().min(1, "agentDraft cannot be empty"),
  action: rewriteActionSchema
});

ticketsRouter.post("/:id/rewrite", async (req: Request, res: Response) => {
  const parseResult = rewriteRequestSchema.safeParse(req.body);
  if (!parseResult.success) return res.status(400).json({ error: "invalid_payload" });
  const { agentDraft, action, ticketContext } = parseResult.data;
  const result = await rewriteDraft(agentDraft, action, ticketContext);
  return res.status(200).json(result);
});
