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
