import { describe, it, expect } from "vitest";
import {
  getLatestCustomerMessage,
  getRecentMessages,
  conversationHash,
  filterCustomerFacingContext
} from "../src/services/zendesk/conversationHelpers.js";
import type { TicketContext } from "../src/types/ticketContext.js";

describe("Conversation Helpers", () => {
  const context: TicketContext = {
    ticketId: 101,
    subject: "Refund query",
    description: "I need refund",
    status: "open",
    priority: "normal",
    tags: ["billing"],
    customFields: [],
    messages: [
      { id: 1, authorRole: "customer", body: "Hello, where is my order?", createdAt: "2026-08-16T08:00:00Z", isPublic: true },
      { id: 2, authorRole: "agent", body: "Internal note: checking courier", createdAt: "2026-08-16T08:05:00Z", isPublic: false },
      { id: 3, authorRole: "agent", body: "We are looking into it.", createdAt: "2026-08-16T08:10:00Z", isPublic: true },
      { id: 4, authorRole: "customer", body: "Thank you, please update soon.", createdAt: "2026-08-16T08:15:00Z", isPublic: true }
    ]
  };

  it("getLatestCustomerMessage returns newest public customer message", () => {
    const latest = getLatestCustomerMessage(context);
    expect(latest?.id).toBe(4);
    expect(latest?.body).toBe("Thank you, please update soon.");
  });

  it("getRecentMessages respects limit and ignores internal notes", () => {
    const recent = getRecentMessages(context, 2);
    expect(recent).toHaveLength(2);
    expect(recent[0].id).toBe(3);
    expect(recent[1].id).toBe(4);
  });

  it("conversationHash stays stable for identical messages and changes on new messages", () => {
    const hash1 = conversationHash(context);
    const hash2 = conversationHash({ ...context });
    expect(hash1).toBe(hash2);

    const modifiedContext: TicketContext = {
      ...context,
      messages: [...context.messages, { id: 5, authorRole: "agent", body: "Shipped!", createdAt: "2026-08-16T08:20:00Z", isPublic: true }]
    };
    expect(conversationHash(modifiedContext)).not.toBe(hash1);
  });

  it("filterCustomerFacingContext strips all non-public messages", () => {
    const clean = filterCustomerFacingContext(context);
    expect(clean.messages.every((m) => m.isPublic)).toBe(true);
    expect(clean.messages).toHaveLength(3);
  });
});
