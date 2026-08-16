import { describe, it, expect, vi } from "vitest";
import { generateReply } from "../src/services/ai/generateReply.js";
import { recommendTone } from "../src/services/ai/recommendTone.js";
import { detectHallucinations } from "../src/services/ai/hallucinationGuard.js";
import * as aiClient from "../src/services/ai/openaiClient.js";
import type { TicketContext } from "../src/types/ticketContext.js";
import type { ConversationAnalysis } from "../src/types/ai.js";

describe("generateReply & Hallucination Guard", () => {
  const context: TicketContext = {
    ticketId: 707,
    subject: "Login error",
    description: "Wrong password error",
    status: "open",
    priority: "urgent",
    tags: [],
    customFields: [],
    messages: [
      { id: 1, authorRole: "customer", body: "I am furious, I cannot login!", createdAt: "2026-08-16T10:00:00Z", isPublic: true }
    ]
  };

  const analysis: ConversationAnalysis = {
    customer_sentiment: "angry",
    customer_intent: "question",
    urgency: "urgent",
    conversation_tone: "angry and blocked",
    recommended_tone: "empathetic_direct",
    response_length: "short",
    needs_apology: true,
    needs_clarification: false,
    confidence: 0.95
  };

  it("recommends combined empathetic and direct tone for angry urgent tickets", () => {
    const tone = recommendTone(analysis);
    expect(tone).toContain("empathetic");
    expect(tone).toContain("direct");
  });

  it("detects fabricated refund promise when not in source context", () => {
    const guard = detectHallucinations("We are issuing a 100% refund today.", context);
    expect(guard.hasWarning).toBe(true);
    expect(guard.warnings[0]).toContain("financial refund or credit");
  });

  it("generates reply and attaches hallucination warning if flagged", async () => {
    vi.spyOn(aiClient, "createStructuredCompletion").mockResolvedValueOnce({
      reply: "We are issuing a refund immediately.",
      missing_information: [],
      tone_used: "empathetic_direct"
    } as any);

    const result = await generateReply(context, analysis);
    expect(result.warnings).toBeDefined();
    expect(result.warnings?.length).toBeGreaterThan(0);
  });
});
