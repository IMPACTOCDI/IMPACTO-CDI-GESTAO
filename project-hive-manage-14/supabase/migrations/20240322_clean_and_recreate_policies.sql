-- PRIMEIRA ETAPA: Remover TODAS as políticas existentes
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT tablename, policyname 
              FROM pg_policies 
              WHERE schemaname = 'public') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- SEGUNDA ETAPA: Recriar as novas políticas
-- Garantir que RLS está habilitado
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_emails ENABLE ROW LEVEL SECURITY;

-- Políticas extremamente simplificadas para projects
CREATE POLICY "Projects are viewable by members"
    ON projects FOR SELECT
    USING (
        visibility = 'public'::project_visibility
        OR created_by = auth.uid()
    );

CREATE POLICY "Users can create projects"
    ON projects FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own projects"
    ON projects FOR UPDATE
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Políticas extremamente simplificadas para project_members
CREATE POLICY "Project members are viewable by project members"
    ON project_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND (
                projects.visibility = 'public'::project_visibility
                OR projects.created_by = auth.uid()
            )
        )
    );

CREATE POLICY "Project members can be managed by project creators"
    ON project_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
    );

-- Políticas extremamente simplificadas para tasks
CREATE POLICY "Tasks are viewable by project members"
    ON tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND (
                projects.visibility = 'public'::project_visibility
                OR projects.created_by = auth.uid()
            )
        )
    );

CREATE POLICY "Tasks can be created by project creators"
    ON tasks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.created_by = auth.uid()
        )
    );

CREATE POLICY "Tasks can be updated by project creators"
    ON tasks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.created_by = auth.uid()
        )
    );

-- Políticas extremamente simplificadas para task_tags
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
            )
        )
    );

CREATE POLICY "Task tags can be managed by project creators"
    ON task_tags FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = task_tags.task_id
            AND projects.created_by = auth.uid()
        )
    );

-- Políticas extremamente simplificadas para comments
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
            )
        )
    );

CREATE POLICY "Comments can be created by project creators"
    ON comments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = comments.task_id
            AND projects.created_by = auth.uid()
        )
    );

CREATE POLICY "Comments can be updated by their authors"
    ON comments FOR UPDATE
    USING (author_id = auth.uid());

CREATE POLICY "Comments can be deleted by their authors and project creators"
    ON comments FOR DELETE
    USING (
        author_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = comments.task_id
            AND projects.created_by = auth.uid()
        )
    );

-- Políticas para authorized_emails
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