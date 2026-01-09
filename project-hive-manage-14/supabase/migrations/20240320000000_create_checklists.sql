CREATE TABLE IF NOT EXISTS checklists (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create checklist_items table
CREATE TABLE IF NOT EXISTS checklist_items (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    checklist_id UUID REFERENCES checklists(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    completed_at TIMESTAMP WITH TIME ZONE,
    order_index INTEGER DEFAULT 0,
    deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_checklists_task_id ON checklists(task_id);
CREATE INDEX IF NOT EXISTS idx_checklist_items_checklist_id ON checklist_items(checklist_id);

-- Add RLS policies
ALTER TABLE checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items ENABLE ROW LEVEL SECURITY;

-- Policies for checklists
DROP POLICY IF EXISTS "Users can view checklists for tasks they have access to" ON checklists;
CREATE POLICY "Users can view checklists for tasks they have access to"
    ON checklists FOR SELECT
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM tasks t
            JOIN project_members pm ON t.project_id = pm.project_id
            WHERE t.id = checklists.task_id
            AND pm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create checklists for tasks they have access to" ON checklists;
CREATE POLICY "Users can create checklists for tasks they have access to"
    ON checklists FOR INSERT
    WITH CHECK (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM tasks t
            JOIN project_members pm ON t.project_id = pm.project_id
            WHERE t.id = checklists.task_id
            AND pm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update checklists for tasks they have access to" ON checklists;
CREATE POLICY "Users can update checklists for tasks they have access to"
    ON checklists FOR UPDATE
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM tasks t
            JOIN project_members pm ON t.project_id = pm.project_id
            WHERE t.id = checklists.task_id
            AND pm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete checklists for tasks they have access to" ON checklists;
CREATE POLICY "Users can delete checklists for tasks they have access to"
    ON checklists FOR DELETE
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM tasks t
            JOIN project_members pm ON t.project_id = pm.project_id
            WHERE t.id = checklists.task_id
            AND pm.user_id = auth.uid()
        )
    );

-- Policies for checklist_items
DROP POLICY IF EXISTS "Users can view checklist items for tasks they have access to" ON checklist_items;
CREATE POLICY "Users can view checklist items for tasks they have access to"
    ON checklist_items FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM checklists c
            WHERE c.id = checklist_items.checklist_id
            AND (
                c.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM tasks t
                    JOIN project_members pm ON t.project_id = pm.project_id
                    WHERE t.id = c.task_id
                    AND pm.user_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can create checklist items for tasks they have access to" ON checklist_items;
CREATE POLICY "Users can create checklist items for tasks they have access to"
    ON checklist_items FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM checklists c
            WHERE c.id = checklist_items.checklist_id
            AND (
                c.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM tasks t
                    JOIN project_members pm ON t.project_id = pm.project_id
                    WHERE t.id = c.task_id
                    AND pm.user_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can update checklist items for tasks they have access to" ON checklist_items;
CREATE POLICY "Users can update checklist items for tasks they have access to"
    ON checklist_items FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM checklists c
            WHERE c.id = checklist_items.checklist_id
            AND (
                c.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM tasks t
                    JOIN project_members pm ON t.project_id = pm.project_id
                    WHERE t.id = c.task_id
                    AND pm.user_id = auth.uid()
                )
            )
        )
    );

DROP POLICY IF EXISTS "Users can delete checklist items for tasks they have access to" ON checklist_items;
CREATE POLICY "Users can delete checklist items for tasks they have access to"
    ON checklist_items FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM checklists c
            WHERE c.id = checklist_items.checklist_id
            AND (
                c.created_by = auth.uid() OR
                EXISTS (
                    SELECT 1 FROM tasks t
                    JOIN project_members pm ON t.project_id = pm.project_id
                    WHERE t.id = c.task_id
                    AND pm.user_id = auth.uid()
                )
            )
        )
    );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
DROP TRIGGER IF EXISTS update_checklists_updated_at ON checklists;
CREATE TRIGGER update_checklists_updated_at
    BEFORE UPDATE ON checklists
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_checklist_items_updated_at ON checklist_items;
CREATE TRIGGER update_checklist_items_updated_at
    BEFORE UPDATE ON checklist_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 