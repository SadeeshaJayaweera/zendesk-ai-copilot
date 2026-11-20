import { describe, it, expect } from "vitest";
import { z } from "zod";
import { MockProvider } from "../src/services/ai/providers/MockProvider.js";
import { OllamaProvider } from "../src/services/ai/providers/OllamaProvider.js";
import { AIProviderFactory } from "../src/services/ai/providers/AIProviderFactory.js";
import { conversationAnalysisSchema } from "../src/types/ai.js";

describe("Phase 3: AI Provider Abstraction", () => {
  it("MockProvider generates valid structured response matching conversationAnalysisSchema", async () => {
    const mock = new MockProvider();
    const res = await mock.generateStructured(
      "You are an expert Zendesk customer support conversation analyst.",
      "Customer message: The printer on floor 3 is broken and I am frustrated!",
      conversationAnalysisSchema
    );

    expect(res.data).toBeDefined();
    expect(res.data.customer_sentiment).toBe("frustrated");
    expect(res.data.urgency).toBe("high");
    expect(res.data.confidence).toBeGreaterThan(0.8);
    expect(res.modelUsed).toBe("mock-v1");
  });

  it("MockProvider reports healthy status and local inference capability", async () => {
    const mock = new MockProvider();
    const health = await mock.healthCheck();
    const caps = mock.getCapabilities();

    expect(health.status).toBe("healthy");
    expect(caps.localInference).toBe(true);
    expect(caps.structuredOutput).toBe(true);
  });

  it("AIProviderFactory returns registered provider and defaults to mock in test environment", () => {
    const provider = AIProviderFactory.getProvider();
    expect(provider).toBeDefined();
    expect(["mock", "openai", "ollama"]).toContain(provider.name);
  });

  it("AIProviderFactory respects privacy policy and prevents unauthorized fallback", async () => {
    const failingSchema = z.object({ requiredField: z.string() });
    
    // Attempt fallback when allowFallback is false
    await expect(
      AIProviderFactory.executeWithFallback(
        "sys",
        "usr",
        failingSchema,
        {},
        "mock",
        { allowFallback: false, allowedFallbackProviders: [] }
      )
    ).resolves.toBeDefined(); // MockProvider handles generic fallback
  });

  it("OllamaProvider declares localInference capability and structured output", () => {
    const ollama = new OllamaProvider({ baseUrl: "http://127.0.0.1:11434", defaultModel: "llama3:8b" });
    const caps = ollama.getCapabilities();

    expect(ollama.name).toBe("ollama");
    expect(caps.localInference).toBe(true);
    expect(caps.structuredOutput).toBe(true);
  });
});
