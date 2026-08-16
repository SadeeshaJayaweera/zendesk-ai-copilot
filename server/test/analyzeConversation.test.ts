import { describe, it, expect, vi } from "vitest";
import { analyzeConversation } from "../src/services/ai/analyzeConversation.js";
import * as aiClient from "../src/services/ai/openaiClient.js";
import type { TicketContext } from "../src/types/ticketContext.js";

describe("analyzeConversation", () => {
  const context: TicketContext = {
    ticketId: 808,
    subject: "How do I invite team members?",
    description: "Team settings help",
    status: "open",
    priority: "normal",
    tags: ["onboarding"],
    customFields: [],
    messages: [
      { id: 1, authorRole: "customer", body: "Where is the invite button?", createdAt: "2026-08-16T11:00:00Z", isPublic: true }
    ]
  };

  it("analyzes conversation and parses valid schema output", async () => {
    vi.spyOn(aiClient, "createStructuredCompletion").mockResolvedValueOnce({
      customer_sentiment: "neutral",
      customer_intent: "question",
      urgency: "medium",
      conversation_tone: "inquisitive",
      recommended_tone: "helpful_direct",
      response_length: "short",
      needs_apology: false,
      needs_clarification: false,
      confidence: 0.98
    } as any);

    const analysis = await analyzeConversation(context);
    expect(analysis.customer_intent).toBe("question");
    expect(analysis.customer_sentiment).toBe("neutral");
  });
});
