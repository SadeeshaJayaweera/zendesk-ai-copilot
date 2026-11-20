import type { Request, Response, NextFunction } from "express";

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

// Bounded in-memory store with LRU eviction and expiration cleanup to prevent memory leaks
const MAX_BUCKETS = 10000;
const store = new Map<string, RateLimitBucket>();

// Prune expired buckets periodically
const CLEANUP_INTERVAL_MS = 60000;
let lastCleanup = Date.now();

function cleanupExpired(now: number) {
  for (const [key, bucket] of store.entries()) {
    if (now > bucket.resetAt) {
      store.delete(key);
    }
  }
  lastCleanup = now;
}

export function rateLimiter(maxRequests = 60, windowMs = 60000) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();

    // Trigger cleanup periodically
    if (now - lastCleanup > CLEANUP_INTERVAL_MS) {
      cleanupExpired(now);
    }

    // Resolve tenant / client identifier
    const clientIp = req.ip || req.socket.remoteAddress || "127.0.0.1";
    const orgId = (req as any).organizationId || req.headers["x-organization-id"] || "anon";
    const pathTarget = req.baseUrl + (req.path !== "/" ? req.path : "");
    const key = `${clientIp}:${orgId}:${pathTarget}`;

    // Evict oldest if reaching capacity
    if (store.size >= MAX_BUCKETS && !store.has(key)) {
      const oldestKey = store.keys().next().value;
      if (oldestKey) {
        store.delete(oldestKey);
      }
    }

    let bucket = store.get(key);
    if (!bucket || now > bucket.resetAt) {
      bucket = { count: 1, resetAt: now + windowMs };
      store.set(key, bucket);
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", maxRequests - 1);
      res.setHeader("X-RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));
      return next();
    }

    if (bucket.count >= maxRequests) {
      res.setHeader("X-RateLimit-Limit", maxRequests);
      res.setHeader("X-RateLimit-Remaining", 0);
      res.setHeader("X-RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));
      res.setHeader("Retry-After", Math.ceil((bucket.resetAt - now) / 1000));
      return res.status(429).json({
        error: "rate_limit_exceeded",
        message: "Too many requests. Please wait a moment before retrying."
      });
    }

    bucket.count++;
    res.setHeader("X-RateLimit-Limit", maxRequests);
    res.setHeader("X-RateLimit-Remaining", Math.max(0, maxRequests - bucket.count));
    res.setHeader("X-RateLimit-Reset", Math.ceil(bucket.resetAt / 1000));
    next();
  };
}

export function resetRateLimiterStore(): void {
  store.clear();
}
