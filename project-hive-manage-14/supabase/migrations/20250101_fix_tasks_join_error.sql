-- Corrigir erro 500 nas queries de tasks com joins
-- Execute este arquivo no SQL Editor do Supabase

-- ============================================
-- 1. VERIFICAR E CRIAR FOREIGN KEY
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
        
        RAISE NOTICE 'Foreign key tasks_assigned_to_fkey criada';
    ELSE
        RAISE NOTICE 'Foreign key tasks_assigned_to_fkey já existe';
    END IF;
END $$;

-- ============================================
-- 2. GARANTIR QUE PROFILES PERMITE JOINS
-- ============================================

-- Remover políticas conflitantes de profiles
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "anon_select_profiles" ON profiles;
DROP POLICY IF EXISTS "authenticated_select_profiles" ON profiles;

-- Criar política simples que permite SELECT para todos (necessário para joins)
CREATE POLICY "profiles_select_all"
    ON profiles FOR SELECT
    USING (true);

-- Garantir permissões
GRANT SELECT ON TABLE profiles TO authenticated;
GRANT SELECT ON TABLE profiles TO anon;

-- ============================================
-- 3. SIMPLIFICAR POLÍTICAS DE TASKS PARA EVITAR ERROS
-- ============================================

-- Remover políticas existentes de tasks
DROP POLICY IF EXISTS "tasks_select_accessible" ON tasks;
DROP POLICY IF EXISTS "tasks_insert_accessible" ON tasks;
DROP POLICY IF EXISTS "tasks_update_accessible" ON tasks;
DROP POLICY IF EXISTS "tasks_delete_accessible" ON tasks;

-- Política simplificada para SELECT (permite joins sem problemas)
CREATE POLICY "tasks_select_accessible"
    ON tasks FOR SELECT
    TO authenticated
    USING (
        -- Pode ver tarefas de projetos que criou
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.created_by = auth.uid()
        )
        -- OU tarefas de projetos públicos
        OR EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.visibility = 'public'::project_visibility
        )
        -- OU tarefas atribuídas a ele (mesmo sem ser membro)
        OR tasks.assigned_to = auth.uid()
    );

-- Políticas para INSERT, UPDATE, DELETE (mantém segurança)
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
-- 4. VERIFICAR SE FUNCIONOU
-- ============================================

-- Teste: Verificar se consegue fazer join
-- SELECT t.id, t.title, p.name 
-- FROM tasks t 
-- LEFT JOIN profiles p ON p.id = t.assigned_to 
-- WHERE t.assigned_to = auth.uid()
-- LIMIT 1;
