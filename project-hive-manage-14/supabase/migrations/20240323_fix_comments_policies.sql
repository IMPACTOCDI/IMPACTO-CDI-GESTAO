-- Remover políticas existentes da tabela comments
DROP POLICY IF EXISTS "Comments are viewable by project members" ON comments;
DROP POLICY IF EXISTS "Comments can be created by project members" ON comments;
DROP POLICY IF EXISTS "Comments can be updated by their authors" ON comments;
DROP POLICY IF EXISTS "Comments can be deleted by their authors and project admins" ON comments;
DROP POLICY IF EXISTS "Enable read access for project members" ON comments;
DROP POLICY IF EXISTS "Enable insert for project members" ON comments;
DROP POLICY IF EXISTS "Enable update for comment authors" ON comments;
DROP POLICY IF EXISTS "Enable delete for comment authors and project creators" ON comments;

-- Garantir que RLS está habilitado
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Criar novas políticas para comments
CREATE POLICY "Enable read access for project members"
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

CREATE POLICY "Permitir inserir comentários para membros do projeto"
    ON comments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = comments.task_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
                )
            )
        )
        AND created_by = auth.uid()
    );

CREATE POLICY "Enable update for comment authors"
    ON comments FOR UPDATE
    USING (created_by = auth.uid());

CREATE POLICY "Enable delete for comment authors and project creators"
    ON comments FOR DELETE
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = comments.task_id
            AND projects.created_by = auth.uid()
        )
    );