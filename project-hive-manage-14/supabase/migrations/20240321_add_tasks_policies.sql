-- Remover políticas existentes
DROP POLICY IF EXISTS "Tasks são visíveis para membros do projeto" ON tasks;
DROP POLICY IF EXISTS "Usuários podem criar tarefas em projetos que são membros" ON tasks;
DROP POLICY IF EXISTS "Usuários podem atualizar tarefas em projetos que são membros" ON tasks;
DROP POLICY IF EXISTS "Usuários podem deletar tarefas em projetos que são membros" ON tasks;

-- Adicionar políticas de segurança para a tabela tasks
CREATE POLICY "Tasks são visíveis para membros do projeto"
    ON tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = tasks.project_id
            AND project_members.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.created_by = auth.uid()
        )
    );

CREATE POLICY "Usuários podem criar tarefas em projetos que são membros"
    ON tasks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = tasks.project_id
            AND project_members.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.created_by = auth.uid()
        )
    );

CREATE POLICY "Usuários podem atualizar tarefas em projetos que são membros"
    ON tasks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = tasks.project_id
            AND project_members.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.created_by = auth.uid()
        )
    );

CREATE POLICY "Usuários podem deletar tarefas em projetos que são membros"
    ON tasks FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = tasks.project_id
            AND project_members.user_id = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.created_by = auth.uid()
        )
    ); 