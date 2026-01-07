-- Primeiro, vamos verificar se a tabela existe e dropá-la se necessário
DROP TABLE IF EXISTS calendar_events CASCADE;

-- Criar a tabela calendar_events com a estrutura correta
CREATE TABLE calendar_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time TIMESTAMP WITH TIME ZONE NOT NULL,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    color TEXT DEFAULT 'bg-blue-500'
);

-- Habilitar RLS
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Criar políticas de segurança
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
        OR calendar_events.project_id IS NULL
    );

CREATE POLICY "Usuários podem criar eventos"
    ON calendar_events FOR INSERT
    WITH CHECK (
        auth.uid() = created_by
    );

CREATE POLICY "Usuários podem atualizar seus próprios eventos"
    ON calendar_events FOR UPDATE
    USING (
        auth.uid() = created_by
    );

CREATE POLICY "Usuários podem deletar seus próprios eventos"
    ON calendar_events FOR DELETE
    USING (
        auth.uid() = created_by
    );

-- Criar trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_calendar_events_updated_at
    BEFORE UPDATE ON calendar_events
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 