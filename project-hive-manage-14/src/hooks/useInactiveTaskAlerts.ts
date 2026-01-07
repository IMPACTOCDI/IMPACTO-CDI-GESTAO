import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { 
  InactiveTaskAlert, 
  getInactiveTasks, 
  getInactiveTaskCounts,
  generateInactiveTaskMessage 
} from '@/lib/taskInactivity';
import { Task } from '@/types/task';
import { logger } from '@/lib/logger';

export interface InactiveTaskAlertsState {
  alerts: InactiveTaskAlert[];
  counts: {
    warning: number;
    critical: number;
    total: number;
  };
  isLoading: boolean;
  error: string | null;
  lastChecked: Date | null;
}

/**
 * Hook para gerenciar alertas de tarefas inativas
 * Verifica tarefas criadas pelo usuário que não tiveram interação (comentários) há mais de 7 dias
 */
export function useInactiveTaskAlerts(): InactiveTaskAlertsState {
  const { user } = useAuth();
  const { projects } = useProject();
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  
  // Buscar todas as tarefas dos projetos do usuário
  const { data: allTasks = [], isLoading, error } = useQuery({
    queryKey: ['inactive-task-alerts', user?.id, projects.map(p => p.id)],
    queryFn: async () => {
      if (!user?.id || !projects.length) return [];

      try {
        // Buscar apenas as tarefas criadas pelo usuário nos seus projetos
        const projectIds = projects.map(p => p.id);
        
        const { data, error } = await supabase
          .from('tasks')
          .select(`
            *,
            task_tags(tag),
            comments(*, profiles:created_by(*)),
            projects!inner(name)
          `)
          .in('project_id', projectIds)
          .eq('created_by', user.id) // Filtrar apenas tarefas criadas pelo usuário
          .neq('status', 'done') // Excluir tarefas concluídas
          .order('created_at', { ascending: false });

        if (error) {
          logger.error('Erro ao buscar tarefas para verificação de inatividade', { error });
          throw error;
        }

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
        logger.error('Erro ao buscar tarefas', { error });
        throw error;
      }
    },
    enabled: !!user?.id && projects.length > 0,
    refetchInterval: 5 * 60 * 1000, // Verificar a cada 5 minutos
    refetchOnWindowFocus: true,
    gcTime: 10 * 60 * 1000, // 10 minutos
    staleTime: 2 * 60 * 1000, // 2 minutos
  });

  // Calcular alertas de inatividade
  const alerts = useMemo(() => {
    if (!allTasks.length) return [];
    
    const inactiveTasks = getInactiveTasks(allTasks);
    setLastChecked(new Date());
    
    logger.debug('Alertas de inatividade calculados', { 
      totalTasks: allTasks.length,
      inactiveTasks: inactiveTasks.length,
      context: 'InactiveTaskAlerts'
    });
    
    return inactiveTasks;
  }, [allTasks]);

  // Calcular contadores
  const counts = useMemo(() => {
    return getInactiveTaskCounts(allTasks);
  }, [allTasks]);

  return {
    alerts,
    counts,
    isLoading,
    error: error?.message || null,
    lastChecked
  };
}

/**
 * Hook para verificar se uma tarefa específica está inativa
 */
export function useTaskInactivityCheck(taskId: string, tasks: Task[]): InactiveTaskAlert | null {
  return useMemo(() => {
    if (!taskId || !tasks.length) return null;
    
    const task = tasks.find(t => t.id === taskId);
    if (!task) return null;
    
    const inactiveTasks = getInactiveTasks([task]);
    return inactiveTasks.length > 0 ? inactiveTasks[0] : null;
  }, [taskId, tasks]);
}

/**
 * Hook para obter mensagens de alerta formatadas
 */
export function useInactiveTaskMessages(alerts: InactiveTaskAlert[]): string[] {
  return useMemo(() => {
    return alerts.map(alert => generateInactiveTaskMessage(alert));
  }, [alerts]);
}

/**
 * Hook para verificar se há alertas críticos
 */
export function useCriticalAlerts(alerts: InactiveTaskAlert[]): InactiveTaskAlert[] {
  return useMemo(() => {
    return alerts.filter(alert => alert.alertType === 'critical');
  }, [alerts]);
}

/**
 * Hook para verificar se há alertas de warning
 */
export function useWarningAlerts(alerts: InactiveTaskAlert[]): InactiveTaskAlert[] {
  return useMemo(() => {
    return alerts.filter(alert => alert.alertType === 'warning');
  }, [alerts]);
}
