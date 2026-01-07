import { Database } from '@/integrations/supabase/types';

export type Checklist = Database['public']['Tables']['checklists']['Row'] & {
  items?: ChecklistItem[];
  tasks?: {
    id: string;
    title: string;
    project_id: string;
    projects: {
      id: string;
      name: string;
    };
  };
};

export type ChecklistItem = Database['public']['Tables']['checklist_items']['Row'];

export interface CreateChecklistData {
  title: string;
  task_id: string;
}

export interface CreateChecklistItemData {
  text: string;
  checklist_id: string;
  order_index?: number;
}

export interface UpdateChecklistItemData {
  text?: string;
  completed?: boolean;
  order_index?: number;
} 