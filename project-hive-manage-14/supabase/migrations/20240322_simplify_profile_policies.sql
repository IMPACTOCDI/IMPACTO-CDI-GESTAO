-- Remover políticas existentes da tabela profiles
DROP POLICY IF EXISTS "Profiles are viewable by users themselves" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins and managers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins and managers can manage all profiles" ON profiles;

-- Garantir que RLS está habilitado
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas básicas para todos os usuários
CREATE POLICY "Enable read access for all users"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Enable insert for users based on id"
    ON profiles FOR INSERT
    WITH CHECK (id = auth.uid());

CREATE POLICY "Enable update for users based on id"
    ON profiles FOR UPDATE
    USING (id = auth.uid());

-- Política para permitir que admins e managers gerenciem perfis
CREATE POLICY "Enable delete for admins and managers"
    ON profiles FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM profiles AS p
            WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'manager')
        )
    ); 