-- Remover políticas existentes se necessário
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation during registration" ON profiles;

-- Políticas para profiles
CREATE POLICY "Public profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Allow profile creation during registration"
    ON profiles FOR INSERT
    WITH CHECK (
        auth.uid() = id
        AND EXISTS (
            SELECT 1 FROM authorized_emails
            WHERE authorized_emails.email = profiles.email
        )
    );

-- Garantir que RLS está habilitado
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY; 