-- Remover políticas existentes da tabela profiles
DROP POLICY IF EXISTS "Profiles are viewable by users themselves" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;

-- Garantir que RLS está habilitado
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Políticas simplificadas para profiles
CREATE POLICY "Profiles are viewable by users themselves"
    ON profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "Users can insert their own profile"
    ON profiles FOR INSERT
    WITH CHECK (id = auth.uid());

-- Política especial para admins e managers
CREATE POLICY "Admins and managers can view all profiles"
    ON profiles FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'manager')
        )
    );

CREATE POLICY "Admins and managers can manage all profiles"
    ON profiles FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM auth.users
            WHERE auth.users.id = auth.uid()
            AND auth.users.raw_user_meta_data->>'role' IN ('admin', 'manager')
        )
    ); 