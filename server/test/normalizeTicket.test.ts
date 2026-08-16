import { describe, expect, it } from "vitest";
import { deriveAuthorRole, normalizeTicket } from "../src/services/zendesk/normalizeTicket.js";

describe("deriveAuthorRole", () => {
  it("should classify requesterId matching authorId as customer", () => {
    expect(deriveAuthorRole(1001, 1001)).toBe("customer");
  });
  it("should classify other authorId as agent", () => {
    expect(deriveAuthorRole(2002, 1001)).toBe("agent");
  });
  it("should classify non-positive authorId as system", () => {
    expect(deriveAuthorRole(0, 1001)).toBe("system");
  });
});

describe("normalizeTicket", () => {
  it("should normalize raw ticket object", () => {
    const res = normalizeTicket({ id: 123, subject: "Sub", requester_id: 1 }, [{ id: 1, author_id: 1, body: "Hi", public: true }]);
    expect(res.ticketId).toBe(123);
    expect(res.messages).toHaveLength(1);
  });
});
