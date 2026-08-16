import { describe, it, expect, vi } from "vitest";
import { rewriteDraft } from "../src/services/ai/rewrite.js";
import * as aiClient from "../src/services/ai/openaiClient.js";

describe("rewriteDraft", () => {
  it("rewrites draft for all 10 actions cleanly", async () => {
    const actions = [
      "improveTone",
      "makeMoreProfessional",
      "makeMoreFriendly",
      "makeMoreEmpathetic",
      "makeMoreConcise",
      "makeMoreClear",
      "makeLessRobotic",
      "makeMoreConfident",
      "deEscalate",
      "rewriteCompletely"
    ] as const;

    for (const action of actions) {
      vi.spyOn(aiClient, "createStructuredCompletion").mockResolvedValueOnce({
        rewrittenText: "Rewritten response for " + action,
        actionApplied: action
      } as any);

      const res = await rewriteDraft("Original text", action);
      expect(res.actionApplied).toBe(action);
      expect(res.rewrittenText).toContain(action);
    }
  });
});
