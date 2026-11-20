-- Migration 003: Tenant-Isolated Knowledge Base & Full-Text Search (RAG Engine)

CREATE TABLE IF NOT EXISTS knowledge_documents (
  id SERIAL PRIMARY KEY,
  organization_id VARCHAR(64) NOT NULL REFERENCES organizations(id),
  title VARCHAR(255) NOT NULL,
  source_uri VARCHAR(512),
  version INT NOT NULL DEFAULT 1,
  tags TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_docs_org ON knowledge_documents(organization_id);

CREATE TABLE IF NOT EXISTS knowledge_chunks (
  id SERIAL PRIMARY KEY,
  document_id INT NOT NULL REFERENCES knowledge_documents(id) ON DELETE CASCADE,
  organization_id VARCHAR(64) NOT NULL,
  chunk_index INT NOT NULL,
  content TEXT NOT NULL,
  search_vector TSVECTOR,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_org ON knowledge_chunks(organization_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_doc ON knowledge_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_tsv ON knowledge_chunks USING GIN(search_vector);

-- Automatically maintain search vector on insert or update
CREATE OR REPLACE FUNCTION update_knowledge_chunk_search_vector() RETURNS trigger AS $$
BEGIN
  NEW.search_vector := to_tsvector('english', NEW.content);
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_knowledge_chunk_tsv ON knowledge_chunks;
CREATE TRIGGER trg_knowledge_chunk_tsv
  BEFORE INSERT OR UPDATE ON knowledge_chunks
  FOR EACH ROW
  EXECUTE FUNCTION update_knowledge_chunk_search_vector();
