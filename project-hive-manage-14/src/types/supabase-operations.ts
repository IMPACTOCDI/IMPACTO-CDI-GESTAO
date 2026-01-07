import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';

export type SupabaseClientType = SupabaseClient<Database>;

export type ProjectRow = Database['public']['Tables']['projects']['Row'];
export type TaskRow = Database['public']['Tables']['tasks']['Row'];
export type CommentRow = Database['public']['Tables']['comments']['Row'];
export type ProjectMemberRow = Database['public']['Tables']['project_members']['Row'];
export type ProfileRow = Database['public']['Tables']['profiles']['Row'];
export type TaskTagRow = Database['public']['Tables']['task_tags']['Row'];

export type ProjectInsert = Database['public']['Tables']['projects']['Insert'];
export type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
export type CommentInsert = Database['public']['Tables']['comments']['Insert'];
export type ProjectMemberInsert = Database['public']['Tables']['project_members']['Insert'];
export type ProfileInsert = Database['public']['Tables']['profiles']['Insert'];
export type TaskTagInsert = Database['public']['Tables']['task_tags']['Insert'];

export type ProjectUpdate = Database['public']['Tables']['projects']['Update'];
export type TaskUpdate = Database['public']['Tables']['tasks']['Update'];
export type CommentUpdate = Database['public']['Tables']['comments']['Update'];
export type ProjectMemberUpdate = Database['public']['Tables']['project_members']['Update'];
export type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
export type TaskTagUpdate = Database['public']['Tables']['task_tags']['Update']; 