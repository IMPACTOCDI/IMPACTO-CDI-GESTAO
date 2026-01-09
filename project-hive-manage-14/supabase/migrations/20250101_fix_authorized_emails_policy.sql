-- Corrigir política de authorized_emails para permitir acesso
-- Execute este arquivo no SQL Editor do Supabase

-- ============================================
-- 1. REMOVER POLÍTICAS EXISTENTES
-- ============================================

DROP POLICY IF EXISTS "authorized_emails_select_all" ON authorized_emails;
DROP POLICY IF EXISTS "Authorized emails are viewable by everyone" ON authorized_emails;
DROP POLICY IF EXISTS "Only admins can manage authorized emails" ON authorized_emails;
DROP POLICY IF EXISTS "Allow email verification during registration" ON authorized_emails;

-- ============================================
-- 2. GARANTIR PERMISSÕES
-- ============================================

GRANT SELECT ON TABLE authorized_emails TO authenticated;
GRANT SELECT ON TABLE authorized_emails TO anon;

-- ============================================
-- 3. CRIAR POLÍTICAS CORRETAS
-- ============================================

ALTER TABLE authorized_emails ENABLE ROW LEVEL SECURITY;

-- Permitir que QUALQUER pessoa (incluindo não autenticados) possa VER authorized_emails
-- Isso é necessário para verificar se um email está autorizado durante o registro
CREATE POLICY "authorized_emails_select_all"
    ON authorized_emails FOR SELECT
    USING (true);

-- Permitir que apenas admins gerenciem authorized_emails (INSERT, UPDATE, DELETE)
CREATE POLICY "authorized_emails_manage_admins"
    ON authorized_emails FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
    );
