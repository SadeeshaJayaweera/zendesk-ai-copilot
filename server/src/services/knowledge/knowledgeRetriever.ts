import type { TicketContext } from "../../types/ticketContext.js";
import { getLatestCustomerMessage } from "../zendesk/conversationHelpers.js";
import { searchKnowledge, type KnowledgeSearchResult } from "./knowledgeRepo.js";

export interface KnowledgeCitation {
  documentId: number;
  title: string;
  sourceUri?: string | null;
  snippet: string;
  score: number;
  citationTag: string;
}

export interface RetrievalResult {
  hasGrounding: boolean;
  citations: KnowledgeCitation[];
  groundingPromptBlock: string;
}

/**
 * Retrieves relevant, tenant-isolated knowledge base passages for a support ticket.
 * Grounding guarantees that troubleshooting steps can cite verified sources.
 */
export async function retrieveRelevantKnowledge(
  organizationId: string,
  context: TicketContext
): Promise<RetrievalResult> {
  const latestCustomer = getLatestCustomerMessage(context);
  const queryTerms = [
    context.subject,
    latestCustomer ? latestCustomer.body : "",
    context.tags.join(" ")
  ].filter(Boolean).join(" ");

  const results: KnowledgeSearchResult[] = await searchKnowledge(organizationId, queryTerms, 3);

  if (!results || results.length === 0) {
    return {
      hasGrounding: false,
      citations: [],
      groundingPromptBlock: "No official company knowledge base articles matched this ticket query."
    };
  }

  const citations: KnowledgeCitation[] = results.map((r, idx) => ({
    documentId: r.documentId,
    title: r.title,
    sourceUri: r.sourceUri,
    snippet: r.content.slice(0, 300),
    score: r.score,
    citationTag: `[KB-${idx + 1}: ${r.title}]`
  }));

  const groundingPromptBlock = citations
    .map(
      (c) =>
        `DOCUMENT ${c.citationTag}:\nTitle: ${c.title}\nContent:\n${c.snippet}`
    )
    .join("\n\n");

  return {
    hasGrounding: true,
    citations,
    groundingPromptBlock
  };
}
