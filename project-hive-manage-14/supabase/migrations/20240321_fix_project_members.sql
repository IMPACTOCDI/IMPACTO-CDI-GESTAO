-- Primeiro, vamos remover a tabela existente e suas dependências
DROP TABLE IF EXISTS project_members CASCADE;

-- Agora criar a tabela com a estrutura correta
CREATE TABLE project_members (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    PRIMARY KEY (project_id, user_id)
);

-- Habilitar RLS
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Política para permitir que o criador do projeto adicione o primeiro membro
DROP POLICY IF EXISTS "Project creator can add first member" ON project_members;
CREATE POLICY "Project creator can add first member"
    ON project_members FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
    );

-- Política para visualização
DROP POLICY IF EXISTS "Project members are viewable by project members" ON project_members;
CREATE POLICY "Project members are viewable by project members"
    ON project_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND (
                projects.visibility = 'public'
                OR projects.created_by = auth.uid()
                OR project_members.user_id = auth.uid()
            )
        )
    );

-- Política para permitir que o criador do projeto gerencie membros
DROP POLICY IF EXISTS "Project creator can manage members" ON project_members;
CREATE POLICY "Project creator can manage members"
    ON project_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
    ); 