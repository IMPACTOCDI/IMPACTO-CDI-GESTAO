import { Database } from '@/integrations/supabase/types';

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: 'todo' | 'doing' | 'done';
  priority: 'low' | 'medium' | 'high';
  due_date: string | null;
  project_id: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  assigned_profile?: {
    id: string;
    name: string;
  };
  tags?: string[];
  comments?: {
    id: string;
    content: string;
    created_at: string;
    profiles: {
      id: string;
      name: string;
    };
  }[];
} 