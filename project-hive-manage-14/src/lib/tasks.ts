import { supabase } from '@/lib/supabase';
import { Database } from '@/integrations/supabase/types';
import { logger } from '@/lib/logger';

type Task = Database['public']['Tables']['tasks']['Row'] & {
  projectName?: string;
};

type ProjectWithOverdueTasks = {
  id: string;
  name: string;
  overdueTasks: number;
};

export async function getOverdueTasks(): Promise<Task[]> {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      projects:project_id (
        name
      )
    `)
    .lt('due_date', today)
    .not('due_date', 'is', null)
    .neq('status', 'done')
    .order('due_date', { ascending: true });

  if (error) {
    logger.error('Erro ao buscar tarefas atrasadas', { error }, { context: 'Tasks', showToast: true });
    return [];
  }

  const tasks = data.map(task => ({
    ...task,
    projectName: task.projects?.name
  }));

  logger.debug('Tarefas atrasadas carregadas', { count: tasks.length }, { context: 'Tasks' });
  return tasks;
}

export async function getUpcomingTasks(days: number = 7): Promise<Task[]> {
  const today = new Date();
  const futureDate = new Date();
  futureDate.setDate(today.getDate() + days);
  
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      projects:project_id (
        name
      )
    `)
    .gte('due_date', today.toISOString().split('T')[0])
    .lte('due_date', futureDate.toISOString().split('T')[0])
    .not('due_date', 'is', null)
    .neq('status', 'done')
    .order('due_date', { ascending: true });

  if (error) {
    logger.error('Erro ao buscar próximas tarefas', { error }, { context: 'Tasks', showToast: true });
    return [];
  }

  const tasks = data.map(task => ({
    ...task,
    projectName: task.projects?.name
  }));

  logger.debug('Próximas tarefas carregadas', { count: tasks.length }, { context: 'Tasks' });
  return tasks;
}

export async function getOverdueProjects(): Promise<ProjectWithOverdueTasks[]> {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      project_id,
      projects:project_id (
        id,
        name
      )
    `)
    .lt('due_date', today)
    .neq('status', 'done')
    .order('due_date', { ascending: true });

  if (error) {
    logger.error('Erro ao buscar projetos com tarefas atrasadas', { error }, { context: 'Tasks', showToast: true });
    return [];
  }

  // Agrupar tarefas por projeto e contar
  const projectsMap = new Map<string, ProjectWithOverdueTasks>();
  
  data.forEach(task => {
    if (task.project_id && task.projects) {
      const projectId = task.project_id;
      
      if (!projectsMap.has(projectId)) {
        projectsMap.set(projectId, {
          id: task.projects.id,
          name: task.projects.name,
          overdueTasks: 1
        });
      } else {
        const project = projectsMap.get(projectId)!;
        project.overdueTasks += 1;
      }
    }
  });

  const overdueProjects = Array.from(projectsMap.values());
  
  logger.debug('Projetos com tarefas atrasadas carregados', { count: overdueProjects.length }, { context: 'Tasks' });
  return overdueProjects;
}