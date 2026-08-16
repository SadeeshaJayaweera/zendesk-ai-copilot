-- Initial schema migration for Zendesk AI Reply Copilot

CREATE TABLE IF NOT EXISTS feedback_events (
  id SERIAL PRIMARY KEY,
  ticket_id BIGINT NOT NULL,
  agent_id BIGINT NOT NULL,
  event_type VARCHAR(32) NOT NULL CHECK (event_type IN ('helpful', 'not_helpful', 'accepted', 'edited', 'rejected')),
  action VARCHAR(64),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_feedback_events_ticket ON feedback_events(ticket_id);
CREATE INDEX IF NOT EXISTS idx_feedback_events_agent ON feedback_events(agent_id);

CREATE TABLE IF NOT EXISTS style_profiles (
  subdomain VARCHAR(128) PRIMARY KEY,
  company_name VARCHAR(255) NOT NULL,
  preferred_tone VARCHAR(64) NOT NULL DEFAULT 'professional',
  formality VARCHAR(32) NOT NULL DEFAULT 'neutral',
  verbosity VARCHAR(32) NOT NULL DEFAULT 'medium',
  use_emojis BOOLEAN NOT NULL DEFAULT FALSE,
  use_customer_name BOOLEAN NOT NULL DEFAULT TRUE,
  preferred_greeting VARCHAR(128) NOT NULL DEFAULT 'Hello',
  preferred_closing VARCHAR(128) NOT NULL DEFAULT 'Best regards,\nSupport Team',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS agent_preferences (
  agent_id BIGINT PRIMARY KEY,
  formality NUMERIC(3, 2) NOT NULL DEFAULT 0.50,
  warmth NUMERIC(3, 2) NOT NULL DEFAULT 0.50,
  conciseness NUMERIC(3, 2) NOT NULL DEFAULT 0.50,
  empathy NUMERIC(3, 2) NOT NULL DEFAULT 0.50,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analysis_cache (
  ticket_id BIGINT NOT NULL,
  conversation_hash VARCHAR(64) NOT NULL,
  analysis_json JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (ticket_id, conversation_hash)
);

CREATE INDEX IF NOT EXISTS idx_analysis_cache_expires ON analysis_cache(expires_at);
