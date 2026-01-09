-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types if they don't exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('admin', 'manager', 'member', 'personal');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_status') THEN
        CREATE TYPE user_status AS ENUM ('active', 'pending', 'suspended');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_status') THEN
        CREATE TYPE project_status AS ENUM ('active', 'completed', 'on-hold');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
        CREATE TYPE task_status AS ENUM ('todo', 'doing', 'done');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
        CREATE TYPE task_priority AS ENUM ('low', 'medium', 'high');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'project_visibility') THEN
        CREATE TYPE project_visibility AS ENUM ('public', 'private');
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'calendar_event_type') THEN
        CREATE TYPE calendar_event_type AS ENUM ('event', 'task', 'project');
    END IF;
END $$;

-- Create profiles table (if not exists)
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL,
    avatar TEXT,
    organization_id UUID,
    department_id UUID,
    phone TEXT,
    location TEXT,
    bio TEXT,
    department TEXT,
    join_date DATE,
    status user_status DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create authorized_emails table (if not exists)
CREATE TABLE IF NOT EXISTS authorized_emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    status project_status DEFAULT 'active',
    color TEXT,
    visibility project_visibility DEFAULT 'private',
    start_date DATE NOT NULL,
    end_date DATE,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Primeiro, vamos remover a tabela existente e suas dependências
DROP TABLE IF EXISTS project_members CASCADE;

-- Agora criar a tabela com a estrutura correta
CREATE TABLE project_members (
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    PRIMARY KEY (project_id, user_id)
);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

-- Política para permitir que o criador do projeto adicione o primeiro membro
DROP POLICY IF EXISTS "Project creator can add first member" ON project_members;
CREATE POLICY "Project creator can add first member"
    ON project_members FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
    );

-- Política para visualização
DROP POLICY IF EXISTS "Project members are viewable by project members" ON project_members;
CREATE POLICY "Project members are viewable by project members"
    ON project_members FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND (
                projects.visibility = 'public'
                OR projects.created_by = auth.uid()
                OR project_members.user_id = auth.uid()
            )
        )
    );

-- Política para permitir que o criador do projeto gerencie membros
DROP POLICY IF EXISTS "Project creator can manage members" ON project_members;
CREATE POLICY "Project creator can manage members"
    ON project_members FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM projects
            WHERE projects.id = project_members.project_id
            AND projects.created_by = auth.uid()
        )
);

-- Recriar a política de visualização de projetos
CREATE POLICY "Projects are viewable by members"
    ON projects FOR SELECT
    USING (
        visibility = 'public'
        OR created_by = auth.uid()
        OR EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = projects.id
            AND project_members.user_id = auth.uid()
        )
    );

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    status task_status DEFAULT 'todo',
    priority task_priority DEFAULT 'medium',
    assigned_to UUID REFERENCES profiles(id),
    due_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create task_tags table
CREATE TABLE IF NOT EXISTS task_tags (
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    tag TEXT NOT NULL,
    PRIMARY KEY (task_id, tag)
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    author_id UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create calendar_events table
CREATE TABLE IF NOT EXISTS calendar_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT,
    date DATE NOT NULL,
    time TIME,
    type calendar_event_type NOT NULL,
    color TEXT,
    created_by UUID REFERENCES profiles(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Create RLS (Row Level Security) policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE authorized_emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY;

-- Recriar as políticas das tarefas
CREATE POLICY "Permitir criação de tarefas para membros do projeto"
    ON tasks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = tasks.project_id
            AND project_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Permitir leitura de tarefas para membros do projeto"
    ON tasks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = tasks.project_id
            AND project_members.user_id = auth.uid()
        )
    );

CREATE POLICY "Permitir atualização de tarefas para membros do projeto"
    ON tasks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM project_members
            WHERE project_members.project_id = tasks.project_id
            AND project_members.user_id = auth.uid()
        )
    );

-- Create policies
CREATE POLICY "Public profiles are viewable by everyone"
    ON profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (auth.uid() = id);

CREATE POLICY "Authorized emails are viewable by everyone"
    ON authorized_emails FOR SELECT
    USING (true);

CREATE POLICY "Only admins can manage authorized emails"
    ON authorized_emails FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.role = 'admin'
        )
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

-- Create functions
CREATE OR REPLACE FUNCTION user_has_permission(user_id UUID, permission TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = user_id
        AND role = permission::user_role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 