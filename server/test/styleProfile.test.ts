import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import { buildGenerateReplyPrompts } from "../src/services/ai/prompts/generateReply.prompt.js";
import type { TicketContext } from "../src/types/ticketContext.js";
import type { ConversationAnalysis } from "../src/types/ai.js";

describe("Style Profile & Customization", () => {
  const app = createApp();

  const sampleContext: TicketContext = {
    ticketId: 100,
    subject: "Help needed",
    description: "Account question",
    status: "open",
    priority: "normal",
    tags: [],
    customFields: [],
    messages: []
  };

  const sampleAnalysis: ConversationAnalysis = {
    customer_sentiment: "neutral",
    customer_intent: "question",
    urgency: "medium",
    conversation_tone: "neutral",
    recommended_tone: "professional",
    response_length: "medium",
    needs_apology: false,
    needs_clarification: false,
    confidence: 0.9
  };

  it("modifies reply system prompt based on style profile configuration", () => {
    const { systemPrompt: defaultPrompt } = buildGenerateReplyPrompts(
      sampleContext,
      sampleAnalysis,
      "professional"
    );
    expect(defaultPrompt).toContain("Do NOT use emojis");

    const { systemPrompt: customPrompt } = buildGenerateReplyPrompts(
      sampleContext,
      sampleAnalysis,
      "friendly",
      undefined,
      {
        companyName: "Acme Corp",
        formality: "casual",
        useEmojis: true,
        preferredGreeting: "Hey there",
        preferredClosing: "Cheers,\\nAcme Support"
      }
    );

    expect(customPrompt).toContain("Acme Corp");
    expect(customPrompt).toContain("Allowed and encouraged");
    expect(customPrompt).toContain("Hey there");
  });

  it("rejects unauthorized PUT /api/admin/style-profile request", async () => {
    const res = await request(app)
      .put("/api/admin/style-profile")
      .send({
        subdomain: "acme",
        companyName: "Acme Inc"
      });

    expect(res.status).toBe(401);
  });
});
