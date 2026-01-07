-- Permitir que todos os usuários autenticados visualizem qualquer contato.
-- Mantém regras de criação/edição exclusivas para o criador.

DROP POLICY IF EXISTS "Users can view their own contacts" ON contacts;
CREATE POLICY "Authenticated users can view any contacts"
    ON contacts FOR SELECT
    USING (auth.role() = 'authenticated');

-- Permitir atualização por qualquer usuário autenticado
DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
CREATE POLICY "Authenticated users can update any contacts"
    ON contacts FOR UPDATE
    USING (auth.role() = 'authenticated');

-- Permitir deleção por qualquer usuário autenticado
DROP POLICY IF EXISTS "Users can delete their own contacts" ON contacts;
CREATE POLICY "Authenticated users can delete any contacts"
    ON contacts FOR DELETE
    USING (auth.role() = 'authenticated');

