import { describe, it, expect } from "vitest";
import { getCachedAnalysis, setCachedAnalysis } from "../src/db/cacheRepo.js";
import type { ConversationAnalysis } from "../src/types/ai.js";

describe("Analysis Cache Repository", () => {
  const sampleAnalysis: ConversationAnalysis = {
    customer_sentiment: "positive",
    customer_intent: "praise",
    urgency: "low",
    conversation_tone: "happy",
    recommended_tone: "warm",
    response_length: "short",
    needs_apology: false,
    needs_clarification: false,
    confidence: 0.99
  };

  it("handles cache lookup gracefully when database is offline in test mode", async () => {
    const cached = await getCachedAnalysis(99999, "non_existent_hash");
    expect(cached).toBeNull();
  });

  it("handles cache write gracefully when database is offline in test mode", async () => {
    await expect(setCachedAnalysis(99999, "test_hash", sampleAnalysis, 15)).resolves.not.toThrow();
  });
});
