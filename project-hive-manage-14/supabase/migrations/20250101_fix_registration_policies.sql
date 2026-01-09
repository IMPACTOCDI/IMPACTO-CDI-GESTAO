-- Corrigir políticas para permitir registro de usuários
-- Execute este arquivo no SQL Editor do Supabase

-- IMPORTANTE: Este script remove TODAS as políticas conflitantes e cria novas políticas corretas

-- ============================================
-- 1. REMOVER TODAS AS POLÍTICAS EXISTENTES
-- ============================================

-- Remover políticas de authorized_emails
DROP POLICY IF EXISTS "Authorized emails are viewable by everyone" ON authorized_emails;
DROP POLICY IF EXISTS "Allow email verification during registration" ON authorized_emails;
DROP POLICY IF EXISTS "Only admins can manage authorized emails" ON authorized_emails;

-- Remover políticas de profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Allow profile creation during registration" ON profiles;
DROP POLICY IF EXISTS "Enable insert for users based on id" ON profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by users themselves" ON profiles;
DROP POLICY IF EXISTS "Admins can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins and managers can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins and managers can manage all profiles" ON profiles;
DROP POLICY IF EXISTS "Enable delete for admins and managers" ON profiles;

-- ============================================
-- 2. CRIAR POLÍTICAS CORRETAS PARA authorized_emails
-- ============================================

-- Permitir que QUALQUER pessoa (incluindo não autenticados) possa VER authorized_emails
-- Isso é necessário para verificar se um email está autorizado durante o registro
CREATE POLICY "Authorized emails are viewable by everyone"
    ON authorized_emails FOR SELECT
    USING (true);

-- Permitir que apenas admins gerenciem authorized_emails (INSERT, UPDATE, DELETE)
CREATE POLICY "Only admins can manage authorized emails"
    ON authorized_emails FOR ALL
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

-- ============================================
-- 3. CRIAR POLÍTICAS CORRETAS PARA profiles
-- ============================================

-- Permitir que QUALQUER pessoa (incluindo não autenticados) possa VER profiles
-- Isso é necessário para verificar se um email já está registrado
CREATE POLICY "Public profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

-- Permitir criação de perfil durante registro
-- IMPORTANTE: Esta política permite INSERT mesmo para usuários não autenticados
-- desde que o email esteja na lista de autorizados
CREATE POLICY "Allow profile creation during registration"
    ON profiles FOR INSERT
    WITH CHECK (
        -- Verifica se o email está autorizado
        EXISTS (
            SELECT 1 FROM authorized_emails
            WHERE authorized_emails.email = profiles.email
        )
    );

-- Permitir que usuários atualizem seu próprio perfil
CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================
-- 4. GARANTIR QUE RLS ESTÁ HABILITADO
-- ============================================

ALTER TABLE authorized_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 5. VERIFICAR POLÍTICAS CRIADAS (OPCIONAL)
-- ============================================

-- Descomente para verificar as políticas criadas:
-- SELECT tablename, policyname, cmd, qual 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- AND tablename IN ('authorized_emails', 'profiles')
-- ORDER BY tablename, policyname;
