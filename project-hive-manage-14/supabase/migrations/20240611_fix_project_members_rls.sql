-- Corrigir políticas RLS para project_members para resolver erros 406/400

-- Remover políticas existentes
DROP POLICY IF EXISTS "Enable read access for project members" ON project_members;
DROP POLICY IF EXISTS "Enable insert for project creators" ON project_members;
DROP POLICY IF EXISTS "Enable delete for project creators" ON project_members;

-- Política mais permissiva para SELECT - permite que usuários autenticados vejam membros de projetos
CREATE POLICY "Allow authenticated users to view project members"
    ON project_members FOR SELECT
    TO authenticated
    USING (true);

-- Política para INSERT - permite que usuários autenticados adicionem membros a projetos que eles criaram
CREATE POLICY "Allow project creators to add members"
    ON project_members FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
    );

-- Política para DELETE - permite que criadores do projeto removam membros
CREATE POLICY "Allow project creators to remove members"
    ON project_members FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
    );

-- Política para UPDATE - permite que criadores do projeto atualizem roles dos membros
CREATE POLICY "Allow project creators to update member roles"
    ON project_members FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
    );