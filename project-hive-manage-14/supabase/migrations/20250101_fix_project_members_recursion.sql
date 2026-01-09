-- CORRIGIR RECURSÃO INFINITA EM project_members
-- Execute este arquivo no SQL Editor do Supabase

-- ============================================
-- 1. REMOVER TODAS AS POLÍTICAS DE project_members
-- ============================================

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'project_members'
    ) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON project_members', r.policyname);
    END LOOP;
END $$;

-- ============================================
-- 2. CRIAR POLÍTICAS SIMPLES SEM RECURSÃO
-- ============================================

-- IMPORTANTE: Esta política NÃO verifica project_members para evitar recursão
-- Política de SELECT: MUITO SIMPLES para evitar recursão
-- Permite ver project_members se:
-- 1. Você é o próprio membro (user_id = auth.uid())
-- 2. Você é o criador do projeto (sem verificar project_members)
-- 3. O projeto é público (sem verificar project_members)
CREATE POLICY "project_members_select_simple"
    ON project_members FOR SELECT
    TO authenticated
    USING (
        -- Pode ver se é o próprio membro (sem recursão)
        user_id = auth.uid()
        -- OU se é o criador do projeto (sem recursão - verifica apenas projects)
        OR EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
        -- OU se o projeto é público (sem recursão)
        OR EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.visibility = 'public'::project_visibility
        )
    );

-- ============================================
-- 2.1. CRIAR FUNÇÃO HELPER PARA EVITAR RECURSÃO
-- ============================================

-- Função que verifica se usuário é membro do projeto
-- SECURITY DEFINER permite bypassar RLS para evitar recursão
CREATE OR REPLACE FUNCTION is_project_member(project_id uuid, user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM project_members
        WHERE project_members.project_id = is_project_member.project_id
        AND project_members.user_id = is_project_member.user_id
    );
$$;

-- ============================================
-- 2.2. CORRIGIR POLÍTICA DE PROJECTS
-- ============================================

-- Remover política de projects que verifica project_members (causa recursão)
DROP POLICY IF EXISTS "projects_select_accessible" ON projects;

-- Criar política que usa a função helper (sem recursão)
CREATE POLICY "projects_select_accessible"
    ON projects FOR SELECT
    TO authenticated
    USING (
        -- Pode ver projetos que criou
        created_by = auth.uid()
        -- OU projetos públicos
        OR visibility = 'public'::project_visibility
        -- OU se é membro (usando função que bypassa RLS)
        OR is_project_member(projects.id, auth.uid())
    );

-- Política de INSERT: apenas criadores podem adicionar membros
CREATE POLICY "project_members_insert_creator"
    ON project_members FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
    );

-- Política de UPDATE: apenas criadores podem atualizar
CREATE POLICY "project_members_update_creator"
    ON project_members FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
    );

-- Política de DELETE: apenas criadores podem remover
CREATE POLICY "project_members_delete_creator"
    ON project_members FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
    );

-- ============================================
-- 3. GARANTIR QUE RLS ESTÁ HABILITADO
-- ============================================

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 4. VERIFICAR POLÍTICAS CRIADAS
-- ============================================

-- SELECT tablename, policyname, cmd 
-- FROM pg_policies 
-- WHERE schemaname = 'public' 
-- AND tablename = 'project_members'
-- ORDER BY policyname;
