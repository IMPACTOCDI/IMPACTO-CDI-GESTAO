-- Remover políticas existentes
DROP POLICY IF EXISTS "Enable delete for project members" ON tasks;
DROP POLICY IF EXISTS "Enable update for project members" ON tasks;
DROP POLICY IF EXISTS "Enable insert for project members" ON tasks;
DROP POLICY IF EXISTS "Tasks can be created by project members" ON tasks;

-- Adicionar política de inserção para tarefas
CREATE POLICY "Enable insert for project members"
    ON tasks FOR INSERT
    WITH CHECK (
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
    );

-- Adicionar política de exclusão para tarefas
CREATE POLICY "Enable delete for project members"
    ON tasks FOR DELETE
    USING (
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
    );

-- Adicionar política de atualização para tarefas
CREATE POLICY "Enable update for project members"
    ON tasks FOR UPDATE
    USING (
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
    ); 