import { Database } from '@/integrations/supabase/types';

export type ProfileQuery = {
  id: string;
  name: string | null;
  email: string;
  role: string;
  created_at: string;
  updated_at: string;
};

export type ProjectQuery = {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  project_members: Array<{
    id: string;
    project_id: string;
    user_id: string;
    role: string;
    created_at: string;
    updated_at: string;
    profiles: ProfileQuery | null;
  }>;
  tasks: Array<{
    id: string;
    project_id: string;
    title: string;
    description: string | null;
    status: string;
    priority: string;
    due_date: string | null;
    assigned_to: string | null;
    created_by: string;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    task_tags: Array<{
      id: string;
      task_id: string;
      tag: string;
      created_at: string;
      updated_at: string;
    }>;
    comments: Array<{
      id: string;
      task_id: string;
      project_id: string;
      content: string;
      created_by: string;
      created_at: string;
      updated_at: string;
      deleted_at: string | null;
      profiles: ProfileQuery | null;
    }>;
  }>;
  creator: ProfileQuery | null;
}; 