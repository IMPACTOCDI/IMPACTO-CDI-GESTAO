import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { logger } from '@/lib/logger';
import { Task } from '@/types/task';

type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

// Chaves de query para invalidação
export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters: string) => [...taskKeys.lists(), { filters }] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
  project: (projectId: string) => [...taskKeys.all, 'project', projectId] as const,
  user: (userId: string) => [...taskKeys.all, 'user', userId] as const,
};

// Função auxiliar para atualizar o cache
const updateTaskInCache = (queryClient: any, taskId: string, updates: Partial<Task>) => {
  // Atualizar na lista de todas as tarefas
  queryClient.setQueryData(taskKeys.lists(), (old: Task[] = []) =>
    old.map(task => task.id === taskId ? { ...task, ...updates } : task)
  );

  // Atualizar na lista de detalhes da tarefa
  queryClient.setQueryData(taskKeys.detail(taskId), (old: Task) => ({
    ...old,
    ...updates
  }));

  // Atualizar em todas as listas de projeto
  const projectQueries = queryClient.getQueryCache().findAll({
    queryKey: taskKeys.all,
    predicate: (query: any) => query.queryKey[1] === 'project'
  });

  projectQueries.forEach((query: any) => {
    const projectId = query.queryKey[2];
    queryClient.setQueryData(query.queryKey, (old: Task[] = []) =>
      old.map(task => task.id === taskId ? { ...task, ...updates } : task)
    );
  });
};

// Hook para buscar uma tarefa específica
export function useTask(taskId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.detail(taskId || ''),
    queryFn: async () => {
      logger.debug('Iniciando busca da tarefa', { taskId }, { context: 'TaskQueries' });
      if (!taskId) {
        logger.warn('taskId não fornecido');
        return null;
      }

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          assigned_profile:profiles!assigned_to(*),
          task_tags(tag),
          comments(*, profiles:created_by(*))
        `)
        .eq('id', taskId)
        .maybeSingle();

      logger.info('Resposta do Supabase', { data, error });

      if (error) {
        logger.error('Erro ao buscar tarefa', { error }, { context: 'TaskQueries', showToast: true });
        return null;
      }

      if (!data) {
        logger.warn('Nenhum dado retornado para a tarefa', { taskId });
        return null;
      }

      // Transformar os dados para o formato esperado
      const task = {
        ...data,
        tags: data.task_tags?.map(tag => tag.tag) || [],
        comments: data.comments?.map(comment => ({
          ...comment,
          profiles: comment.profiles
        })) || []
      };

      logger.info('Tarefa processada', { task });
      return task as Task;
    },
    enabled: !!taskId,
    retry: false,
    gcTime: 5 * 60 * 1000, // 5 minutos
    staleTime: 30000, // 30 segundos
  });
}

// Hook para buscar tarefas de um projeto
export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: taskKeys.project(projectId || ''),
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          task_tags(tag),
          comments(*, profiles:created_by(*))
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Erro ao buscar tarefas', { error }, { context: 'TaskQueries', showToast: true });
        throw error;
      }

      return (data || []).map(task => ({
        ...task,
        tags: task.task_tags?.map(tag => tag.tag) || [],
        comments: task.comments?.map(comment => ({
          ...comment,
          profiles: comment.profiles
        })) || []
      })) as Task[];
    },
    enabled: !!projectId,
    gcTime: 5 * 60 * 1000, // 5 minutos
    staleTime: 30000, // 30 segundos
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

// Hook para buscar todas as tarefas dos projetos do usuário
export function useUserTasks(projectIds: string[], showOnlyAssigned: boolean = false) {
  const { user } = useAuth();
  const validProjectIds = projectIds.filter(Boolean);
  
  return useQuery({
    queryKey: ['user-tasks', validProjectIds, user?.id, showOnlyAssigned],
    queryFn: async () => {
      if (!validProjectIds.length || !user?.id) return [];

      try {
        const { data: projectAccess, error: accessError } = await supabase
          .from('project_members')
          .select('project_id')
          .in('project_id', validProjectIds)
          .eq('user_id', user.id);

        if (accessError) throw accessError;

        const accessibleProjectIds = projectAccess?.map(access => access.project_id) || [];
        if (accessibleProjectIds.length === 0) return [];

        let query = supabase
          .from('tasks')
          .select(`
            *,
            task_tags(tag),
            comments(*, profiles:created_by(*)),
            projects!inner(name)
          `)
          .in('project_id', accessibleProjectIds);

        // Aplicar filtro de assigned_to apenas se showOnlyAssigned for true
        if (showOnlyAssigned) {
          query = query.eq('assigned_to', user.id);
        }

        const { data, error } = await query.order('created_at', { ascending: false });

        if (error) throw error;

        return (data || []).map(task => ({
          ...task,
          tags: task.task_tags?.map(tag => tag.tag) || [],
          comments: task.comments?.map(comment => ({
            ...comment,
            profiles: comment.profiles
          })) || [],
          projectName: task.projects?.name || 'Projeto Desconhecido'
        })) as Task[];
      } catch (error) {
        logger.error('Erro ao buscar tarefas do usuário', { error }, { context: 'TaskQueries', showToast: true });
        throw error;
      }
    },
    enabled: !!validProjectIds.length && !!user?.id,
    gcTime: 5 * 60 * 1000, // 5 minutos
    staleTime: 30000, // 30 segundos
    refetchOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

// Hook para criar tarefa
export const useCreateTask = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (newTask: TaskInsert) => {
      console.log('[useCreateTask] Iniciando criação de tarefa:', newTask);
      const { data, error } = await supabase
        .from('tasks')
        .insert(newTask)
        .select()
        .single();
      
      if (error) {
        console.error('[useCreateTask] Erro ao criar tarefa:', error);
        throw error;
      }
      if (!data) {
        console.error('[useCreateTask] Nenhum dado retornado');
        throw new Error('Erro ao criar tarefa');
      }
      console.log('[useCreateTask] Tarefa criada com sucesso:', data);
      return data;
    },
    onMutate: async (newTask) => {
      console.log('[useCreateTask] Iniciando atualização otimista');
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: taskKeys.all });

      // Salvar estado anterior
      const previousTasks = queryClient.getQueryData(taskKeys.lists());
      const previousProjectTasks = queryClient.getQueryData(
        taskKeys.project(newTask.project_id)
      );

      // Criar tarefa otimista
      const optimisticTask = {
        ...newTask,
        id: crypto.randomUUID(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      console.log('[useCreateTask] Tarefa otimista criada:', optimisticTask);

      // Atualizar cache otimisticamente
      queryClient.setQueryData(taskKeys.lists(), (old: Task[] = []) => {
        const updatedTasks = [...old, optimisticTask];
        console.log('[useCreateTask] Cache de todas as tarefas atualizado:', updatedTasks);
        return updatedTasks;
      });
      
      if (newTask.project_id) {
        queryClient.setQueryData(
          taskKeys.project(newTask.project_id),
          (old: Task[] = []) => {
            const updatedTasks = [...old, optimisticTask];
            console.log('[useCreateTask] Cache de tarefas do projeto atualizado:', updatedTasks);
            return updatedTasks;
          }
        );
      }

      return { previousTasks, previousProjectTasks, optimisticTask };
    },
    onError: (err, newTask, context) => {
      console.error('[useCreateTask] Erro na mutação:', err);
      // Reverter para o estado anterior
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
      }
      if (context?.previousProjectTasks) {
        queryClient.setQueryData(
          taskKeys.project(newTask.project_id),
          context.previousProjectTasks
        );
      }
      toast.error('Erro ao criar tarefa. Tente novamente.');
    },
    onSuccess: (data, variables, context) => {
      console.log('[useCreateTask] Tarefa criada com sucesso:', data);
      // Atualizar o cache com os dados reais
      if (context?.optimisticTask) {
        queryClient.setQueryData(taskKeys.lists(), (old: Task[] = []) => 
          old.map(task => task.id === context.optimisticTask.id ? data : task)
        );
        
        if (data.project_id) {
          queryClient.setQueryData(
            taskKeys.project(data.project_id),
            (old: Task[] = []) => 
              old.map(task => task.id === context.optimisticTask.id ? data : task)
          );
        }
      }
      toast.success('Tarefa criada com sucesso!');
    },
    onSettled: (data) => {
      console.log('[useCreateTask] Finalizando mutação');
      // Invalidar todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      if (data?.project_id) {
        queryClient.invalidateQueries({
          queryKey: taskKeys.project(data.project_id)
        });
      }
      // Invalida também a lista de tarefas do usuário
      queryClient.invalidateQueries({ queryKey: ['user-tasks'] });
    },
  });
};

// Hook para atualizar tarefa
export function useUpdateTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: TaskUpdate }) => {
      const { data, error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      if (!data) throw new Error('Tarefa não encontrada');
      return data;
    },
    onMutate: async ({ id, updates }) => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: taskKeys.all });

      // Salvar estado anterior
      const previousTasks = queryClient.getQueryData(taskKeys.lists());
      const previousTask = queryClient.getQueryData(taskKeys.detail(id));

      // Atualizar cache otimisticamente em todas as listas
      updateTaskInCache(queryClient, id, updates);

      return { previousTasks, previousTask };
    },
    onError: (err, { id }, context) => {
      // Reverter para o estado anterior
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
      }
      if (context?.previousTask) {
        queryClient.setQueryData(taskKeys.detail(id), context.previousTask);
      }
      toast.error('Erro ao atualizar tarefa. Tente novamente.');
    },
    onSettled: (data) => {
      // Invalidar todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
      if (data?.project_id) {
        queryClient.invalidateQueries({
          queryKey: taskKeys.project(data.project_id)
        });
      }
    },
  });
}

// Hook para deletar tarefa
export function useDeleteTask() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);
      
      if (error) throw error;
      return taskId;
    },
    onMutate: async (taskId) => {
      // Cancelar queries em andamento
      await queryClient.cancelQueries({ queryKey: taskKeys.all });

      // Salvar estado anterior
      const previousTasks = queryClient.getQueryData(taskKeys.lists());
      const previousTask = queryClient.getQueryData(taskKeys.detail(taskId));

      // Atualizar cache otimisticamente em todas as listas
      queryClient.setQueryData(taskKeys.lists(), (old: Task[] = []) =>
        old.filter(task => task.id !== taskId)
      );
      
      // Remover de todas as listas de projeto
      const projectQueries = queryClient.getQueryCache().findAll({
        queryKey: taskKeys.all,
        predicate: (query: any) => query.queryKey[1] === 'project'
      });

      projectQueries.forEach((query: any) => {
        queryClient.setQueryData(query.queryKey, (old: Task[] = []) =>
          old.filter(task => task.id !== taskId)
        );
      });

      // Remover query de detalhes
      queryClient.removeQueries({ queryKey: taskKeys.detail(taskId) });

      return { previousTasks, previousTask };
    },
    onError: (err, taskId, context) => {
      // Reverter para o estado anterior
      if (context?.previousTasks) {
        queryClient.setQueryData(taskKeys.lists(), context.previousTasks);
      }
      if (context?.previousTask) {
        queryClient.setQueryData(taskKeys.detail(taskId), context.previousTask);
      }
      toast.error('Erro ao excluir tarefa. Tente novamente.');
    },
    onSettled: () => {
      // Invalidar todas as queries relacionadas
      queryClient.invalidateQueries({ queryKey: taskKeys.all });
    },
  });
} 