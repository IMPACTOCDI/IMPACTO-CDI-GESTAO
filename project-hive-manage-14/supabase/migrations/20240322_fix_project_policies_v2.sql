-- Remover todas as políticas existentes
DROP POLICY IF EXISTS "Projects are viewable by members" ON projects;
DROP POLICY IF EXISTS "Users can create projects" ON projects;
DROP POLICY IF EXISTS "Users can update own projects" ON projects;
DROP POLICY IF EXISTS "Project members are viewable by project members" ON project_members;
DROP POLICY IF EXISTS "Project members can be managed by project creators and admins" ON project_members;
DROP POLICY IF EXISTS "Tasks are viewable by project members" ON tasks;
DROP POLICY IF EXISTS "Tasks can be created by project members" ON tasks;
DROP POLICY IF EXISTS "Tasks can be updated by project members" ON tasks;
DROP POLICY IF EXISTS "Task tags are viewable by project members" ON task_tags;
DROP POLICY IF EXISTS "Task tags can be managed by project members" ON task_tags;
DROP POLICY IF EXISTS "Comments are viewable by project members" ON comments;
DROP POLICY IF EXISTS "Comments can be created by project members" ON comments;
DROP POLICY IF EXISTS "Comments can be updated by their authors" ON comments;
DROP POLICY IF EXISTS "Comments can be deleted by their authors and project admins" ON comments;

-- Políticas simplificadas para projects
CREATE POLICY "Projects are viewable by members"
    ON projects FOR SELECT
    USING (
        visibility = 'public'::project_visibility
        OR created_by = auth.uid()
    );

CREATE POLICY "Users can create projects"
    ON projects FOR INSERT
    WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update own projects"
    ON projects FOR UPDATE
    USING (
        created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Políticas simplificadas para project_members
CREATE POLICY "Project members are viewable by project members"
    ON project_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND (
                projects.visibility = 'public'::project_visibility
                OR projects.created_by = auth.uid()
            )
        )
    );

CREATE POLICY "Project members can be managed by project creators and admins"
    ON project_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    );

-- Políticas simplificadas para tasks
CREATE POLICY "Tasks are viewable by project members"
    ON tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND (
                projects.visibility = 'public'::project_visibility
                OR projects.created_by = auth.uid()
            )
        )
    );

CREATE POLICY "Tasks can be created by project members"
    ON tasks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.created_by = auth.uid()
        )
    );

CREATE POLICY "Tasks can be updated by project members"
    ON tasks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = tasks.project_id
            AND projects.created_by = auth.uid()
        )
    );

-- Políticas simplificadas para task_tags
CREATE POLICY "Task tags are viewable by project members"
    ON task_tags FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = task_tags.task_id
            AND (
                projects.visibility = 'public'::project_visibility
                OR projects.created_by = auth.uid()
            )
        )
    );

CREATE POLICY "Task tags can be managed by project creators"
    ON task_tags FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = task_tags.task_id
            AND projects.created_by = auth.uid()
        )
    );

-- Políticas simplificadas para comments
CREATE POLICY "Comments are viewable by project members"
    ON comments FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = comments.task_id
            AND (
                projects.visibility = 'public'::project_visibility
                OR projects.created_by = auth.uid()
            )
        )
    );

CREATE POLICY "Comments can be created by project members"
    ON comments FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = comments.task_id
            AND projects.created_by = auth.uid()
        )
    );

CREATE POLICY "Comments can be updated by their authors"
    ON comments FOR UPDATE
    USING (author_id = auth.uid());

CREATE POLICY "Comments can be deleted by their authors and project admins"
    ON comments FOR DELETE
    USING (
        author_id = auth.uid()
        OR EXISTS (
            SELECT 1 FROM tasks
            JOIN projects ON projects.id = tasks.project_id
            WHERE tasks.id = comments.task_id
            AND projects.created_by = auth.uid()
        )
        OR EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role IN ('admin', 'manager')
        )
    ); 