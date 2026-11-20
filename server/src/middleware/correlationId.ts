import { type Request, type Response, type NextFunction } from "express";
import crypto from "node:crypto";
import { logger } from "../config/logger.js";

declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const existingId = (req.headers["x-correlation-id"] || req.headers["x-request-id"]) as string | undefined;
  const correlationId = existingId && /^[a-zA-Z0-9_-]{8,64}$/.test(existingId)
    ? existingId
    : crypto.randomUUID();

  req.correlationId = correlationId;
  res.setHeader("X-Correlation-ID", correlationId);

  if (req.log) {
    req.log = req.log.child({ correlationId });
  } else {
    req.log = logger.child({ correlationId });
  }

  next();
}
