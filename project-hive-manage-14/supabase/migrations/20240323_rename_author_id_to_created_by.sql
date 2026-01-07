-- Remover a coluna author_id já que created_by já existe
ALTER TABLE comments DROP COLUMN IF EXISTS author_id;

-- Atualizar as políticas que ainda usam author_id
DROP POLICY IF EXISTS "Comments can be updated by their authors" ON comments;
DROP POLICY IF EXISTS "Comments can be deleted by their authors and project admins" ON comments;

CREATE POLICY "Comments can be updated by their authors"
    ON comments FOR UPDATE
    USING (created_by = auth.uid());

CREATE POLICY "Comments can be deleted by their authors and project admins"
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