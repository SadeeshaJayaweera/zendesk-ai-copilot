import { pool } from "../../db/pool.js";
import { chunkDocumentText } from "./chunker.js";

export interface KnowledgeDocumentRecord {
  id: number;
  organizationId: string;
  title: string;
  sourceUri?: string | null;
  version: number;
  tags: string[];
  createdAt: string;
}

export interface KnowledgeSearchResult {
  chunkId: number;
  documentId: number;
  title: string;
  sourceUri?: string | null;
  content: string;
  chunkIndex: number;
  score: number;
}

interface InMemoryDoc {
  id: number;
  organizationId: string;
  title: string;
  content: string;
  sourceUri?: string | null;
  tags: string[];
  chunks: string[];
  createdAt: string;
}

const inMemoryDocs: InMemoryDoc[] = [];
let nextDocId = 1;

export async function createDocument(
  organizationId: string,
  title: string,
  content: string,
  sourceUri?: string,
  tags: string[] = []
): Promise<{ documentId: number; chunksCount: number }> {
  const chunks = chunkDocumentText(content);
  const memDoc: InMemoryDoc = {
    id: nextDocId++,
    organizationId,
    title,
    content,
    sourceUri: sourceUri || null,
    tags,
    chunks,
    createdAt: new Date().toISOString()
  };
  inMemoryDocs.push(memDoc);

  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      // 1. Insert Document record
      const docQuery = `
        INSERT INTO knowledge_documents (organization_id, title, source_uri, tags, created_at, updated_at)
        VALUES ($1, $2, $3, $4, NOW(), NOW())
        RETURNING id;
      `;
      const docRes = await client.query(docQuery, [organizationId, title, sourceUri || null, tags]);
      const documentId = docRes.rows[0].id;

      // 2. Insert Chunks
      for (let i = 0; i < chunks.length; i++) {
        const chunkText = chunks[i]!;
        const chunkQuery = `
          INSERT INTO knowledge_chunks (document_id, organization_id, chunk_index, content, created_at)
          VALUES ($1, $2, $3, $4, NOW());
        `;
        await client.query(chunkQuery, [documentId, organizationId, i, chunkText]);
      }

      await client.query("COMMIT");
      return { documentId, chunksCount: chunks.length };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  } catch {
    // In-memory fallback succeeded
    return { documentId: memDoc.id, chunksCount: chunks.length };
  }
}

export async function searchKnowledge(
  organizationId: string,
  queryText: string,
  limit = 5
): Promise<KnowledgeSearchResult[]> {
  const sanitized = queryText.replace(/[^\w\s]/g, " ").trim();
  if (!sanitized) return [];

  const sql = `
    SELECT c.id AS chunk_id, c.document_id, d.title, d.source_uri, c.content, c.chunk_index,
           ts_rank_cd(c.search_vector, plainto_tsquery('english', $2)) AS rank
    FROM knowledge_chunks c
    JOIN knowledge_documents d ON d.id = c.document_id
    WHERE c.organization_id = $1 
      AND c.search_vector @@ plainto_tsquery('english', $2)
    ORDER BY rank DESC
    LIMIT $3;
  `;

  try {
    const res = await pool.query(sql, [organizationId, sanitized, limit]);
    if (res.rows.length > 0) {
      return res.rows.map((r) => ({
        chunkId: r.chunk_id,
        documentId: r.document_id,
        title: r.title,
        sourceUri: r.source_uri,
        content: r.content,
        chunkIndex: r.chunk_index,
        score: Number(r.rank || 0)
      }));
    }
  } catch {
    // Database unavailable -> fall through to in-memory
  }

  // In-memory search fallback (tenant isolated)
  const words = sanitized.toLowerCase().split(/\s+/).filter(Boolean);
  const matching: KnowledgeSearchResult[] = [];

  for (const doc of inMemoryDocs) {
    if (doc.organizationId !== organizationId) continue;
    for (let i = 0; i < doc.chunks.length; i++) {
      const chunk = doc.chunks[i]!;
      const lowerChunk = chunk.toLowerCase();
      const lowerTitle = doc.title.toLowerCase();
      const matchCount = words.filter((w) => lowerChunk.includes(w) || lowerTitle.includes(w)).length;
      if (matchCount > 0) {
        matching.push({
          chunkId: doc.id * 100 + i,
          documentId: doc.id,
          title: doc.title,
          sourceUri: doc.sourceUri,
          content: chunk,
          chunkIndex: i,
          score: matchCount / words.length
        });
      }
    }
  }

  return matching.sort((a, b) => b.score - a.score).slice(0, limit);
}

export async function listDocuments(organizationId: string): Promise<KnowledgeDocumentRecord[]> {
  const sql = `
    SELECT id, organization_id, title, source_uri, version, tags, created_at
    FROM knowledge_documents
    WHERE organization_id = $1
    ORDER BY id DESC;
  `;
  try {
    const res = await pool.query(sql, [organizationId]);
    return res.rows.map((r) => ({
      id: r.id,
      organizationId: r.organization_id,
      title: r.title,
      sourceUri: r.source_uri,
      version: r.version,
      tags: r.tags || [],
      createdAt: r.created_at
    }));
  } catch {
    return [];
  }
}

export async function deleteDocument(organizationId: string, documentId: number): Promise<boolean> {
  const sql = `
    DELETE FROM knowledge_documents
    WHERE organization_id = $1 AND id = $2;
  `;
  try {
    const res = await pool.query(sql, [organizationId, documentId]);
    return (res.rowCount || 0) > 0;
  } catch {
    return false;
  }
}
