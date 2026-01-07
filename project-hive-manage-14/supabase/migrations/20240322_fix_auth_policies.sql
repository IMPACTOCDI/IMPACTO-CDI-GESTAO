-- Remover políticas existentes se necessário
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Authorized emails are viewable by everyone" ON authorized_emails;
DROP POLICY IF EXISTS "Only admins can manage authorized emails" ON authorized_emails;

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
        EXISTS (
            SELECT 1 FROM authorized_emails
            WHERE authorized_emails.email = profiles.email
        )
    );

-- Políticas para authorized_emails
CREATE POLICY "Authorized emails are viewable by everyone"
    ON authorized_emails FOR SELECT
    USING (true);

CREATE POLICY "Only admins can manage authorized emails"
    ON authorized_emails FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );

-- Política para permitir que usuários não autenticados verifiquem emails autorizados
CREATE POLICY "Allow email verification during registration"
    ON authorized_emails FOR SELECT
    USING (true); 