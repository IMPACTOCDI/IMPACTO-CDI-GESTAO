import { GenericSchema } from '@supabase/supabase-js';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database extends GenericSchema {
  public: {
    Tables: {
      comments: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          content: string
          task_id: string
          user_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          content: string
          task_id: string
          user_id: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          content?: string
          task_id?: string
          user_id?: string
        }
      }
      profiles: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          email: string
          full_name: string
          avatar_url: string | null
          role: string
          status: string
        }
        Insert: {
          id: string
          created_at?: string
          updated_at?: string
          email: string
          full_name: string
          avatar_url?: string | null
          role: string
          status: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          email?: string
          full_name?: string
          avatar_url?: string | null
          role?: string
          status?: string
        }
      }
      project_members: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          project_id: string
          user_id: string
          role: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          project_id: string
          user_id: string
          role?: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          project_id?: string
          user_id?: string
          role?: string
        }
      }
      projects: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          name: string
          description: string | null
          created_by: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          name: string
          description?: string | null
          created_by: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          name?: string
          description?: string | null
          created_by?: string
          deleted_at?: string | null
        }
      }
      task_tags: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          name: string
          color: string
          project_id: string
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          name: string
          color: string
          project_id: string
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          name?: string
          color?: string
          project_id?: string
        }
      }
      tasks: {
        Row: {
          id: string
          created_at: string
          updated_at: string
          title: string
          description: string | null
          status: string
          priority: string
          due_date: string | null
          project_id: string
          assigned_to: string | null
          created_by: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          created_at?: string
          updated_at?: string
          title: string
          description?: string | null
          status: string
          priority: string
          due_date?: string | null
          project_id: string
          assigned_to?: string | null
          created_by: string
          deleted_at?: string | null
        }
        Update: {
          id?: string
          created_at?: string
          updated_at?: string
          title?: string
          description?: string | null
          status?: string
          priority?: string
          due_date?: string | null
          project_id?: string
          assigned_to?: string | null
          created_by?: string
          deleted_at?: string | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
} 