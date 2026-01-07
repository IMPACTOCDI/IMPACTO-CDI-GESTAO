export const queryKeys = {
  // Projetos
  projects: ['projects'] as const,
  project: (id: string) => ['project', id] as const,
  projectTasks: (projectId: string) => ['project-tasks', projectId] as const,
  
  // Tarefas
  tasks: ['tasks'] as const,
  task: (id: string) => ['task', id] as const,
  
  // Dashboard
  dashboard: ['dashboard'] as const,
  
  // Usuário
  profile: ['profile'] as const,

  // Comentários
  comments: (taskId: string) => ['comments', taskId] as const,
} as const; 