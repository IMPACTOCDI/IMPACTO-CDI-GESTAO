-- Garantir que RLS está habilitado em todas as tabelas
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_emails ENABLE ROW LEVEL SECURITY;

-- Política para authorized_emails (que estava faltando)
DROP POLICY IF EXISTS "Authorized emails are viewable by everyone" ON authorized_emails;
DROP POLICY IF EXISTS "Only admins can manage authorized emails" ON authorized_emails;

CREATE POLICY "Authorized emails are viewable by everyone"
    ON authorized_emails FOR SELECT
    USING (true);

CREATE POLICY "Only admins can manage authorized emails"
    ON authorized_emails FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Verificar e corrigir políticas de projects
DROP POLICY IF EXISTS "Projects are viewable by members" ON projects;
CREATE POLICY "Projects are viewable by members"
    ON projects FOR SELECT
    USING (
        visibility = 'public'::project_visibility
        OR created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
        )
    );

-- Verificar e corrigir políticas de project_members
DROP POLICY IF EXISTS "Project members are viewable by project members" ON project_members;
CREATE POLICY "Project members are viewable by project members"
    ON project_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND (
                projects.visibility = 'public'::project_visibility
                OR projects.created_by = auth.uid()
                OR project_members.user_id = auth.uid()
            )
        )
    );

-- Verificar e corrigir políticas de tasks
DROP POLICY IF EXISTS "Tasks are viewable by project members" ON tasks;
CREATE POLICY "Tasks are viewable by project members"
    ON tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND (
                projects.visibility = 'public'::project_visibility
                OR projects.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_members.project_id = projects.id
                    AND project_members.user_id = auth.uid()
                )
            )
        )
    );

-- Verificar e corrigir políticas de task_tags
DROP POLICY IF EXISTS "Task tags are viewable by project members" ON task_tags;
CREATE POLICY "Task tags are viewable by project members"
    ON task_tags FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = task_tags.task_id
            AND (
                projects.visibility = 'public'::project_visibility
                OR projects.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_members.project_id = projects.id
                    AND project_members.user_id = auth.uid()
                )
            )
        )
    );

-- Verificar e corrigir políticas de comments
DROP POLICY IF EXISTS "Comments are viewable by project members" ON comments;
CREATE POLICY "Comments are viewable by project members"
    ON comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = comments.task_id
            AND (
                projects.visibility = 'public'::project_visibility
                OR projects.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_members.project_id = projects.id
                    AND project_members.user_id = auth.uid()
                )
            )
        )
    ); 