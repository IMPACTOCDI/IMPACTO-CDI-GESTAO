-- Create contacts table
CREATE TABLE IF NOT EXISTS contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    company TEXT,
    position TEXT,
    notes TEXT,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create project_contacts table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS project_contacts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
    role TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(project_id, contact_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contacts_created_by ON contacts(created_by);
CREATE INDEX IF NOT EXISTS idx_contacts_deleted_at ON contacts(deleted_at);
CREATE INDEX IF NOT EXISTS idx_project_contacts_project_id ON project_contacts(project_id);
CREATE INDEX IF NOT EXISTS idx_project_contacts_contact_id ON project_contacts(contact_id);

-- Enable RLS
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_contacts ENABLE ROW LEVEL SECURITY;

-- Policies for contacts
DROP POLICY IF EXISTS "Users can view their own contacts" ON contacts;
CREATE POLICY "Users can view their own contacts"
    ON contacts FOR SELECT
    USING (
        created_by = auth.uid() OR
        EXISTS (
            SELECT 1 FROM project_contacts pc
            JOIN project_members pm ON pc.project_id = pm.project_id
            WHERE pc.contact_id = contacts.id
            AND pm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create contacts" ON contacts;
CREATE POLICY "Users can create contacts"
    ON contacts FOR INSERT
    WITH CHECK (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can update their own contacts" ON contacts;
CREATE POLICY "Users can update their own contacts"
    ON contacts FOR UPDATE
    USING (created_by = auth.uid());

DROP POLICY IF EXISTS "Users can delete their own contacts" ON contacts;
CREATE POLICY "Users can delete their own contacts"
    ON contacts FOR DELETE
    USING (created_by = auth.uid());

-- Policies for project_contacts
DROP POLICY IF EXISTS "Users can view project contacts for projects they are members of" ON project_contacts;
CREATE POLICY "Users can view project contacts for projects they are members of"
    ON project_contacts FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_contacts.project_id
            AND pm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can create project contacts for projects they are members of" ON project_contacts;
CREATE POLICY "Users can create project contacts for projects they are members of"
    ON project_contacts FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_contacts.project_id
            AND pm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can update project contacts for projects they are members of" ON project_contacts;
CREATE POLICY "Users can update project contacts for projects they are members of"
    ON project_contacts FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_contacts.project_id
            AND pm.user_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Users can delete project contacts for projects they are members of" ON project_contacts;
CREATE POLICY "Users can delete project contacts for projects they are members of"
    ON project_contacts FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = project_contacts.project_id
            AND pm.user_id = auth.uid()
        )
    );

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_contacts_updated_at ON contacts;
CREATE TRIGGER update_contacts_updated_at
    BEFORE UPDATE ON contacts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


