-- Remover TODAS as políticas existentes
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

-- Garantir que RLS está habilitado
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Função auxiliar para verificar se usuário é membro do projeto
CREATE OR REPLACE FUNCTION is_project_member(project_id uuid)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM project_members
        WHERE project_members.project_id = $1
        AND project_members.user_id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas para profiles
CREATE POLICY "Enable read access for all users"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Enable insert for users based on id"
    ON profiles FOR INSERT
    WITH CHECK (id = auth.uid());

CREATE POLICY "Enable update for users based on id"
    ON profiles FOR UPDATE
    USING (id = auth.uid());

-- Políticas para projects
CREATE POLICY "Enable read access for authorized users"
    ON projects FOR SELECT
    USING (
        visibility = 'public'::project_visibility
        OR created_by = auth.uid()
        OR is_project_member(id)
    );

CREATE POLICY "Enable insert for authenticated users"
    ON projects FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Enable update for project creators"
    ON projects FOR UPDATE
    USING (created_by = auth.uid());

-- Políticas para project_members
CREATE POLICY "Enable read access for authorized users"
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

CREATE POLICY "Enable insert for project creators"
    ON project_members FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
    );

CREATE POLICY "Enable delete for project creators"
    ON project_members FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
    );

-- Políticas para tasks
CREATE POLICY "Enable read access for project members"
    ON tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND (
                projects.visibility = 'public'::project_visibility
                OR projects.created_by = auth.uid()
                OR is_project_member(tasks.project_id)
            )
        )
    );

CREATE POLICY "Enable insert for project members"
    ON tasks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND (
                projects.created_by = auth.uid()
                OR is_project_member(tasks.project_id)
            )
        )
    );

CREATE POLICY "Enable update for project members"
    ON tasks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND (
                projects.created_by = auth.uid()
                OR is_project_member(tasks.project_id)
            )
        )
    );

-- Políticas para task_tags
CREATE POLICY "Enable read access for project members"
    ON task_tags FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = task_tags.task_id
            AND (
                projects.visibility = 'public'::project_visibility
                OR projects.created_by = auth.uid()
                OR is_project_member(tasks.project_id)
            )
        )
    ); 