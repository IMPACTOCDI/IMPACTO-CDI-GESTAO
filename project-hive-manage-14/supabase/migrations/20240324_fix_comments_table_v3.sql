-- Remover todas as políticas existentes que dependem de user_id
DROP POLICY IF EXISTS "Comment authors and project admins can update comments" ON comments;
DROP POLICY IF EXISTS "Comment authors and project admins can delete comments" ON comments;
DROP POLICY IF EXISTS "Allow project members to insert comments" ON comments;
DROP POLICY IF EXISTS "Comments can be viewed by project members" ON comments;
DROP POLICY IF EXISTS "Comments can be created by project members" ON comments;
DROP POLICY IF EXISTS "Comments can be updated by their authors" ON comments;
DROP POLICY IF EXISTS "Comments can be deleted by their authors and project creators" ON comments;

-- Remover a coluna user_id se existir (já que usamos created_by)
ALTER TABLE comments DROP COLUMN IF EXISTS user_id;

-- Garantir que created_by existe e é NOT NULL
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'comments' 
        AND column_name = 'created_by'
    ) THEN
        ALTER TABLE comments ADD COLUMN created_by UUID REFERENCES auth.users(id) NOT NULL;
    END IF;
END $$;

-- Garantir que project_id existe e é NOT NULL
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'comments' 
        AND column_name = 'project_id'
    ) THEN
        ALTER TABLE comments ADD COLUMN project_id UUID REFERENCES projects(id) NOT NULL;
    END IF;
END $$;

-- Garantir que updated_at existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'comments' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE comments ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW());
    END IF;
END $$;

-- Garantir que deleted_at existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'comments' 
        AND column_name = 'deleted_at'
    ) THEN
        ALTER TABLE comments ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

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