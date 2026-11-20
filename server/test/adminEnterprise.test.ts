import { describe, it, expect, vi } from "vitest";
import { getOrganization, upsertOrganization, cleanupRetentionData } from "../src/db/orgRepo.js";
import { adminRouter } from "../src/routes/admin.js";
import { generateTestJwt, authenticateAdmin } from "../src/middleware/auth.js";

describe("Phase 10: Administration, Multi-Tenancy & Enterprise Readiness", () => {
  const orgId = "enterprise-corp";

  describe("Organization Repository", () => {
    it("retrieves the default organization if present", async () => {
      const defaultOrg = await getOrganization("default");
      expect(defaultOrg).toBeDefined();
      expect(defaultOrg?.name).toBe("Default Organization");
    });

    it("upserts and retrieves tenant organization configuration", async () => {
      await upsertOrganization({
        id: orgId,
        name: "Enterprise Corp",
        subdomain: "enterprise-corp",
        settings: {
          retentionDays: 60,
          aiFeaturesEnabled: true,
          requireHumanReview: true,
          allowedDomains: ["enterprisecorp.com"]
        }
      });

      const org = await getOrganization(orgId);
      expect(org).toBeDefined();
      expect(org?.id).toBe(orgId);
      expect(org?.settings.retentionDays).toBe(60);
      expect(org?.settings.requireHumanReview).toBe(true);
    });

    it("triggers data retention cleanup", async () => {
      const result = await cleanupRetentionData(orgId, 60);
      expect(typeof result.deletedCacheRows).toBe("number");
      expect(typeof result.deletedFeedbackRows).toBe("number");
    });
  });

  describe("Role-Based Access Control (Admin vs Auditor vs Agent)", () => {
    it("allows full access for users with admin role", () => {
      const adminToken = generateTestJwt({ subdomain: orgId, user_id: 1, role: "admin" });
      const req: any = {
        method: "PUT",
        headers: { authorization: `Bearer ${adminToken}` }
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      authenticateAdmin(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user.role).toBe("admin");
    });

    it("allows read-only access (GET) for users with auditor role", () => {
      const auditorToken = generateTestJwt({ subdomain: orgId, user_id: 2, role: "auditor" });
      const req: any = {
        method: "GET",
        headers: { authorization: `Bearer ${auditorToken}` }
      };
      const res: any = { status: vi.fn().mockReturnThis(), json: vi.fn() };
      const next = vi.fn();

      authenticateAdmin(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(req.user.role).toBe("auditor");
    });

    it("rejects write access (PUT/POST/DELETE) for users with auditor role with 403", () => {
      const auditorToken = generateTestJwt({ subdomain: orgId, user_id: 2, role: "auditor" });
      const req: any = {
        method: "PUT",
        headers: { authorization: `Bearer ${auditorToken}` }
      };
      let statusCode = 0;
      let jsonPayload: any = null;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (p: any) => { jsonPayload = p; } };
        }
      };
      const next = vi.fn();

      authenticateAdmin(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(statusCode).toBe(403);
      expect(jsonPayload.error).toBe("forbidden");
      expect(jsonPayload.message).toContain("read-only");
    });

    it("rejects access for standard support agents with 403", () => {
      const agentToken = generateTestJwt({ subdomain: orgId, user_id: 3, role: "agent" });
      const req: any = {
        method: "GET",
        headers: { authorization: `Bearer ${agentToken}` }
      };
      let statusCode = 0;
      let jsonPayload: any = null;
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (p: any) => { jsonPayload = p; } };
        }
      };
      const next = vi.fn();

      authenticateAdmin(req, res, next);
      expect(next).not.toHaveBeenCalled();
      expect(statusCode).toBe(403);
      expect(jsonPayload.error).toBe("forbidden");
      expect(jsonPayload.message).toContain("Admin role required");
    });
  });

  describe("Admin Endpoints", () => {
    it("handles GET /organization", async () => {
      const layer = (adminRouter.stack as any[]).find(
        (l) => l.route?.path === "/organization" && l.route?.methods?.get
      );
      expect(layer).toBeDefined();

      let statusCode = 0;
      let jsonPayload: any = null;

      const req: any = { organizationId: orgId };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (p: any) => { jsonPayload = p; } };
        }
      };

      await layer.route.stack[1].handle(req, res);
      expect(statusCode).toBe(200);
      expect(jsonPayload.organization.name).toBe("Enterprise Corp");
    });

    it("handles PUT /organization with validation", async () => {
      const layer = (adminRouter.stack as any[]).find(
        (l) => l.route?.path === "/organization" && l.route?.methods?.put
      );

      let statusCode = 0;
      let jsonPayload: any = null;

      const req: any = {
        organizationId: orgId,
        body: {
          name: "Updated Corp",
          subdomain: "updated-corp",
          settings: { retentionDays: 45, aiFeaturesEnabled: true, requireHumanReview: true }
        }
      };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (p: any) => { jsonPayload = p; } };
        }
      };

      await layer.route.stack[1].handle(req, res);
      expect(statusCode).toBe(200);
      expect(jsonPayload.status).toBe("updated");
      expect(jsonPayload.organization.name).toBe("Updated Corp");
      expect(jsonPayload.organization.settings.retentionDays).toBe(45);
    });

    it("handles GET /provider-settings to inspect AI provider capabilities and health", async () => {
      const layer = (adminRouter.stack as any[]).find(
        (l) => l.route?.path === "/provider-settings" && l.route?.methods?.get
      );

      let statusCode = 0;
      let jsonPayload: any = null;

      const req: any = { organizationId: orgId };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (p: any) => { jsonPayload = p; } };
        }
      };

      await layer.route.stack[1].handle(req, res);
      expect(statusCode).toBe(200);
      expect(jsonPayload.healthStatus).toBe("healthy");
      expect(jsonPayload.capabilities).toBeDefined();
      expect(jsonPayload.capabilities.structuredOutput).toBe(true);
    });

    it("handles POST /cleanup to enforce data retention policy", async () => {
      const layer = (adminRouter.stack as any[]).find(
        (l) => l.route?.path === "/cleanup" && l.route?.methods?.post
      );

      let statusCode = 0;
      let jsonPayload: any = null;

      const req: any = {
        organizationId: orgId,
        body: { retentionDays: 30 }
      };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (p: any) => { jsonPayload = p; } };
        }
      };

      await layer.route.stack[1].handle(req, res);
      expect(statusCode).toBe(200);
      expect(jsonPayload.status).toBe("completed");
      expect(jsonPayload.retentionDays).toBe(30);
      expect(typeof jsonPayload.deletedCacheRows).toBe("number");
    });
  });
});
