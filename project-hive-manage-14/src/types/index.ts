import { Database } from '@/integrations/supabase/types';
import { ExtendedTask, ExtendedProject, ExtendedComment, ExtendedProjectMember } from './supabase';

export type Task = ExtendedTask;
export type Project = ExtendedProject;
export type Comment = ExtendedComment;
export type ProjectMember = ExtendedProjectMember;
export type User = Database['public']['Tables']['profiles']['Row']; 