import { describe, it, expect, vi } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";
import type { TicketContext } from "../src/types/ticketContext.js";
import * as aiClient from "../src/services/ai/openaiClient.js";

describe("POST /api/tickets/:id/context", () => {
  const app = createApp();

  const validContext: TicketContext = {
    ticketId: 1234,
    subject: "Printer is not responding",
    description: "Cannot connect to network printer.",
    status: "open",
    priority: "urgent",
    tags: ["hardware", "printer"],
    customFields: [{ id: 456, value: "Floor-3" }],
    messages: [
      {
        id: 1,
        authorRole: "customer",
        body: "The printer on floor 3 is offline.",
        createdAt: "2026-08-15T08:00:00Z",
        isPublic: true
      },
      {
        id: 2,
        authorRole: "agent",
        body: "Internal note: checking network switch port.",
        createdAt: "2026-08-15T08:05:00Z",
        isPublic: false
      }
    ]
  };

  it("returns 200 and structured analysis for valid TicketContext payload", async () => {
    vi.spyOn(aiClient, "createStructuredCompletion").mockResolvedValueOnce({
      customer_sentiment: "frustrated",
      customer_intent: "bug_report",
      urgency: "high",
      conversation_tone: "frustrated",
      recommended_tone: "empathetic_direct",
      response_length: "short",
      needs_apology: true,
      needs_clarification: false,
      confidence: 0.95
    } as any);

    const res = await request(app)
      .post("/api/tickets/1234/context")
      .send(validContext);

    expect(res.status).toBe(200);
    expect(res.body.context.ticketId).toBe(1234);
    expect(res.body.context.subject).toBe("Printer is not responding");
    expect(res.body.analysis.customer_sentiment).toBe("frustrated");
  });

  it("returns 400 if URL ticket ID does not match body ticket ID", async () => {
    const res = await request(app)
      .post("/api/tickets/9999/context")
      .send(validContext);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("ticket_id_mismatch");
  });

  it("returns 400 if payload is missing required fields or has invalid role", async () => {
    const invalidPayload = {
      ticketId: 1234,
      subject: "Test",
      messages: [
        {
          id: 1,
          authorRole: "invalid-role",
          body: "Hello"
        }
      ]
    };

    const res = await request(app)
      .post("/api/tickets/1234/context")
      .send(invalidPayload);

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_payload");
  });
});
