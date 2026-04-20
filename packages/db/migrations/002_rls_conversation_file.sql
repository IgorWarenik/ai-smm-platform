-- ============================================================
-- Migration 002: RLS Policies for Conversation and File tables
-- AI Agent Marketing Platform
-- ============================================================
-- These tables have project_id but were missing from migration 001.

-- ─── conversations ──────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY conversations_isolation ON conversations
  USING (project_id = current_project_id());

-- ─── files ──────────────────────────────────────────────────
ALTER TABLE files ENABLE ROW LEVEL SECURITY;

CREATE POLICY files_isolation ON files
  USING (project_id = current_project_id());

-- Grant permissions to app_user role (defined in migration 001)
GRANT SELECT, INSERT, UPDATE, DELETE ON conversations TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON files TO app_user;
