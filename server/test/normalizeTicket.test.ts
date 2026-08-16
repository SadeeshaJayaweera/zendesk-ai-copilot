import { describe, it, expect } from "vitest";
import {
  deriveAuthorRole,
  normalizeTicket,
  type ZendeskTicketRaw,
  type ZendeskCommentRaw,
  type ZendeskCommentsResponseRaw
} from "../src/services/zendesk/normalizeTicket.js";

describe("deriveAuthorRole", () => {
  it("classifies requester author as customer", () => {
    expect(deriveAuthorRole(100, 100)).toBe("customer");
  });

  it("classifies non-requester author as agent by default", () => {
    expect(deriveAuthorRole(200, 100)).toBe("agent");
  });

  it("classifies missing or negative author_id as system", () => {
    expect(deriveAuthorRole(null, 100)).toBe("system");
    expect(deriveAuthorRole(undefined, 100)).toBe("system");
    expect(deriveAuthorRole(-1, 100)).toBe("system");
    expect(deriveAuthorRole(0, 100)).toBe("system");
  });

  it("uses usersMap role when available", () => {
    const usersMap = new Map([
      [100, { id: 100, name: "Customer Bob", role: "end-user" }],
      [200, { id: 200, name: "Agent Alice", role: "agent" }],
      [300, { id: 300, name: "Admin Carol", role: "admin" }],
      [400, { id: 400, name: "Bot Service", role: "system" }]
    ]);

    expect(deriveAuthorRole(100, null, usersMap)).toBe("customer");
    expect(deriveAuthorRole(200, null, usersMap)).toBe("agent");
    expect(deriveAuthorRole(300, null, usersMap)).toBe("agent");
    expect(deriveAuthorRole(400, null, usersMap)).toBe("system");
  });
});

describe("normalizeTicket", () => {
  const sampleTicket: ZendeskTicketRaw = {
    id: 4242,
    subject: "Cannot access billing portal",
    description: "I am getting a 403 error on login",
    status: "open",
    priority: "high",
    tags: ["billing", "enterprise"],
    custom_fields: [
      { id: 101, value: "Plan-Pro" },
      { id: 102, value: 3 }
    ],
    requester_id: 1001,
    submitter_id: 1001,
    assignee_id: 2002
  };

  it("normalizes a ticket with customer message, agent message, and internal note", () => {
    const commentsResponse: ZendeskCommentsResponseRaw = {
      comments: [
        {
          id: 1,
          author_id: 1001,
          body: "I cannot log in to the billing portal.",
          plain_body: "I cannot log in to the billing portal.",
          public: true,
          created_at: "2026-08-15T09:00:00Z"
        },
        {
          id: 2,
          author_id: 2002,
          body: "Internal note: check Okta SAML sync for user 1001.",
          plain_body: "Internal note: check Okta SAML sync for user 1001.",
          public: false,
          created_at: "2026-08-15T09:10:00Z"
        },
        {
          id: 3,
          author_id: 2002,
          body: "Hello! We have reset your permissions. Please try now.",
          plain_body: "Hello! We have reset your permissions. Please try now.",
          public: true,
          created_at: "2026-08-15T09:20:00Z"
        }
      ],
      users: [
        { id: 1001, name: "Customer Dave", role: "end-user" },
        { id: 2002, name: "Agent Sarah", role: "agent" }
      ]
    };

    const normalized = normalizeTicket({ ticket: sampleTicket }, commentsResponse);

    expect(normalized.ticketId).toBe(4242);
    expect(normalized.subject).toBe("Cannot access billing portal");
    expect(normalized.description).toBe("I am getting a 403 error on login");
    expect(normalized.status).toBe("open");
    expect(normalized.priority).toBe("high");
    expect(normalized.tags).toEqual(["billing", "enterprise"]);
    expect(normalized.customFields).toEqual([
      { id: 101, value: "Plan-Pro" },
      { id: 102, value: 3 }
    ]);

    expect(normalized.messages).toHaveLength(3);

    // Message 1: Customer
    expect(normalized.messages[0]).toEqual({
      id: 1,
      authorRole: "customer",
      body: "I cannot log in to the billing portal.",
      createdAt: "2026-08-15T09:00:00Z",
      isPublic: true
    });

    // Message 2: Internal Note by Agent
    expect(normalized.messages[1]).toEqual({
      id: 2,
      authorRole: "agent",
      body: "Internal note: check Okta SAML sync for user 1001.",
      createdAt: "2026-08-15T09:10:00Z",
      isPublic: false
    });

    // Message 3: Public Agent Message
    expect(normalized.messages[2]).toEqual({
      id: 3,
      authorRole: "agent",
      body: "Hello! We have reset your permissions. Please try now.",
      createdAt: "2026-08-15T09:20:00Z",
      isPublic: true
    });
  });

  it("handles raw ticket without wrapper and empty comments array", () => {
    const normalized = normalizeTicket(sampleTicket, []);

    expect(normalized.ticketId).toBe(4242);
    expect(normalized.messages).toEqual([]);
  });

  it("handles missing description, priority, tags, and null values with safe defaults", () => {
    const minimalTicket: ZendeskTicketRaw = {
      id: 999,
      requester_id: 55
    };

    const commentList: ZendeskCommentRaw[] = [
      {
        id: "c-1",
        author_id: -1,
        body: "Ticket created via trigger",
        public: false
      }
    ];

    const normalized = normalizeTicket(minimalTicket, commentList);

    expect(normalized.ticketId).toBe(999);
    expect(normalized.subject).toBe("");
    expect(normalized.description).toBe("");
    expect(normalized.status).toBe("open");
    expect(normalized.priority).toBeNull();
    expect(normalized.tags).toEqual([]);
    expect(normalized.customFields).toEqual([]);
    expect(normalized.messages[0]).toMatchObject({
      id: "c-1",
      authorRole: "system",
      body: "Ticket created via trigger",
      isPublic: false
    });
  });
});
