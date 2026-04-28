-- ============================================================
-- Migration 001: Row-Level Security Policies
-- AI Agent Marketing Platform
-- ============================================================

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── Add vector embedding column to knowledge_items ─────────
-- Prisma cannot declare vector type — managed here directly
ALTER TABLE knowledge_items
  ADD COLUMN IF NOT EXISTS embedding vector(512);

CREATE INDEX IF NOT EXISTS knowledge_items_embedding_idx
  ON knowledge_items
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- ─── Helper function: get current project_id from session ───
CREATE OR REPLACE FUNCTION current_project_id()
RETURNS uuid AS $$
BEGIN
  RETURN current_setting('app.project_id', true)::uuid;
EXCEPTION
  WHEN others THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- ─── projects ───────────────────────────────────────────────
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY projects_isolation ON projects
  USING (
    id = current_project_id()
    OR owner_id = current_setting('app.user_id', true)::uuid
  );

-- ─── project_members ────────────────────────────────────────
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY project_members_isolation ON project_members
  USING (project_id = current_project_id());

-- ─── tasks ──────────────────────────────────────────────────
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_isolation ON tasks
  USING (project_id = current_project_id());

-- ─── executions ─────────────────────────────────────────────
ALTER TABLE executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY executions_isolation ON executions
  USING (project_id = current_project_id());

-- ─── agent_outputs ──────────────────────────────────────────
-- Isolated via execution → task → project chain
ALTER TABLE agent_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY agent_outputs_isolation ON agent_outputs
  USING (
    execution_id IN (
      SELECT id FROM executions
      WHERE project_id = current_project_id()
    )
  );

-- ─── knowledge_items ────────────────────────────────────────
ALTER TABLE knowledge_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY knowledge_items_isolation ON knowledge_items
  USING (project_id = current_project_id());

-- ─── Application role (least privilege) ─────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user NOLOGIN;
  END IF;
END
$$;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
GRANT EXECUTE ON FUNCTION current_project_id() TO app_user;
