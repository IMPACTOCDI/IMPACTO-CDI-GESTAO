-- Abertura de políticas para permitir que qualquer usuário autenticado
-- vincule contatos a qualquer projeto.

-- Atualiza política de SELECT para permitir leitura geral
DROP POLICY IF EXISTS "Authenticated users can view any project contacts" ON project_contacts;
DROP POLICY IF EXISTS "Users can view project contacts for projects they are members of" ON project_contacts;
CREATE POLICY "Authenticated users can view any project contacts"
    ON project_contacts FOR SELECT
    USING (auth.role() = 'authenticated');

-- Atualiza política de INSERT para permitir vinculação livre
DROP POLICY IF EXISTS "Authenticated users can create project contacts" ON project_contacts;
DROP POLICY IF EXISTS "Users can create project contacts for projects they are members of" ON project_contacts;
CREATE POLICY "Authenticated users can create project contacts"
    ON project_contacts FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Permitir atualização por qualquer autenticado
DROP POLICY IF EXISTS "Authenticated users can update project contacts" ON project_contacts;
DROP POLICY IF EXISTS "Users can update project contacts for projects they are members of" ON project_contacts;
CREATE POLICY "Authenticated users can update project contacts"
    ON project_contacts FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Permitir deleção por qualquer autenticado
DROP POLICY IF EXISTS "Authenticated users can delete project contacts" ON project_contacts;
DROP POLICY IF EXISTS "Users can delete project contacts for projects they are members of" ON project_contacts;
CREATE POLICY "Authenticated users can delete project contacts"
    ON project_contacts FOR DELETE
    USING (auth.role() = 'authenticated');

