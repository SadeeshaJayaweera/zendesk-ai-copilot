import { describe, it, expect } from "vitest";
import {
  getAgentPreferences,
  upsertAgentPreferences,
  getAgentTelemetry
} from "../src/db/agentProfileRepo.js";
import { agentsRouter } from "../src/routes/agents.js";

describe("Phase 9: Agent Personalization & Telemetry Engine", () => {
  const orgAlpha = "tenant-alpha";
  const orgBeta = "tenant-beta";
  const agentId = 77;

  describe("Agent Preferences Repository", () => {
    it("returns default balanced preferences when none exist", async () => {
      const prefs = await getAgentPreferences("new-tenant", 999);

      expect(prefs.organizationId).toBe("new-tenant");
      expect(prefs.agentId).toBe(999);
      expect(prefs.formality).toBe(0.5);
      expect(prefs.warmth).toBe(0.5);
      expect(prefs.conciseness).toBe(0.5);
      expect(prefs.empathy).toBe(0.5);
      expect(prefs.preferredGreeting).toBeNull();
      expect(prefs.preferredClosing).toBeNull();
    });

    it("upserts and retrieves agent specific preferences", async () => {
      await upsertAgentPreferences({
        organizationId: orgAlpha,
        agentId,
        formality: 0.85,
        warmth: 0.4,
        conciseness: 0.9,
        empathy: 0.3,
        preferredGreeting: "Greetings,",
        preferredClosing: "Sincerely,\nSenior Support Engineer",
        toneBias: "technical_direct"
      });

      const retrieved = await getAgentPreferences(orgAlpha, agentId);
      expect(retrieved.formality).toBe(0.85);
      expect(retrieved.warmth).toBe(0.4);
      expect(retrieved.conciseness).toBe(0.9);
      expect(retrieved.preferredGreeting).toBe("Greetings,");
      expect(retrieved.preferredClosing).toBe("Sincerely,\nSenior Support Engineer");
      expect(retrieved.toneBias).toBe("technical_direct");
    });

    it("enforces tenant isolation: Agent 77 in Org Beta does not see Org Alpha preferences", async () => {
      const betaPrefs = await getAgentPreferences(orgBeta, agentId);
      // Beta should have default 0.5, not Alpha's 0.85
      expect(betaPrefs.formality).toBe(0.5);
      expect(betaPrefs.preferredGreeting).toBeNull();
    });
  });

  describe("Agent Telemetry & Adaptive Learning", () => {
    it("calculates telemetry metrics and non-invasive adaptive style adjustment", async () => {
      const telemetry = await getAgentTelemetry(orgAlpha, agentId);

      expect(telemetry.agentId).toBe(agentId);
      expect(telemetry.organizationId).toBe(orgAlpha);
      expect(typeof telemetry.acceptanceRate).toBe("number");
      expect(typeof telemetry.editRate).toBe("number");
      expect(typeof telemetry.rejectionRate).toBe("number");
      expect(Array.isArray(telemetry.topActions)).toBe(true);
      expect(typeof telemetry.recommendedStyleAdjustment).toBe("string");
    });
  });

  describe("Agents Express Router Endpoints", () => {
    it("validates and retrieves preferences on GET /:id/preferences", async () => {
      const layer = (agentsRouter.stack as any[]).find(
        (l) => l.route?.path === "/:id/preferences" && l.route?.methods?.get
      );
      expect(layer).toBeDefined();

      let statusCode = 0;
      let jsonPayload: any = null;

      const req: any = {
        params: { id: "77" },
        organizationId: orgAlpha
      };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (p: any) => { jsonPayload = p; } };
        }
      };

      await layer.route.stack[0].handle(req, res);
      expect(statusCode).toBe(200);
      expect(jsonPayload.preferences.agentId).toBe(77);
      expect(jsonPayload.preferences.formality).toBe(0.85);
    });

    it("rejects invalid preference values on PUT /:id/preferences with 400", async () => {
      const layer = (agentsRouter.stack as any[]).find(
        (l) => l.route?.path === "/:id/preferences" && l.route?.methods?.put
      );

      let statusCode = 0;
      let jsonPayload: any = null;

      const req: any = {
        params: { id: "77" },
        organizationId: orgAlpha,
        body: { formality: 2.5 } // Invalid: must be <= 1.0
      };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (p: any) => { jsonPayload = p; } };
        }
      };

      await layer.route.stack[0].handle(req, res);
      expect(statusCode).toBe(400);
      expect(jsonPayload.error).toBe("invalid_payload");
    });

    it("successfully updates preferences on PUT /:id/preferences", async () => {
      const layer = (agentsRouter.stack as any[]).find(
        (l) => l.route?.path === "/:id/preferences" && l.route?.methods?.put
      );

      let statusCode = 0;
      let jsonPayload: any = null;

      const req: any = {
        params: { id: "88" },
        organizationId: orgAlpha,
        body: {
          formality: 0.3,
          warmth: 0.9,
          conciseness: 0.4,
          empathy: 0.8,
          preferredGreeting: "Hey there!",
          preferredClosing: "Cheers,\nAlex"
        }
      };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (p: any) => { jsonPayload = p; } };
        }
      };

      await layer.route.stack[0].handle(req, res);
      expect(statusCode).toBe(200);
      expect(jsonPayload.status).toBe("updated");
      expect(jsonPayload.preferences.preferredGreeting).toBe("Hey there!");
    });

    it("returns telemetry summary on GET /:id/telemetry", async () => {
      const layer = (agentsRouter.stack as any[]).find(
        (l) => l.route?.path === "/:id/telemetry" && l.route?.methods?.get
      );

      let statusCode = 0;
      let jsonPayload: any = null;

      const req: any = {
        params: { id: "88" },
        organizationId: orgAlpha
      };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return { json: (p: any) => { jsonPayload = p; } };
        }
      };

      await layer.route.stack[0].handle(req, res);
      expect(statusCode).toBe(200);
      expect(jsonPayload.telemetry.agentId).toBe(88);
      expect(jsonPayload.telemetry.organizationId).toBe(orgAlpha);
    });
  });
});
