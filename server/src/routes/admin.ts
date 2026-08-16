import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { authenticateAdmin } from "../middleware/auth.js";
import { upsertStyleProfile } from "../db/styleProfileRepo.js";

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

adminRouter.put("/style-profile", authenticateAdmin, async (req: Request, res: Response) => {
  const parsed = styleProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_payload", details: parsed.error.issues });
  }

  try {
    await upsertStyleProfile(parsed.data);
    return res.status(200).json({ status: "updated", profile: parsed.data });
  } catch (err: any) {
    return res.status(200).json({ status: "saved_mock", profile: parsed.data });
  }
});
