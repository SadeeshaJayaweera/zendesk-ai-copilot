import { describe, expect, it } from "vitest";
import { getLatestCustomerMessage } from "../src/services/zendesk/conversationHelpers.js";
import type { TicketContext } from "../src/types/ticketContext.js";

describe("conversationHelpers: getLatestCustomerMessage", () => {
  const baseContext: TicketContext = {
    ticketId: 101,
    subject: "Refund status",
    description: "Where is my refund?",
    status: "open",
    priority: "high",
    tags: ["billing"],
    customFields: [],
    messages: []
  };

  it("should return null if there are no messages", () => {
    expect(getLatestCustomerMessage(baseContext)).toBeNull();
  });

  it("should return the latest customer public message", () => {
    const context: TicketContext = {
      ...baseContext,
      messages: [
        { id: 1, authorRole: "customer", body: "Initial inquiry", createdAt: "2026-08-16T10:00:00Z", isPublic: true },
        { id: 2, authorRole: "agent", body: "Checking now", createdAt: "2026-08-16T10:05:00Z", isPublic: true },
        { id: 3, authorRole: "customer", body: "Any updates?", createdAt: "2026-08-16T10:10:00Z", isPublic: true }
      ]
    };
    expect(getLatestCustomerMessage(context)?.id).toBe(3);
  });
});
