import crypto from "node:crypto";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AuthenticatedUser {
  userId: number;
  organizationId: string;
  role: "agent" | "admin" | "auditor";
  subdomain?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      organizationId?: string;
    }
  }
}

/**
 * Constant-time comparison between two strings to prevent timing attacks.
 */
function secureCompare(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") {
    return false;
  }
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Authenticates Zendesk Apps Framework client requests.
 * Validates JWT signature, algorithms, expiration, and extracts tenant organization.
 */
export function verifyZendeskJwt(req: Request, res: Response, next: NextFunction) {
  // Test bypass mode strictly for test environment when header is provided
  if (env.NODE_ENV === "test") {
    const testOrg = req.headers["x-test-org-id"] as string | undefined;
    if (testOrg) {
      req.organizationId = testOrg;
      req.user = {
        userId: Number(req.headers["x-test-user-id"] || 1),
        organizationId: testOrg,
        role: "agent"
      };
      return next();
    }
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "unauthorized",
      message: "Missing or malformed Authorization header. Expected 'Bearer <token>'."
    });
  }

  const token = authHeader.substring(7).trim();
  const secret = env.JWT_SECRET || env.ZENDESK_CLIENT_SECRET;

  try {
    const decoded = jwt.verify(token, secret, {
      algorithms: ["HS256"]
    }) as any;

    const orgId = decoded.subdomain || decoded.organization_id || decoded.org_id || "default";
    const userId = Number(decoded.user_id || decoded.sub || 1);
    const role = decoded.role === "admin" ? "admin" : "agent";

    req.organizationId = orgId;
    req.user = {
      userId,
      organizationId: orgId,
      role,
      subdomain: decoded.subdomain
    };

    next();
  } catch (err: any) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({ error: "token_expired", message: "Authentication token has expired." });
    }
    return res.status(401).json({ error: "invalid_token", message: "Invalid authentication token signature or claims." });
  }
}

/**
 * Authenticates Administrative operations using a dedicated ADMIN_API_KEY
 * or verified admin-role JWT with timing attack prevention.
 */
export function authenticateAdmin(req: Request, res: Response, next: NextFunction) {
  const adminKeyHeader = req.headers["x-admin-key"] as string | undefined;
  const legacySecretHeader = req.headers["x-admin-secret"] as string | undefined;

  // 1. Check dedicated ADMIN_API_KEY with constant-time comparison
  if (adminKeyHeader && env.ADMIN_API_KEY && secureCompare(adminKeyHeader, env.ADMIN_API_KEY)) {
    req.organizationId = (req.headers["x-organization-id"] as string) || "default";
    req.user = {
      userId: 0,
      organizationId: req.organizationId,
      role: "admin"
    };
    return next();
  }

  // 2. Backward compatibility for legacy tests
  if (legacySecretHeader && secureCompare(legacySecretHeader, env.ZENDESK_CLIENT_SECRET)) {
    req.organizationId = (req.headers["x-organization-id"] as string) || "default";
    req.user = {
      userId: 0,
      organizationId: req.organizationId,
      role: "admin"
    };
    return next();
  }

  // 3. Check Bearer token with admin role
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7).trim();
    const secret = env.JWT_SECRET || env.ZENDESK_CLIENT_SECRET;
    try {
      const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] }) as any;
      if (decoded.role === "admin" || decoded.role === "auditor") {
        if (decoded.role === "auditor" && req.method !== "GET") {
          return res.status(403).json({ error: "forbidden", message: "Auditor role is read-only." });
        }
        req.organizationId = decoded.subdomain || decoded.organization_id || "default";
        req.user = {
          userId: Number(decoded.user_id || decoded.sub || 0),
          organizationId: req.organizationId || "default",
          role: decoded.role
        };
        return next();
      }
      return res.status(403).json({ error: "forbidden", message: "Admin role required." });
    } catch {
      return res.status(401).json({ error: "unauthorized", message: "Invalid administrative token." });
    }
  }

  return res.status(401).json({ error: "unauthorized", message: "Missing required admin credentials." });
}

/**
 * Helper to generate JWT tokens for testing.
 */
export function generateTestJwt(
  payload: Record<string, unknown>,
  secret = env.JWT_SECRET || env.ZENDESK_CLIENT_SECRET,
  expiresIn = "1h"
): string {
  return jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: expiresIn as any });
}
