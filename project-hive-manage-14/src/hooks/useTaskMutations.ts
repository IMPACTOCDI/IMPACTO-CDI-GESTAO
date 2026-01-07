import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, supabaseHelpers } from '@/lib/supabase';
import { toast } from 'sonner';
import { Database } from '@/integrations/supabase/types';
import { logger } from '@/lib/logger';

type Task = Database['public']['Tables']['tasks']['Row'];
type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

export function useCreateTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (newTask: TaskInsert) => {
      const { data, error } = await supabaseHelpers.withRetry(() =>
        supabase
          .from('tasks')
          .insert(newTask)
          .select()
          .single()
      );
      
      if (error) throw error;
      if (!data) throw new Error('Erro ao criar tarefa');
      return data;
    },
    onSuccess: (newTask) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      
      queryClient.setQueryData(['tasks'], (oldData: Task[] | undefined) => {
        return oldData ? [...oldData, newTask] : [newTask];
      });
      
      if (newTask.project_id) {
        queryClient.setQueryData(
          ['project-tasks', newTask.project_id], 
          (oldData: Task[] | undefined) => {
            return oldData ? [...oldData, newTask] : [newTask];
          }
        );
      }
      
      logger.info('Tarefa criada com sucesso', { taskId: newTask.id }, { context: 'TaskMutations' });
    },
    onError: (error) => {
      logger.error('Erro ao criar tarefa', { error, projectId: newTask?.project_id }, { context: 'TaskMutations', showToast: true });
      toast.error('Erro ao criar tarefa. Tente novamente.');
    },
  });
}

export function useUpdateTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TaskUpdate }) => {
      if (!id) {
        throw new Error('ID da tarefa é obrigatório');
      }

      logger.debug('Atualizando tarefa', { taskId: id, taskData: updates }, { context: 'TaskMutations' });

      // Verificar se a tarefa existe
      const { data: existingTask, error: checkError } = await supabase
        .from('tasks')
        .select('id, project_id')
        .eq('id', id)
        .single();

      if (checkError) {
        logger.error('[UpdateTask] Erro ao verificar tarefa:', checkError);
        throw checkError;
      }

      if (!existingTask) {
        logger.error('[UpdateTask] Tarefa não encontrada:', id);
        throw new Error('Tarefa não encontrada');
      }

      // Garantir que due_date seja null quando não fornecido
      const cleanUpdates = {
        ...updates,
        due_date: updates.due_date === undefined ? null : updates.due_date
      };

      // Adicionar timestamp de atualização
      cleanUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabaseHelpers.withRetry(() =>
        supabase
          .from('tasks')
          .update(cleanUpdates)
          .eq('id', id)
          .select()
          .single()
      );
      
      if (error) {
        logger.error('[UpdateTask] Erro do Supabase:', error);
        throw error;
      }

      if (!data) {
        logger.error('[UpdateTask] Nenhum dado retornado para a tarefa:', id);
        throw new Error('Tarefa não encontrada');
      }

      return data;
    },
    onMutate: async ({ id, updates }) => {
      if (!id) {
        throw new Error('ID da tarefa é obrigatório');
      }

      logger.debug('[UpdateTask] Iniciando otimistic update para:', id);

      // Cancelar todas as queries relacionadas
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      await queryClient.cancelQueries({ queryKey: ['project-tasks'] });
      await queryClient.cancelQueries({ queryKey: ['task', id] });
      await queryClient.cancelQueries({ queryKey: ['dashboard'] });

      const previousTasks = queryClient.getQueryData(['tasks']);
      const previousProjectTasks = queryClient.getQueriesData({ 
        queryKey: ['project-tasks'] 
      });
      const previousTask = queryClient.getQueryData(['task', id]);

      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([_, value]) => value !== undefined && value !== null)
      );

      // Atualizar cache otimisticamente em todas as queries
      queryClient.setQueryData(['tasks'], (oldData: Task[] | undefined) => {
        return oldData?.map(task => 
          task.id === id ? { ...task, ...cleanUpdates } : task
        ) || [];
      });

      previousProjectTasks.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, (oldData: Task[] | undefined) => {
          return oldData?.map(task => 
            task.id === id ? { ...task, ...cleanUpdates } : task
          ) || [];
        });
      });

      queryClient.setQueryData(['task', id], (oldData: Task | undefined) => {
        return oldData ? { ...oldData, ...cleanUpdates } : undefined;
      });

      return { previousTasks, previousProjectTasks, previousTask };
    },
    onSuccess: (updatedTask) => {
      logger.info('[UpdateTask] Tarefa atualizada com sucesso:', updatedTask);
      
      // Atualizar cache com os dados completos
      queryClient.setQueryData(['task', updatedTask.id], updatedTask);
      
      // Invalidar todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task', updatedTask.id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      
      logger.info('[UpdateTask] Tarefa atualizada com sucesso', { taskId: updatedTask.id }, { context: 'TaskMutations' });
    },
    onError: (error, { id }, context) => {
      logger.error('[UpdateTask] Erro:', error);
      
      // Reverter para o estado anterior
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks'], context.previousTasks);
      }
      
      if (context?.previousProjectTasks) {
        context.previousProjectTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      if (context?.previousTask) {
        queryClient.setQueryData(['task', id], context.previousTask);
      }
      
      logger.error('[UpdateTask] Erro ao atualizar tarefa', { error, taskId: id }, { context: 'TaskMutations', showToast: true });
      toast.error('Erro ao atualizar tarefa. Tente novamente.');
    },
    onSettled: (data, error, { id }) => {
      if (id) {
        logger.debug('[UpdateTask] Operação finalizada para:', id);
        
        // Invalidar todas as queries relacionadas
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
        queryClient.invalidateQueries({ queryKey: ['task', id] });
        queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      }
    }
  });
}

export const useDeleteTask = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskId: string) => {
      if (!taskId) {
        throw new Error('ID da tarefa não fornecido');
      }

      logger.debug('Excluindo tarefa', { taskId }, { context: 'TaskMutations' });
      
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) {
        logger.error('[useDeleteTask] Erro ao excluir tarefa:', error);
        throw error;
      }

      logger.info('Tarefa excluída com sucesso', { taskId }, { context: 'TaskMutations' });
      return taskId;
    },
    onMutate: async (taskId) => {
      // Cancelar todas as queries em andamento
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      await queryClient.cancelQueries({ queryKey: ['project-tasks'] });
      await queryClient.cancelQueries({ queryKey: ['task', taskId] });
      await queryClient.cancelQueries({ queryKey: ['dashboard'] });

      // Salvar estado anterior
      const previousTasks = queryClient.getQueryData(['tasks']);
      const previousProjectTasks = queryClient.getQueriesData({ queryKey: ['project-tasks'] });

      // Atualizar cache otimisticamente
      queryClient.setQueryData(['tasks'], (old: Task[] | undefined) => {
        return old?.filter(task => task.id !== taskId) || [];
      });

      queryClient.setQueriesData(
        { queryKey: ['project-tasks'] },
        (old: Task[] | undefined) => {
          return old?.filter(task => task.id !== taskId) || [];
        }
      );

      // Remover tarefa individual do cache
      queryClient.removeQueries({ queryKey: ['task', taskId] });

      return { previousTasks, previousProjectTasks };
    },
    onSuccess: (taskId) => {
      logger.info('[useDeleteTask] Atualizando cache após exclusão:', taskId);
      
      // Invalidar todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['task', taskId] });
      
      logger.info('Tarefa excluída com sucesso', { taskId }, { context: 'TaskMutations' });
    },
    onError: (error: any, taskId, context) => {
      logger.error('[useDeleteTask] Erro na mutação:', error);
      
      // Reverter para o estado anterior
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks'], context.previousTasks);
      }
      
      if (context?.previousProjectTasks) {
        context.previousProjectTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      logger.error('[useDeleteTask] Erro ao excluir tarefa', { error, taskId }, { context: 'TaskMutations', showToast: true });
      toast.error('Erro ao excluir tarefa. Tente novamente.');
    }
  });
};

export function useDeleteMultipleTasks() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (taskIds: string[]) => {
      const { error } = await supabaseHelpers.withRetry(() =>
        supabase
          .from('tasks')
          .delete()
          .in('id', taskIds)
      );
      
      if (error) throw error;
      return taskIds;
    },
    onMutate: async (taskIds: string[]) => {
      await queryClient.cancelQueries({ queryKey: ['tasks'] });
      await queryClient.cancelQueries({ queryKey: ['project-tasks'] });

      const previousTasks = queryClient.getQueryData(['tasks']);
      const previousProjectTasks = queryClient.getQueriesData({ queryKey: ['project-tasks'] });

      queryClient.setQueryData(['tasks'], (oldTasks: any[]) => {
        return oldTasks?.filter(task => !taskIds.includes(task.id)) || [];
      });

      queryClient.setQueriesData(
        { queryKey: ['project-tasks'] },
        (oldTasks: any[]) => {
          return oldTasks?.filter(task => !taskIds.includes(task.id)) || [];
        }
      );

      return { previousTasks, previousProjectTasks };
    },
    onSuccess: (taskIds) => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      
      logger.info(`${taskIds.length} tarefas excluídas com sucesso!`, { taskIds }, { context: 'TaskMutations' });
    },
    onError: (error, taskIds, context) => {
      logger.error('[DeleteMultipleTasks] Erro:', error);
      
      if (context?.previousTasks) {
        queryClient.setQueryData(['tasks'], context.previousTasks);
      }
      
      if (context?.previousProjectTasks) {
        context.previousProjectTasks.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }

      logger.error('[DeleteMultipleTasks] Erro ao excluir tarefas', { error, taskIds }, { context: 'TaskMutations', showToast: true });
      toast.error('Erro ao excluir tarefas. Tente novamente.');
    }
  });
} 