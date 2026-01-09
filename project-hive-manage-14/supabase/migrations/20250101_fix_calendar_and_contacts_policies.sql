-- Corrigir políticas para calendar_events e contacts
-- Execute este arquivo no SQL Editor do Supabase

-- ============================================
-- 1. REMOVER POLÍTICAS EXISTENTES
-- ============================================

-- Remover políticas de calendar_events
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'calendar_events'
    ) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON calendar_events', r.policyname);
    END LOOP;
END $$;

-- Remover políticas de contacts
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'contacts'
    ) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON contacts', r.policyname);
    END LOOP;
END $$;

-- Remover políticas de project_contacts
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'project_contacts'
    ) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON project_contacts', r.policyname);
    END LOOP;
END $$;

-- ============================================
-- 2. GARANTIR PERMISSÕES
-- ============================================

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE calendar_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE contacts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE project_contacts TO authenticated;

-- ============================================
-- 3. POLÍTICAS PARA CALENDAR_EVENTS
-- ============================================

ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ver eventos que criaram
CREATE POLICY "calendar_events_select_own"
    ON calendar_events FOR SELECT
    TO authenticated
    USING (created_by = auth.uid());

-- Usuários autenticados podem criar eventos
CREATE POLICY "calendar_events_insert_own"
    ON calendar_events FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

-- Usuários autenticados podem atualizar seus próprios eventos
CREATE POLICY "calendar_events_update_own"
    ON calendar_events FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Usuários autenticados podem deletar seus próprios eventos
CREATE POLICY "calendar_events_delete_own"
    ON calendar_events FOR DELETE
    TO authenticated
    USING (created_by = auth.uid());

-- ============================================
-- 4. POLÍTICAS PARA CONTACTS
-- ============================================

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ver contatos que criaram
CREATE POLICY "contacts_select_own"
    ON contacts FOR SELECT
    TO authenticated
    USING (created_by = auth.uid());

-- Usuários autenticados podem criar contatos
CREATE POLICY "contacts_insert_own"
    ON contacts FOR INSERT
    TO authenticated
    WITH CHECK (created_by = auth.uid());

-- Usuários autenticados podem atualizar seus próprios contatos
CREATE POLICY "contacts_update_own"
    ON contacts FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Usuários autenticados podem deletar seus próprios contatos
CREATE POLICY "contacts_delete_own"
    ON contacts FOR DELETE
    TO authenticated
    USING (created_by = auth.uid());

-- ============================================
-- 5. POLÍTICAS PARA PROJECT_CONTACTS
-- ============================================

ALTER TABLE project_contacts ENABLE ROW LEVEL SECURITY;

-- Usuários autenticados podem ver project_contacts de projetos que têm acesso
CREATE POLICY "project_contacts_select_accessible"
    ON project_contacts FOR SELECT
    TO authenticated
    USING (
        -- Pode ver se é o criador do projeto
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_contacts.project_id
            AND projects.created_by = auth.uid()
        )
        -- OU se é membro do projeto (usando função helper)
        OR is_project_member(project_contacts.project_id, auth.uid())
    );

-- Usuários autenticados podem criar project_contacts em projetos que têm acesso
CREATE POLICY "project_contacts_insert_accessible"
    ON project_contacts FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_contacts.project_id
            AND projects.created_by = auth.uid()
        )
        OR is_project_member(project_contacts.project_id, auth.uid())
    );

-- Usuários autenticados podem atualizar project_contacts de projetos que têm acesso
CREATE POLICY "project_contacts_update_accessible"
    ON project_contacts FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_contacts.project_id
            AND projects.created_by = auth.uid()
        )
        OR is_project_member(project_contacts.project_id, auth.uid())
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_contacts.project_id
            AND projects.created_by = auth.uid()
        )
        OR is_project_member(project_contacts.project_id, auth.uid())
    );

-- Usuários autenticados podem deletar project_contacts de projetos que têm acesso
CREATE POLICY "project_contacts_delete_accessible"
    ON project_contacts FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_contacts.project_id
            AND projects.created_by = auth.uid()
        )
        OR is_project_member(project_contacts.project_id, auth.uid())
    );
