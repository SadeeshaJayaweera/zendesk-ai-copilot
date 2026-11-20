import { describe, it, expect } from "vitest";
import { detectHallucinations } from "../src/services/ai/hallucinationGuard.js";
import { buildGenerateReplyPrompts } from "../src/services/ai/prompts/generateReply.prompt.js";
import type { TicketContext } from "../src/types/ticketContext.js";
import type { ConversationAnalysis } from "../src/types/ai.js";

describe("Phase 5: Anti-Hallucination & AI Safety Engine", () => {
  const baseContext: TicketContext = {
    ticketId: 888,
    subject: "Service Outage Compensation",
    description: "Customer inquiring about downtime and credits.",
    status: "open",
    priority: "high",
    tags: ["billing", "outage"],
    customFields: [],
    messages: [
      {
        id: 1,
        authorRole: "customer",
        body: "Can I get a refund or credit for yesterday's downtime? I demand a 50% discount.",
        createdAt: "2026-11-20T10:00:00Z",
        isPublic: true
      },
      {
        id: 2,
        authorRole: "agent",
        body: "Internal secret: customer DB replica is node-eu-west-cluster-9876. Do not disclose.",
        createdAt: "2026-11-20T10:05:00Z",
        isPublic: false
      }
    ]
  };

  const sampleAnalysis: ConversationAnalysis = {
    customer_sentiment: "frustrated",
    customer_intent: "billing",
    urgency: "high",
    conversation_tone: "demanding compensation",
    recommended_tone: "empathetic_professional",
    response_length: "medium",
    needs_apology: true,
    needs_clarification: false,
    confidence: 0.95,
    business_impact: "high",
    technical_complexity: "low",
    frustration_level: "moderate",
    repeated_contact_indicators: false,
    unanswered_questions: [],
    missing_information: [],
    escalation_recommended: false,
    escalation_reason: null,
    observed_facts: [],
    hypotheses: [],
    customer_commitments: []
  };

  it("CRITICAL FIX: Flags unauthorized refund promise EVEN IF customer asked about refund in source text", () => {
    // In previous flawed implementation, because 'refund' was in customer message,
    // matchInSource was true and the warning was suppressed!
    const reply = "I apologize for the downtime. I have processed a full refund of $100 for your account.";
    const guard = detectHallucinations(reply, baseContext);

    expect(guard.hasWarning).toBe(true);
    expect(guard.blocked).toBe(true);
    expect(guard.warnings.some((w) => w.includes("financial refund or credit") || w.includes("Unauthorized commitment"))).toBe(true);
  });

  it("Flags unauthorized percentage discount promises", () => {
    const reply = "We appreciate your patience and have applied a 50% discount to your upcoming bill.";
    const guard = detectHallucinations(reply, baseContext);

    expect(guard.hasWarning).toBe(true);
    expect(guard.warnings.some((w) => w.includes("percentage discount"))).toBe(true);
  });

  it("Detects private note data leakage into customer reply", () => {
    const leakingReply = "We investigated and noticed node-eu-west-cluster-9876 experienced packet loss.";
    const guard = detectHallucinations(leakingReply, baseContext);

    expect(guard.hasWarning).toBe(true);
    expect(guard.criticalViolations.some((v) => v.includes("Private data leakage detected"))).toBe(true);
  });

  it("Detects unverified operational resolution claims", () => {
    const unverifiedReply = "I have reconfigured your routing table and restored connectivity.";
    const guard = detectHallucinations(unverifiedReply, baseContext);

    expect(guard.hasWarning).toBe(true);
    expect(guard.warnings.some((w) => w.includes("Unverified action"))).toBe(true);
  });

  it("Permits safe, compliant support reply without false-positive warnings", () => {
    const safeReply = "Thank you for reaching out. I understand the downtime caused disruption. I have forwarded your request regarding service credits to our billing team for review.";
    const guard = detectHallucinations(safeReply, baseContext);

    expect(guard.hasWarning).toBe(false);
    expect(guard.blocked).toBe(false);
  });

  it("Guarantees private internal notes are excluded from reply generation prompt", () => {
    const { userPrompt } = buildGenerateReplyPrompts(baseContext, sampleAnalysis, "empathetic_professional");

    expect(userPrompt).not.toContain("node-eu-west-cluster-9876");
    expect(userPrompt).not.toContain("Do not disclose");
    expect(userPrompt).toContain("Can I get a refund or credit");
  });
});
