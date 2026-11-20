import { describe, it, expect, vi } from "vitest";
import { chunkDocumentText } from "../src/services/knowledge/chunker.js";
import { retrieveRelevantKnowledge } from "../src/services/knowledge/knowledgeRetriever.js";
import * as knowledgeRepo from "../src/services/knowledge/knowledgeRepo.js";
import type { TicketContext } from "../src/types/ticketContext.js";

describe("Phase 6: Knowledge Base & RAG Engine", () => {
  describe("Text Chunker", () => {
    it("returns empty array for empty string", () => {
      expect(chunkDocumentText("")).toEqual([]);
      expect(chunkDocumentText("   ")).toEqual([]);
    });

    it("returns single chunk for short text", () => {
      const text = "This is a brief knowledge article about password resets.";
      const chunks = chunkDocumentText(text, 500);
      expect(chunks.length).toBe(1);
      expect(chunks[0]).toBe(text);
    });

    it("splits long document into multiple overlapping chunks", () => {
      const longText = Array(15)
        .fill("Enterprise SSO configuration requires SAML 2.0 metadata from your identity provider.")
        .join("\n\n");

      const chunks = chunkDocumentText(longText, 250, 40);
      expect(chunks.length).toBeGreaterThan(1);
      // Verify overlap prefix on subsequent chunks
      expect(chunks[1]).toContain("...");
    });
  });

  describe("Tenant-Isolated Knowledge Retriever", () => {
    const ticketContext: TicketContext = {
      ticketId: 901,
      subject: "How do I configure SAML SSO with Okta?",
      description: "Need help setting up Okta integration for our team.",
      status: "open",
      priority: "normal",
      tags: ["sso", "okta"],
      customFields: [],
      messages: [
        {
          id: 1,
          authorRole: "customer",
          body: "Where do I upload our Okta SAML certificate?",
          createdAt: "2026-11-20T11:00:00Z",
          isPublic: true
        }
      ]
    };

    it("retrieves and formats relevant citations when matches exist", async () => {
      vi.spyOn(knowledgeRepo, "searchKnowledge").mockResolvedValueOnce([
        {
          chunkId: 12,
          documentId: 3,
          title: "Configuring SAML SSO & Identity Providers",
          sourceUri: "https://kb.example.com/sso",
          content: "To configure Okta SAML SSO, navigate to Admin Settings > Security > SSO and paste your X.509 certificate.",
          chunkIndex: 0,
          score: 0.89
        }
      ]);

      const res = await retrieveRelevantKnowledge("acme-tenant", ticketContext);

      expect(res.hasGrounding).toBe(true);
      expect(res.citations.length).toBe(1);
      expect(res.citations[0]?.title).toBe("Configuring SAML SSO & Identity Providers");
      expect(res.citations[0]?.citationTag).toContain("[KB-1:");
      expect(res.groundingPromptBlock).toContain("X.509 certificate");
    });

    it("returns hasGrounding=false when no documents match ticket query", async () => {
      vi.spyOn(knowledgeRepo, "searchKnowledge").mockResolvedValueOnce([]);

      const res = await retrieveRelevantKnowledge("acme-tenant", ticketContext);

      expect(res.hasGrounding).toBe(false);
      expect(res.citations).toEqual([]);
      expect(res.groundingPromptBlock).toContain("No official company knowledge base articles matched");
    });

    it("enforces tenant isolation by passing organizationId to repository search", async () => {
      const searchSpy = vi.spyOn(knowledgeRepo, "searchKnowledge").mockResolvedValueOnce([]);

      await retrieveRelevantKnowledge("tenant-456", ticketContext);

      expect(searchSpy).toHaveBeenCalledWith("tenant-456", expect.any(String), 3);
    });
  });
});
