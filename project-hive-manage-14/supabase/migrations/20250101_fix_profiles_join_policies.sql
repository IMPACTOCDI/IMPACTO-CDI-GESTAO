-- Corrigir políticas para permitir joins com profiles
-- Execute este arquivo no SQL Editor do Supabase

-- ============================================
-- 1. VERIFICAR E CRIAR FOREIGN KEY SE NÃO EXISTIR
-- ============================================

-- Verificar se a foreign key tasks_assigned_to_fkey existe
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_constraint 
        WHERE conname = 'tasks_assigned_to_fkey'
    ) THEN
        -- Criar a foreign key se não existir
        ALTER TABLE tasks 
        ADD CONSTRAINT tasks_assigned_to_fkey 
        FOREIGN KEY (assigned_to) 
        REFERENCES profiles(id) 
        ON DELETE SET NULL;
    END IF;
END $$;

-- ============================================
-- 2. GARANTIR QUE POLÍTICAS DE PROFILES PERMITAM JOINS
-- ============================================

-- A política "Public profiles are viewable by everyone" já deve existir
-- Mas vamos garantir que ela permite acesso através de foreign keys

-- Verificar e recriar a política se necessário
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "anon_select_profiles" ON profiles;
DROP POLICY IF EXISTS "authenticated_select_profiles" ON profiles;

-- Política que permite SELECT para todos (incluindo através de joins)
CREATE POLICY "Public profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

-- ============================================
-- 3. VERIFICAR PERMISSÕES DO SCHEMA
-- ============================================

-- Garantir que authenticated tem permissão para fazer joins
GRANT SELECT ON TABLE profiles TO authenticated;
GRANT SELECT ON TABLE profiles TO anon;

-- ============================================
-- 4. VERIFICAR SE AS POLÍTICAS ESTÃO FUNCIONANDO
-- ============================================

-- Teste: Verificar se consegue fazer join
-- SELECT t.id, t.title, p.name 
-- FROM tasks t 
-- LEFT JOIN profiles p ON p.id = t.assigned_to 
-- LIMIT 1;
