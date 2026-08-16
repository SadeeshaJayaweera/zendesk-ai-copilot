import type { Request, Response, NextFunction } from "express";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitBucket>();

export function rateLimiter(maxRequests = 60, windowMs = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const key = (req.ip || "127.0.0.1") + ":" + (req.params.id || "global");
    const now = Date.now();

    let bucket = store.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 1, resetAt: now + windowMs };
      store.set(key, bucket);
      return next();
    }

    if (bucket.count >= maxRequests) {
      return res.status(429).json({
        error: "rate_limit_exceeded",
        message: "Too many requests. Please wait a moment before retrying."
      });
    }

    bucket.count++;
    next();
  };
}
