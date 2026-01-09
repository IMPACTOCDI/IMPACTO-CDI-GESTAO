-- CORREÇÃO CRÍTICA: Corrigir permissões do schema público e RLS
-- Execute este arquivo no SQL Editor do Supabase ANTES de qualquer outra coisa

-- ============================================
-- 1. GARANTIR PERMISSÕES DO SCHEMA PÚBLICO
-- ============================================

-- Garantir que a role 'anon' (usuários não autenticados) tenha acesso ao schema público
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Garantir que a role 'anon' possa executar funções no schema público
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO anon;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================
-- 2. GARANTIR PERMISSÕES NAS TABELAS
-- ============================================

-- Conceder permissões básicas nas tabelas para role anon
GRANT SELECT ON TABLE authorized_emails TO anon;
GRANT SELECT ON TABLE profiles TO anon;
GRANT INSERT ON TABLE profiles TO anon;

-- Conceder permissões para role authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE authorized_emails TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE profiles TO authenticated;

-- ============================================
-- 3. REMOVER E RECRIAR POLÍTICAS RLS
-- ============================================

-- Desabilitar RLS temporariamente para recriar políticas
ALTER TABLE authorized_emails DISABLE ROW LEVEL SECURITY;
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- Remover TODAS as políticas existentes
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Remover políticas de authorized_emails
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'authorized_emails') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON authorized_emails', r.policyname);
    END LOOP;
    
    -- Remover políticas de profiles
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'profiles') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', r.policyname);
    END LOOP;
END $$;

-- ============================================
-- 4. CRIAR POLÍTICAS SIMPLIFICADAS E FUNCIONAIS
-- ============================================

-- Reabilitar RLS
ALTER TABLE authorized_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Política para authorized_emails: PERMITIR SELECT PARA TODOS (incluindo não autenticados)
CREATE POLICY "anon_select_authorized_emails"
    ON authorized_emails FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "authenticated_select_authorized_emails"
    ON authorized_emails FOR SELECT
    TO authenticated
    USING (true);

-- Política para profiles: PERMITIR SELECT PARA TODOS
CREATE POLICY "anon_select_profiles"
    ON profiles FOR SELECT
    TO anon
    USING (true);

CREATE POLICY "authenticated_select_profiles"
    ON profiles FOR SELECT
    TO authenticated
    USING (true);

-- Política para profiles: PERMITIR INSERT durante registro
-- IMPORTANTE: Esta política permite INSERT mesmo sem autenticação, desde que o email esteja autorizado
CREATE POLICY "anon_insert_profiles"
    ON profiles FOR INSERT
    TO anon
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM authorized_emails
            WHERE authorized_emails.email = profiles.email
        )
    );

-- Política para profiles: PERMITIR INSERT para usuários autenticados
CREATE POLICY "authenticated_insert_profiles"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (
        auth.uid() = id
        AND EXISTS (
            SELECT 1 FROM authorized_emails
            WHERE authorized_emails.email = profiles.email
        )
    );

-- Política para profiles: PERMITIR UPDATE apenas para o próprio perfil
CREATE POLICY "authenticated_update_profiles"
    ON profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================
-- 5. VERIFICAR SE FUNCIONOU
-- ============================================

-- Verificar permissões do schema
SELECT 
    nspname as schema_name,
    nspacl as permissions
FROM pg_namespace 
WHERE nspname = 'public';

-- Verificar políticas criadas
SELECT tablename, policyname, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
AND tablename IN ('authorized_emails', 'profiles')
ORDER BY tablename, policyname;
