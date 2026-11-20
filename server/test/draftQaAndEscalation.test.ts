import { describe, it, expect } from "vitest";
import { analyzeDraft } from "../src/services/ai/analyzeDraft.js";
import { analyzeSlaAndEscalation } from "../src/services/escalation/escalationAnalyzer.js";
import type { TicketContext } from "../src/types/ticketContext.js";
import { ticketsRouter } from "../src/routes/tickets.js";

describe("Phase 8: Draft Quality Evaluation & Escalation Intelligence", () => {
  const baseContext: TicketContext = {
    ticketId: 1042,
    subject: "Production API 500 Outage",
    description: "Customer reporting intermittent 500 errors on payments endpoint.",
    status: "open",
    priority: "high",
    tags: ["api", "production", "payments"],
    customFields: [],
    messages: [
      {
        id: 1,
        authorRole: "customer",
        body: "Our checkout page is down due to 500 errors on your payment gateway. This is completely unacceptable and ridiculous! Escalate this to your manager immediately or we will cancel our account.",
        createdAt: new Date(Date.now() - 150 * 60 * 1000).toISOString(), // 150 minutes ago
        isPublic: true
      },
      {
        id: 2,
        authorRole: "agent",
        body: "Confidential investigation: DB node eu-central-1-db-4 is undergoing failover. Do not share server hostname with customer.",
        createdAt: new Date(Date.now() - 140 * 60 * 1000).toISOString(),
        isPublic: false
      }
    ]
  };

  describe("Draft Quality Assurance (analyzeDraft)", () => {
    it("evaluates a standard helpful draft and returns a structured quality report", async () => {
      const draft = "Hello, thank you for contacting us. We are currently actively investigating the 500 errors on our payment gateway with top priority. I will keep you updated within the next 30 minutes.";
      const result = await analyzeDraft(baseContext, draft);

      expect(result).toBeDefined();
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.scores.professionalism).toBeGreaterThan(0);
      expect(result.scores.clarity).toBeGreaterThan(0);
      expect(Array.isArray(result.strengths)).toBe(true);
      expect(Array.isArray(result.recommended_changes)).toBe(true);
    });

    it("caps score at 45 and flags critical policy violation when draft contains unauthorized refund commitment", async () => {
      const draft = "I am very sorry for the trouble. I have authorized a 100% refund and credit of $500 for your monthly subscription fee.";
      const result = await analyzeDraft(baseContext, draft);

      expect(result.score).toBeLessThanOrEqual(45);
      expect(result.scores.policy_compliance).toBeLessThanOrEqual(30);
      expect(result.issues.some((issue) => issue.severity === "critical" && issue.type === "unsupported_promise")).toBe(true);
      expect(result.recommended_changes.some((rec) => rec.includes("CRITICAL: Remove unauthorized commitments"))).toBe(true);
    });

    it("caps score at 45 and flags critical security risk if draft leaks internal private notes", async () => {
      const draft = "We are fixing this right now. Our DB node eu-central-1-db-4 is undergoing failover.";
      const result = await analyzeDraft(baseContext, draft);

      expect(result.score).toBeLessThanOrEqual(45);
      expect(result.issues.some((issue) => issue.severity === "critical" && issue.type === "security_risk")).toBe(true);
    });

    it("throws an error when agent draft is empty or only whitespace", async () => {
      await expect(analyzeDraft(baseContext, "   ")).rejects.toThrow("agentDraft cannot be empty");
    });
  });

  describe("SLA & Escalation Analyzer (analyzeSlaAndEscalation)", () => {
    it("flags high priority ticket with 150min wait time as breached and requiring immediate attention", () => {
      const report = analyzeSlaAndEscalation(baseContext, {
        highFirstReplyMinutes: 60 // SLA is 60 min, customer waited 150 min
      });

      expect(report.ticketId).toBe(1042);
      expect(report.priority).toBe("high");
      expect(report.slaStatus).toBe("breached");
      expect(report.customerWaitTimeMinutes).toBeGreaterThanOrEqual(140);
      expect(report.recommendations.requires_immediate_attention).toBe(true);
      expect(report.recommendations.possible_sla_breach).toBe(true);
    });

    it("detects customer frustration keywords and scores frustration", () => {
      const report = analyzeSlaAndEscalation(baseContext);

      expect(report.frustrationDetected).toBe(true);
      expect(report.frustrationScore).toBeGreaterThanOrEqual(0.5);
      expect(report.recommendations.requires_immediate_attention).toBe(true);
      expect(report.recommendations.recommended_action).toContain("IMMEDIATE ACTION REQUIRED");
    });

    it("correctly marks waiting_for_customer when the latest public reply is from an agent", () => {
      const contextWithAgentReply: TicketContext = {
        ...baseContext,
        messages: [
          ...baseContext.messages,
          {
            id: 3,
            authorRole: "agent",
            body: "We have deployed a hotfix. Could you please test the checkout flow and let us know if it works on your end?",
            createdAt: new Date().toISOString(),
            isPublic: true
          }
        ]
      };

      const report = analyzeSlaAndEscalation(contextWithAgentReply);
      expect(report.recommendations.waiting_for_customer).toBe(true);
      expect(report.slaStatus).toBe("ok");
      expect(report.customerWaitTimeMinutes).toBe(0);
      expect(report.recommendations.recommended_action).toContain("Pending customer response");
    });
  });

  describe("Tickets Router Escalation Analysis Endpoint", () => {
    it("validates request schema on POST /:id/escalation-analysis", async () => {
      const layer = (ticketsRouter.stack as any[]).find(
        (l) => l.route?.path === "/:id/escalation-analysis" && l.route?.methods?.post
      );
      expect(layer).toBeDefined();

      let statusCode = 0;
      let jsonPayload: any = null;

      const req: any = {
        params: { id: "1042" },
        body: { invalid: "payload" }
      };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (payload: any) => {
              jsonPayload = payload;
            }
          };
        }
      };

      await layer.route.stack[0].handle(req, res);
      expect(statusCode).toBe(400);
      expect(jsonPayload.error).toBe("invalid_payload");
    });

    it("returns 200 with complete EscalationReport for valid payload", async () => {
      const layer = (ticketsRouter.stack as any[]).find(
        (l) => l.route?.path === "/:id/escalation-analysis" && l.route?.methods?.post
      );

      let statusCode = 0;
      let jsonPayload: any = null;

      const req: any = {
        params: { id: "1042" },
        body: baseContext
      };
      const res: any = {
        status: (code: number) => {
          statusCode = code;
          return {
            json: (payload: any) => {
              jsonPayload = payload;
            }
          };
        }
      };

      await layer.route.stack[0].handle(req, res);
      expect(statusCode).toBe(200);
      expect(jsonPayload.ticketId).toBe(1042);
      expect(jsonPayload.slaStatus).toBe("breached");
      expect(jsonPayload.frustrationDetected).toBe(true);
    });
  });
});
