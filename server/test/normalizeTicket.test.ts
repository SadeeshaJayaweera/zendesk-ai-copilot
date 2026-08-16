import { describe, expect, it } from "vitest";
import { deriveAuthorRole } from "../src/services/zendesk/normalizeTicket.js";

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
