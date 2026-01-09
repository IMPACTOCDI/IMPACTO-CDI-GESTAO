-- Simplificar e corrigir TODAS as políticas RLS
-- Execute este arquivo no SQL Editor do Supabase

-- ============================================
-- 1. REMOVER TODAS AS POLÍTICAS EXISTENTES
-- ============================================

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    ) 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', r.policyname, r.tablename);
    END LOOP;
END $$;

-- ============================================
-- 2. GARANTIR PERMISSÕES BÁSICAS
-- ============================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON TABLE profiles TO anon;
GRANT SELECT ON TABLE authorized_emails TO anon;
GRANT INSERT ON TABLE profiles TO anon;

-- ============================================
-- 3. POLÍTICAS SIMPLIFICADAS PARA PROFILES
-- ============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_all"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "profiles_insert_authenticated"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_insert_anon_authorized"
    ON profiles FOR INSERT
    TO anon
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM authorized_emails
            WHERE authorized_emails.email = profiles.email
        )
    );

CREATE POLICY "profiles_update_own"
    ON profiles FOR UPDATE
    TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================
-- 4. POLÍTICAS SIMPLIFICADAS PARA AUTHORIZED_EMAILS
-- ============================================

ALTER TABLE authorized_emails ENABLE ROW LEVEL SECURITY;

CREATE POLICY "authorized_emails_select_all"
    ON authorized_emails FOR SELECT
    USING (true);

-- ============================================
-- 5. POLÍTICAS SIMPLIFICADAS PARA PROJECTS
-- ============================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "projects_select_accessible"
    ON projects FOR SELECT
    TO authenticated
    USING (
        created_by = auth.uid()
        OR visibility = 'public'::project_visibility
        OR EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
        )
    );

CREATE POLICY "projects_insert_own"
    ON projects FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "projects_update_own"
    ON projects FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "projects_delete_own"
    ON projects FOR DELETE
    TO authenticated
    USING (created_by = auth.uid());

-- ============================================
-- 6. POLÍTICAS SIMPLIFICADAS PARA PROJECT_MEMBERS
-- ============================================

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Política simplificada para evitar recursão infinita
-- Usuários podem ver membros de projetos que criaram OU se são membros
CREATE POLICY "project_members_select_accessible"
    ON project_members FOR SELECT
    TO authenticated
    USING (
        -- Pode ver se é o próprio membro
        user_id = auth.uid()
        -- OU se é o criador do projeto (sem recursão)
        OR EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
        -- OU se o projeto é público
        OR EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.visibility = 'public'::project_visibility
        )
    );

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

CREATE POLICY "project_members_update_creator"
    ON project_members FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
    );

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
-- 7. POLÍTICAS SIMPLIFICADAS PARA TASKS
-- ============================================

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tasks_select_accessible"
    ON tasks FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND (
                projects.created_by = auth.uid()
                OR projects.visibility = 'public'::project_visibility
                OR EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_members.project_id = tasks.project_id
                    AND project_members.user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "tasks_insert_accessible"
    ON tasks FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_members.project_id = tasks.project_id
                    AND project_members.user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "tasks_update_accessible"
    ON tasks FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_members.project_id = tasks.project_id
                    AND project_members.user_id = auth.uid()
                )
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_members.project_id = tasks.project_id
                    AND project_members.user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "tasks_delete_accessible"
    ON tasks FOR DELETE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_members.project_id = tasks.project_id
                    AND project_members.user_id = auth.uid()
                )
            )
        )
    );

-- ============================================
-- 8. POLÍTICAS SIMPLIFICADAS PARA TASK_TAGS
-- ============================================

ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_tags_all_accessible"
    ON task_tags FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = task_tags.task_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_members.project_id = tasks.project_id
                    AND project_members.user_id = auth.uid()
                )
            )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = task_tags.task_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_members.project_id = tasks.project_id
                    AND project_members.user_id = auth.uid()
                )
            )
        )
    );

-- ============================================
-- 9. POLÍTICAS SIMPLIFICADAS PARA COMMENTS
-- ============================================

ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select_accessible"
    ON comments FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = comments.task_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_members.project_id = tasks.project_id
                    AND project_members.user_id = auth.uid()
                )
            )
        )
    );

CREATE POLICY "comments_insert_accessible"
    ON comments FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = comments.task_id
            AND (
                projects.created_by = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members
                    WHERE project_members.project_id = tasks.project_id
                    AND project_members.user_id = auth.uid()
                )
            )
        )
        AND created_by = auth.uid()
    );

CREATE POLICY "comments_update_own"
    ON comments FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

CREATE POLICY "comments_delete_own_or_project"
    ON comments FOR DELETE
    TO authenticated
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = comments.task_id
            AND projects.created_by = auth.uid()
        )
    );
