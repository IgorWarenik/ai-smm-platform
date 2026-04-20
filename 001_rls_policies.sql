-- Enable RLS on core tables
ALTER TABLE "Project" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ProjectProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Execution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AgentOutput" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "KnowledgeItem" ENABLE ROW LEVEL SECURITY;

-- Helper to check project membership
-- Granular Role-Based Access Control (RBAC) via RLS

-- Project: Members can VIEW, Owners can UPDATE/DELETE
CREATE POLICY project_select ON "Project" FOR SELECT
    USING (id IN (SELECT project_id FROM "ProjectMember" WHERE user_id = current_setting('app.current_user_id')::uuid));

CREATE POLICY project_modify ON "Project" FOR ALL
    USING (id IN (SELECT project_id FROM "ProjectMember" WHERE user_id = current_setting('app.current_user_id')::uuid AND role = 'OWNER'));

-- Tasks: Viewers SELECT only; Owners/Members INSERT/UPDATE
CREATE POLICY task_select ON "Task" FOR SELECT
    USING (project_id IN (SELECT project_id FROM "ProjectMember" WHERE user_id = current_setting('app.current_user_id')::uuid));

CREATE POLICY task_modify ON "Task" FOR ALL
    USING (project_id IN (SELECT project_id FROM "ProjectMember" WHERE user_id = current_setting('app.current_user_id')::uuid AND role IN ('OWNER', 'MEMBER')));

-- Knowledge: Viewers SELECT only
CREATE POLICY knowledge_select ON "KnowledgeItem" FOR SELECT
    USING (project_id IN (SELECT project_id FROM "ProjectMember" WHERE user_id = current_setting('app.current_user_id')::uuid));

CREATE POLICY knowledge_modify ON "KnowledgeItem" FOR ALL
    USING (project_id IN (SELECT project_id FROM "ProjectMember" WHERE user_id = current_setting('app.current_user_id')::uuid AND role IN ('OWNER', 'MEMBER')));

-- Execution & Outputs
CREATE POLICY execution_select ON "Execution" FOR SELECT
    USING (task_id IN (SELECT id FROM "Task" WHERE project_id IN (SELECT project_id FROM "ProjectMember" WHERE user_id = current_setting('app.current_user_id')::uuid)));

CREATE POLICY output_select ON "AgentOutput" FOR SELECT
    USING (execution_id IN (SELECT id FROM "Execution" WHERE task_id IN (SELECT id FROM "Task" WHERE project_id IN (SELECT project_id FROM "ProjectMember" WHERE user_id = current_setting('app.current_user_id')::uuid))));

-- Bypass for internal service (n8n/system)
-- Assumes 'app.is_internal' flag
CREATE POLICY internal_bypass_project ON "Project" FOR ALL USING (current_setting('app.is_internal', true) = 'true');
CREATE POLICY internal_bypass_task ON "Task" FOR ALL USING (current_setting('app.is_internal', true) = 'true');
CREATE POLICY internal_bypass_execution ON "Execution" FOR ALL USING (current_setting('app.is_internal', true) = 'true');
CREATE POLICY internal_bypass_output ON "AgentOutput" FOR ALL USING (current_setting('app.is_internal', true) = 'true');