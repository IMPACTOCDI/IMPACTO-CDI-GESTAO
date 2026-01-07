import { Task } from '@/types/task';
import { logger } from './logger';

export interface InactiveTaskAlert {
  task: Task;
  daysSinceLastActivity: number;
  lastActivityDate: Date;
  alertType: 'warning' | 'critical';
}

/**
 * Verifica se uma tarefa está inativa há mais de 7 dias
 * @param task - A tarefa a ser verificada
 * @returns Objeto com informações sobre a inatividade ou null se a tarefa está ativa
 */
export function checkTaskInactivity(task: Task): InactiveTaskAlert | null {
  try {
    // Se a tarefa está concluída, não precisa verificar inatividade
    if (task.status === 'done') {
      return null;
    }

    const now = new Date();
    let lastActivityDate: Date;

    // Determinar a última atividade
    if (task.comments && task.comments.length > 0) {
      // Se há comentários, usar a data do comentário mais recente
      const latestComment = task.comments.reduce((latest, comment) => {
        const commentDate = new Date(comment.created_at);
        return commentDate > latest ? commentDate : latest;
      }, new Date(task.comments[0].created_at));
      
      lastActivityDate = latestComment;
    } else {
      // Se não há comentários, usar a data de criação da tarefa
      lastActivityDate = new Date(task.created_at);
    }

    // Calcular dias desde a última atividade
    const daysSinceLastActivity = Math.floor(
      (now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Se passou mais de 7 dias, gerar alerta
    if (daysSinceLastActivity >= 7) {
      const alertType: 'warning' | 'critical' = daysSinceLastActivity >= 14 ? 'critical' : 'warning';
      
      return {
        task,
        daysSinceLastActivity,
        lastActivityDate,
        alertType
      };
    }

    return null;
  } catch (error) {
    logger.error('Erro ao verificar inatividade da tarefa', { 
      error, 
      taskId: task.id, 
      context: 'TaskInactivity' 
    });
    return null;
  }
}

/**
 * Verifica múltiplas tarefas e retorna apenas as que estão inativas
 * @param tasks - Array de tarefas para verificar
 * @returns Array de alertas de tarefas inativas
 */
export function getInactiveTasks(tasks: Task[]): InactiveTaskAlert[] {
  const inactiveTasks: InactiveTaskAlert[] = [];

  for (const task of tasks) {
    const alert = checkTaskInactivity(task);
    if (alert) {
      inactiveTasks.push(alert);
    }
  }

  // Ordenar por dias de inatividade (mais críticos primeiro)
  return inactiveTasks.sort((a, b) => b.daysSinceLastActivity - a.daysSinceLastActivity);
}

/**
 * Gera uma mensagem de alerta personalizada para uma tarefa inativa
 * @param alert - O alerta da tarefa inativa
 * @returns Mensagem formatada
 */
export function generateInactiveTaskMessage(alert: InactiveTaskAlert): string {
  const { task, daysSinceLastActivity, alertType } = alert;
  
  const urgency = alertType === 'critical' ? 'CRÍTICO' : 'ATENÇÃO';
  const emoji = alertType === 'critical' ? '🚨' : '⚠️';
  
  return `${emoji} ${urgency}: A tarefa "${task.title}" não teve interação há ${daysSinceLastActivity} dias. Considere adicionar um comentário ou atualizar o status.`;
}

/**
 * Verifica se uma tarefa específica precisa de alerta de inatividade
 * @param taskId - ID da tarefa
 * @param tasks - Array de tarefas (para buscar a tarefa específica)
 * @returns Alerta de inatividade ou null
 */
export function checkSpecificTaskInactivity(taskId: string, tasks: Task[]): InactiveTaskAlert | null {
  const task = tasks.find(t => t.id === taskId);
  if (!task) {
    logger.warn('Tarefa não encontrada para verificação de inatividade', { taskId });
    return null;
  }
  
  return checkTaskInactivity(task);
}

/**
 * Conta quantas tarefas estão inativas por tipo de alerta
 * @param tasks - Array de tarefas para verificar
 * @returns Objeto com contadores de alertas
 */
export function getInactiveTaskCounts(tasks: Task[]): {
  warning: number;
  critical: number;
  total: number;
} {
  const inactiveTasks = getInactiveTasks(tasks);
  
  const warning = inactiveTasks.filter(alert => alert.alertType === 'warning').length;
  const critical = inactiveTasks.filter(alert => alert.alertType === 'critical').length;
  
  return {
    warning,
    critical,
    total: inactiveTasks.length
  };
}
