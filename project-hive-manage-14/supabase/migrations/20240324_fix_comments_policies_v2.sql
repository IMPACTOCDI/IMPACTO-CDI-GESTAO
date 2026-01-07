-- Remover políticas existentes
DROP POLICY IF EXISTS "Comments can be viewed by project members" ON comments;
DROP POLICY IF EXISTS "Comments can be created by project members" ON comments;
DROP POLICY IF EXISTS "Comments can be updated by their authors" ON comments;
DROP POLICY IF EXISTS "Comments can be deleted by their authors and project creators" ON comments;

-- Habilitar RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Política para visualização de comentários
CREATE POLICY "Comments can be viewed by project members"
    ON comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = comments.task_id
            AND (
                projects.visibility = 'public'
                OR projects.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_members.project_id = projects.id
                    AND project_members.user_id = auth.uid()
                )
            )
        )
    );

-- Política para criação de comentários
CREATE POLICY "Comments can be created by project members"
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

-- Política para atualização de comentários
CREATE POLICY "Comments can be updated by their authors"
    ON comments FOR UPDATE
    USING (
        created_by = auth.uid()
        AND deleted_at IS NULL
    );

-- Política para exclusão de comentários
CREATE POLICY "Comments can be deleted by their authors and project creators"
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