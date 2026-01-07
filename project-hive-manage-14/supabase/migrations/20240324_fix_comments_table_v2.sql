-- Remover a coluna author_id se existir
ALTER TABLE comments DROP COLUMN IF EXISTS author_id;

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

-- Remover todas as políticas existentes
DROP POLICY IF EXISTS "Comments can be viewed by project members" ON comments;
DROP POLICY IF EXISTS "Comments can be created by project members" ON comments;
DROP POLICY IF EXISTS "Comments can be updated by their authors" ON comments;
DROP POLICY IF EXISTS "Comments can be deleted by their authors and project admins" ON comments;

-- Habilitar RLS
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- Criar novas políticas
CREATE POLICY "Comments can be viewed by project members"
    ON comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            JOIN project_members ON project_members.project_id = projects.id
            WHERE tasks.id = comments.task_id
            AND project_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Comments can be created by project members"
    ON comments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            JOIN project_members ON project_members.project_id = projects.id
            WHERE tasks.id = comments.task_id
            AND project_members.user_id = auth.uid()
        )
        AND created_by = auth.uid()
    );

CREATE POLICY "Comments can be updated by their authors"
    ON comments FOR UPDATE
    USING (created_by = auth.uid());

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