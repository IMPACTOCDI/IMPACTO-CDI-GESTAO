import { supabase } from '@/lib/supabase';
import { useMutationWithInvalidation } from './useMutationWithInvalidation';
import { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'];
type Task = Database['public']['Tables']['tasks']['Row'];
type Comment = Database['public']['Tables']['comments']['Row'];

// Hook para criar projeto
export function useCreateProject() {
  return useMutationWithInvalidation({
    mutationFn: async (projectData: Partial<Project>) => {
      const { data, error } = await supabase
        .from('projects')
        .insert([projectData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    invalidateQueries: [['projects'], ['dashboard']],
    successMessage: 'Projeto criado com sucesso!',
    errorMessage: 'Erro ao criar projeto'
  });
}

// Hook para editar projeto
export function useUpdateProject() {
  return useMutationWithInvalidation({
    mutationFn: async ({ id, ...updateData }: Partial<Project> & { id: string }) => {
      const { data, error } = await supabase
        .from('projects')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    invalidateQueries: [['projects'], ['dashboard'], ['project']],
    successMessage: 'Projeto atualizado com sucesso!',
    errorMessage: 'Erro ao atualizar projeto'
  });
}

// Hook para deletar projeto
export function useDeleteProject() {
  return useMutationWithInvalidation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id };
    },
    invalidateQueries: [['projects'], ['dashboard']],
    successMessage: 'Projeto deletado com sucesso!',
    errorMessage: 'Erro ao deletar projeto'
  });
}

// Hook para criar tarefa
export function useCreateTask() {
  return useMutationWithInvalidation({
    mutationFn: async (taskData: Partial<Task>) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert([taskData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    invalidateQueries: [['tasks'], ['project-tasks'], ['dashboard']],
    successMessage: 'Tarefa criada com sucesso!',
    errorMessage: 'Erro ao criar tarefa'
  });
}

// Hook para atualizar tarefa
export function useUpdateTask() {
  return useMutationWithInvalidation({
    mutationFn: async ({ id, ...updateData }: Partial<Task> & { id: string }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    invalidateQueries: [['tasks'], ['project-tasks'], ['dashboard']],
    successMessage: 'Tarefa atualizada com sucesso!',
    errorMessage: 'Erro ao atualizar tarefa'
  });
}

// Hook para deletar tarefa
export function useDeleteTask() {
  return useMutationWithInvalidation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id };
    },
    invalidateQueries: [
      ['tasks'],
      ['project-tasks'],
      ['dashboard'],
      ['project'],
      ['task']
    ],
    successMessage: 'Tarefa deletada com sucesso!',
    errorMessage: 'Erro ao deletar tarefa'
  });
}

// Hook para criar comentário
export function useCreateComment() {
  return useMutationWithInvalidation({
    mutationFn: async (commentData: Partial<Comment>) => {
      // Garantir que temos task_id
      if (!commentData.task_id) {
        throw new Error('task_id é obrigatório para criar um comentário');
      }

      // Se não temos project_id, buscar da tarefa
      if (!commentData.project_id) {
        const { data: taskData, error: taskError } = await supabase
          .from('tasks')
          .select('project_id')
          .eq('id', commentData.task_id)
          .single();
        
        if (taskError) throw taskError;
        if (!taskData?.project_id) {
          throw new Error('Não foi possível encontrar o project_id da tarefa');
        }
        commentData.project_id = taskData.project_id;
      }

      // Validar se temos todos os campos obrigatórios
      if (!commentData.content || !commentData.created_by || !commentData.project_id) {
        throw new Error('Campos obrigatórios faltando: content, created_by ou project_id');
      }

      const { data, error } = await supabase
        .from('comments')
        .insert([{
          content: commentData.content,
          task_id: commentData.task_id,
          project_id: commentData.project_id,
          created_by: commentData.created_by,
          created_at: commentData.created_at || new Date().toISOString()
        }])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    invalidateQueries: [['comments']],
    successMessage: 'Comentário adicionado com sucesso!',
    errorMessage: 'Erro ao adicionar comentário'
  });
}

// Hook para deletar comentário
export function useDeleteComment() {
  return useMutationWithInvalidation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      return { id };
    },
    invalidateQueries: [['comments']],
    successMessage: 'Comentário excluído com sucesso!',
    errorMessage: 'Erro ao excluir comentário'
  });
}

// Hook para atualizar comentário
export function useUpdateComment() {
  return useMutationWithInvalidation({
    mutationFn: async ({ id, content }: { id: string, content: string }) => {
      const { data, error } = await supabase
        .from('comments')
        .update({ content })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    invalidateQueries: [['comments']],
    successMessage: 'Comentário atualizado com sucesso!',
    errorMessage: 'Erro ao atualizar comentário',
    mutationKey: 'update-comment'
  });
}