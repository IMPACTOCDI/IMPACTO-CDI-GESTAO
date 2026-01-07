import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Database } from '@/integrations/supabase/types';
import { logger } from '@/lib/logger';

type Task = Database['public']['Tables']['tasks']['Row'] & {
  tags?: string[];
  comments?: Database['public']['Tables']['comments']['Row'][];
};

export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-tasks', projectId],
    queryFn: async () => {
      if (!projectId) {
        throw new Error('ID do projeto não fornecido');
      }
      
      // Evitar requisições quando o projectId for 'new'
      if (projectId === 'new') {
        logger.debug('Ignorando busca de tarefas para projectId="new"');
        return [];
      }

      logger.debug('Buscando tarefas do projeto', { projectId });

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          task_tags(tag),
          comments(
            id,
            content,
            created_at,
            created_by,
            profiles:created_by(
              id,
              name,
              avatar
            )
          )
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Erro ao buscar tarefas', { error, projectId });
        throw error;
      }

      const tasks = data.map(task => ({
        ...task,
        tags: task.task_tags?.map(tag => tag.tag) || [],
        comments: task.comments?.map(comment => ({
          ...comment,
          profiles: comment.profiles
        })) || []
      })) as Task[];

      logger.debug('Tarefas encontradas', { count: tasks.length, projectId });
      return tasks;
    },
    enabled: !!projectId && projectId !== 'new',
    staleTime: 30000, // 30 segundos
    cacheTime: 5 * 60 * 1000, // 5 minutos
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    refetchOnWindowFocus: false,
    refetchOnMount: false,
    refetchOnReconnect: true
  });
}