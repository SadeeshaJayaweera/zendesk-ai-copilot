import { describe, it, expect, vi } from "vitest";
import { analyzeDraft } from "../src/services/ai/analyzeDraft.js";
import * as aiClient from "../src/services/ai/openaiClient.js";
import type { TicketContext } from "../src/types/ticketContext.js";

describe("analyzeDraft", () => {
  const context: TicketContext = {
    ticketId: 505,
    subject: "Bug in dashboard",
    description: "Chart does not render",
    status: "open",
    priority: "normal",
    tags: [],
    customFields: [],
    messages: [
      { id: 1, authorRole: "customer", body: "Chart is blank on safari.", createdAt: "2026-08-16T09:00:00Z", isPublic: true }
    ]
  };

  it("throws error for empty or whitespace drafts", async () => {
    await expect(analyzeDraft(context, "   ")).rejects.toThrow("agentDraft cannot be empty");
  });

  it("evaluates draft and flags issues using structured completion", async () => {
    const mockOutput = {
      score: 85,
      scores: { professionalism: 90, friendliness: 85, empathy: 80, clarity: 85 },
      strengths: ["Clear explanation"],
      issues: [{ type: "too_verbose", message: "Could be shorter", severity: "info" }],
      recommended_changes: ["Shorten intro"]
    };

    vi.spyOn(aiClient, "createStructuredCompletion").mockResolvedValueOnce(mockOutput as any);

    const result = await analyzeDraft(context, "Hello! We have reproduced the Safari bug and shipped a fix.");
    expect(result.score).toBe(85);
    expect(result.issues).toHaveLength(1);
  });
});
