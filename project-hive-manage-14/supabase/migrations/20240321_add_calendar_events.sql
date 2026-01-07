-- Adicionar colunas necessárias à tabela calendar_events se ela existir
DO $$ 
BEGIN
    -- Verificar se a tabela existe
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'calendar_events') THEN
        -- Adicionar colunas se não existirem
        BEGIN
            ALTER TABLE calendar_events 
            ADD COLUMN IF NOT EXISTS project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
            ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL;
        EXCEPTION
            WHEN duplicate_column THEN 
                NULL;
        END;
    ELSE
        -- Criar a tabela se não existir
        CREATE TABLE calendar_events (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT,
            start_time TIMESTAMP WITH TIME ZONE NOT NULL,
            end_time TIMESTAMP WITH TIME ZONE NOT NULL,
            project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
            created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
        );
    END IF;
END $$;

-- Habilitar RLS (Row Level Security)
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Remover políticas existentes se houver
DROP POLICY IF EXISTS "Eventos são visíveis para membros do projeto" ON calendar_events;
DROP POLICY IF EXISTS "Usuários podem criar eventos em projetos que são membros" ON calendar_events;
DROP POLICY IF EXISTS "Usuários podem atualizar eventos em projetos que são membros" ON calendar_events;
DROP POLICY IF EXISTS "Usuários podem deletar eventos em projetos que são membros" ON calendar_events;

-- Adicionar políticas de segurança para calendar_events
CREATE POLICY "Eventos são visíveis para membros do projeto"
    ON calendar_events FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = calendar_events.project_id
            AND project_members.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = calendar_events.project_id
            AND projects.created_by = auth.uid()
        )
    );

CREATE POLICY "Usuários podem criar eventos em projetos que são membros"
    ON calendar_events FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = calendar_events.project_id
            AND project_members.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = calendar_events.project_id
            AND projects.created_by = auth.uid()
        )
    );

CREATE POLICY "Usuários podem atualizar eventos em projetos que são membros"
    ON calendar_events FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = calendar_events.project_id
            AND project_members.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = calendar_events.project_id
            AND projects.created_by = auth.uid()
        )
    );

CREATE POLICY "Usuários podem deletar eventos em projetos que são membros"
    ON calendar_events FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = calendar_events.project_id
            AND project_members.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = calendar_events.project_id
            AND projects.created_by = auth.uid()
        )
    ); 