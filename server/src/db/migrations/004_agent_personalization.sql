-- Migration 004: Agent Personalization and Telemetry
ALTER TABLE agent_preferences
  ADD COLUMN IF NOT EXISTS preferred_greeting VARCHAR(128) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS preferred_closing VARCHAR(128) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS tone_bias VARCHAR(64) DEFAULT 'balanced';

CREATE UNIQUE INDEX IF NOT EXISTS idx_agent_preferences_org_agent
  ON agent_preferences(organization_id, agent_id);
