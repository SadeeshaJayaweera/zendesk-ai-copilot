import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app.js";

describe("POST /api/tickets/:id/feedback", () => {
  const app = createApp();

  it("records valid feedback event successfully", async () => {
    const res = await request(app)
      .post("/api/tickets/123/feedback")
      .send({
        agentId: 42,
        eventType: "accepted",
        action: "generateReply"
      });

    expect([200, 201]).toContain(res.status);
    expect(res.body.status).toMatch(/recorded/);
  });

  it("rejects unknown event type with 400", async () => {
    const res = await request(app)
      .post("/api/tickets/123/feedback")
      .send({
        agentId: 42,
        eventType: "invalid_event_type"
      });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe("invalid_payload");
  });
});
