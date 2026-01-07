-- Remover políticas existentes
DROP POLICY IF EXISTS "Comments can be viewed by project members" ON comments;
DROP POLICY IF EXISTS "Comments can be created by project members" ON comments;
DROP POLICY IF EXISTS "Comments can be updated by their authors" ON comments;
DROP POLICY IF EXISTS "Comments can be deleted by their authors and project creators" ON comments;

-- Habilitar RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Função de debug para logs
CREATE OR REPLACE FUNCTION debug_comment_policy()
RETURNS TRIGGER AS $$
BEGIN
  RAISE LOG 'Tentativa de inserção de comentário: auth.uid=% created_by=% task_id=% project_id=%',
    auth.uid(),
    NEW.created_by,
    NEW.task_id,
    NEW.project_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para debug
DROP TRIGGER IF EXISTS debug_comment_insert ON comments;
CREATE TRIGGER debug_comment_insert
  BEFORE INSERT ON comments
  FOR EACH ROW
  EXECUTE FUNCTION debug_comment_policy();

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

-- Política para criação de comentários (simplificada)
CREATE POLICY "Comments can be created by project members"
    ON comments FOR INSERT
    WITH CHECK (
        auth.uid() IS NOT NULL
        AND created_by = auth.uid()
        AND EXISTS (
            SELECT 1 FROM tasks
            WHERE tasks.id = comments.task_id
            AND (
                EXISTS (
                    SELECT 1 FROM projects
                    WHERE projects.id = tasks.project_id
                    AND (
                        projects.created_by = auth.uid()
                        OR EXISTS (
                            SELECT 1 FROM project_members
                            WHERE project_members.project_id = projects.id
                            AND project_members.user_id = auth.uid()
                        )
                    )
                )
            )
        )
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