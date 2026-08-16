import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { createStructuredCompletion, openai, AiServiceError } from "../src/services/ai/openaiClient.js";

describe("createStructuredCompletion", () => {
  const testSchema = z.object({
    status: z.string()
  });

  it("successfully parses valid structured JSON response", async () => {
    vi.spyOn(openai.chat.completions, "create").mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ status: "success" }) } }]
    } as any);

    const res = await createStructuredCompletion("sys", "usr", testSchema);
    expect(res.status).toBe("success");
  });

  it("retries on malformed JSON and succeeds on second attempt", async () => {
    vi.spyOn(openai.chat.completions, "create")
      .mockResolvedValueOnce({
        choices: [{ message: { content: "INVALID_JSON" } }]
      } as any)
      .mockResolvedValueOnce({
        choices: [{ message: { content: JSON.stringify({ status: "recovered" }) } }]
      } as any);

    const res = await createStructuredCompletion("sys", "usr", testSchema);
    expect(res.status).toBe("recovered");
  });

  it("throws AiServiceError after exceeding retry limit on persistent error", async () => {
    vi.spyOn(openai.chat.completions, "create").mockRejectedValue(new Error("API failure"));

    await expect(createStructuredCompletion("sys", "usr", testSchema)).rejects.toThrow(AiServiceError);
  });
});
