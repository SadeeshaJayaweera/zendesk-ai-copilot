import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createStructuredCompletion, openai } from "../src/services/ai/openaiClient.js";

describe("openaiClient: createStructuredCompletion", () => {
  it("should parse and return validated JSON from OpenAI", async () => {
    const mockSchema = z.object({ answer: z.string() });
    vi.spyOn(openai.chat.completions, "create").mockResolvedValueOnce({
      choices: [{ message: { content: JSON.stringify({ answer: "hello" }) } }]
    } as any);

    const result = await createStructuredCompletion("system", "user", mockSchema);
    expect(result.answer).toBe("hello");
  });
});
