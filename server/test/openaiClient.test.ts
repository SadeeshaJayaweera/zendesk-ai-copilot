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

  it("should retry on malformed JSON and succeed if subsequent attempt passes", async () => {
    const mockSchema = z.object({ ok: z.boolean() });
    vi.spyOn(openai.chat.completions, "create")
      .mockResolvedValueOnce({ choices: [{ message: { content: "invalid json" } }] } as any)
      .mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify({ ok: true }) } }] } as any);

    const res = await createStructuredCompletion("sys", "usr", mockSchema);
    expect(res.ok).toBe(true);
  });
});
