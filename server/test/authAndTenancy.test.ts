import { describe, it, expect, vi } from "vitest";
import jwt from "jsonwebtoken";
import { verifyZendeskJwt, authenticateAdmin, generateTestJwt } from "../src/middleware/auth.js";
import { env } from "../src/config/env.js";
import { getCachedAnalysis, setCachedAnalysis } from "../src/db/cacheRepo.js";
import { pool } from "../src/db/pool.js";

describe("Phase 2: Authentication Middleware", () => {
  const secret = env.JWT_SECRET || env.ZENDESK_CLIENT_SECRET;

  it("permits request with valid Zendesk JWT and extracts organizationId", () => {
    const token = generateTestJwt({
      subdomain: "acme-corp",
      user_id: 42,
      role: "agent"
    });

    const req: any = {
      headers: { authorization: `Bearer ${token}` }
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    verifyZendeskJwt(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.organizationId).toBe("acme-corp");
    expect(req.user?.userId).toBe(42);
    expect(req.user?.role).toBe("agent");
  });

  it("rejects request with expired JWT token", () => {
    const expiredToken = jwt.sign(
      { subdomain: "acme-corp", user_id: 42 },
      secret,
      { algorithm: "HS256", expiresIn: "-10s" }
    );

    const req: any = {
      headers: { authorization: `Bearer ${expiredToken}` }
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    verifyZendeskJwt(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "token_expired" })
    );
  });

  it("rejects request with forged / invalid signature JWT", () => {
    const forgedToken = jwt.sign(
      { subdomain: "hacker-corp", user_id: 999 },
      "wrong-secret-key-12345678901234567890",
      { algorithm: "HS256", expiresIn: "1h" }
    );

    const req: any = {
      headers: { authorization: `Bearer ${forgedToken}` }
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    verifyZendeskJwt(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "invalid_token" })
    );
  });

  it("rejects request missing Authorization header", () => {
    const req: any = { headers: {} };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    verifyZendeskJwt(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "unauthorized" })
    );
  });
});

describe("Phase 2: Admin Authentication", () => {
  it("permits request with valid x-admin-key", () => {
    const req: any = {
      headers: { "x-admin-key": env.ADMIN_API_KEY }
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    authenticateAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user?.role).toBe("admin");
  });

  it("rejects request with invalid x-admin-key", () => {
    const req: any = {
      headers: { "x-admin-key": "invalid-admin-key" }
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    authenticateAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("permits admin token with role admin", () => {
    const adminToken = generateTestJwt({
      subdomain: "corp",
      user_id: 1,
      role: "admin"
    });

    const req: any = {
      headers: { authorization: `Bearer ${adminToken}` }
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    authenticateAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user?.role).toBe("admin");
  });

  it("rejects agent token attempting to access admin route with 403", () => {
    const agentToken = generateTestJwt({
      subdomain: "corp",
      user_id: 1,
      role: "agent"
    });

    const req: any = {
      headers: { authorization: `Bearer ${agentToken}` }
    };
    const res: any = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn()
    };
    const next = vi.fn();

    authenticateAdmin(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: "forbidden" })
    );
  });
});

describe("Phase 2: Multi-Tenant Cache Isolation", () => {
  it("isolates cache queries by organizationId", async () => {
    const mockQuery = vi.spyOn(pool, "query").mockImplementation(async (sql: any, params: any) => {
      if (typeof sql === "string" && sql.includes("SELECT analysis_json")) {
        const [orgId, ticketId] = params;
        if (orgId === "org-alpha" && ticketId === 101) {
          return { rows: [{ analysis_json: { customer_sentiment: "positive" } }] } as any;
        }
        return { rows: [] } as any;
      }
      return { rows: [] } as any;
    });

    const resAlpha = await getCachedAnalysis("org-alpha", 101, "hash-123");
    const resBeta = await getCachedAnalysis("org-beta", 101, "hash-123");

    expect(resAlpha).not.toBeNull();
    expect(resAlpha?.customer_sentiment).toBe("positive");
    expect(resBeta).toBeNull();

    mockQuery.mockRestore();
  });
});
