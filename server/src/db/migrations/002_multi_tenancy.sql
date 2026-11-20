-- Migration 002: Multi-Tenancy and Organization Isolation

CREATE TABLE IF NOT EXISTS organizations (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(128) UNIQUE NOT NULL,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default organization for backward compatibility
INSERT INTO organizations (id, name, subdomain)
VALUES ('default', 'Default Organization', 'default')
ON CONFLICT (id) DO NOTHING;

-- Organization isolation for feedback events
ALTER TABLE feedback_events 
  ADD COLUMN IF NOT EXISTS organization_id VARCHAR(64) NOT NULL DEFAULT 'default';

CREATE INDEX IF NOT EXISTS idx_feedback_events_org_ticket 
  ON feedback_events(organization_id, ticket_id);

-- Organization isolation for style profiles
ALTER TABLE style_profiles 
  ADD COLUMN IF NOT EXISTS organization_id VARCHAR(64) DEFAULT 'default';

-- Organization isolation for agent preferences
ALTER TABLE agent_preferences 
  ADD COLUMN IF NOT EXISTS organization_id VARCHAR(64) NOT NULL DEFAULT 'default';

-- Organization isolation for analysis cache
ALTER TABLE analysis_cache 
  ADD COLUMN IF NOT EXISTS organization_id VARCHAR(64) NOT NULL DEFAULT 'default';

CREATE INDEX IF NOT EXISTS idx_analysis_cache_org_lookup 
  ON analysis_cache(organization_id, ticket_id, conversation_hash);
