-- Corrigir políticas para tasks, projects e project_members
-- Execute este arquivo no SQL Editor do Supabase

-- ============================================
-- 1. GARANTIR PERMISSÕES NAS TABELAS
-- ============================================

-- Conceder permissões básicas para role authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE projects TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE project_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE tasks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE task_tags TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE comments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE calendar_events TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE checklists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE checklist_items TO authenticated;

-- ============================================
-- 2. REMOVER POLÍTICAS CONFLITANTES
-- ============================================

-- Remover todas as políticas existentes de projects
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'projects') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON projects', r.policyname);
    END LOOP;
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'project_members') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON project_members', r.policyname);
    END LOOP;
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'tasks') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON tasks', r.policyname);
    END LOOP;
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'task_tags') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON task_tags', r.policyname);
    END LOOP;
    
    FOR r IN (SELECT policyname FROM pg_policies WHERE schemaname = 'public' AND tablename = 'comments') 
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON comments', r.policyname);
    END LOOP;
END $$;

-- ============================================
-- 3. CRIAR POLÍTICAS PARA PROJECTS
-- ============================================

-- Usuários autenticados podem ver projetos que criaram ou são membros
CREATE POLICY "authenticated_select_projects"
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

-- Usuários autenticados podem criar projetos
CREATE POLICY "authenticated_insert_projects"
    ON projects FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = created_by);

-- Usuários autenticados podem atualizar projetos que criaram
CREATE POLICY "authenticated_update_projects"
    ON projects FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Usuários autenticados podem deletar projetos que criaram
CREATE POLICY "authenticated_delete_projects"
    ON projects FOR DELETE
    TO authenticated
    USING (created_by = auth.uid());

-- ============================================
-- 4. CRIAR POLÍTICAS PARA PROJECT_MEMBERS
-- ============================================

-- Usuários autenticados podem ver membros de projetos que têm acesso
CREATE POLICY "authenticated_select_project_members"
    ON project_members FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND (
                projects.created_by = auth.uid()
                OR project_members.user_id = auth.uid()
                OR EXISTS (
                    SELECT 1 FROM project_members pm2
                    WHERE pm2.project_id = project_members.project_id
                    AND pm2.user_id = auth.uid()
                )
            )
        )
    );

-- Criadores de projetos podem adicionar membros
CREATE POLICY "authenticated_insert_project_members"
    ON project_members FOR INSERT
    TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
    );

-- Criadores de projetos podem atualizar membros
CREATE POLICY "authenticated_update_project_members"
    ON project_members FOR UPDATE
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
    );

-- Criadores de projetos podem remover membros
CREATE POLICY "authenticated_delete_project_members"
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
-- 5. CRIAR POLÍTICAS PARA TASKS
-- ============================================

-- Usuários autenticados podem ver tarefas de projetos que têm acesso
CREATE POLICY "authenticated_select_tasks"
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

-- Usuários autenticados podem criar tarefas em projetos que têm acesso
CREATE POLICY "authenticated_insert_tasks"
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

-- Usuários autenticados podem atualizar tarefas de projetos que têm acesso
CREATE POLICY "authenticated_update_tasks"
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

-- Usuários autenticados podem deletar tarefas de projetos que têm acesso
CREATE POLICY "authenticated_delete_tasks"
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
-- 6. CRIAR POLÍTICAS PARA TASK_TAGS
-- ============================================

-- Usuários autenticados podem ver tags de tarefas que têm acesso
CREATE POLICY "authenticated_select_task_tags"
    ON task_tags FOR SELECT
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
    );

-- Usuários autenticados podem gerenciar tags de tarefas que têm acesso
CREATE POLICY "authenticated_manage_task_tags"
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
-- 7. CRIAR POLÍTICAS PARA COMMENTS
-- ============================================

-- Usuários autenticados podem ver comentários de tarefas que têm acesso
CREATE POLICY "authenticated_select_comments"
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

-- Usuários autenticados podem criar comentários em tarefas que têm acesso
CREATE POLICY "authenticated_insert_comments"
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

-- Usuários autenticados podem atualizar seus próprios comentários
CREATE POLICY "authenticated_update_comments"
    ON comments FOR UPDATE
    TO authenticated
    USING (created_by = auth.uid())
    WITH CHECK (created_by = auth.uid());

-- Usuários autenticados podem deletar seus próprios comentários ou comentários de projetos que criaram
CREATE POLICY "authenticated_delete_comments"
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

-- ============================================
-- 8. GARANTIR QUE RLS ESTÁ HABILITADO
-- ============================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
