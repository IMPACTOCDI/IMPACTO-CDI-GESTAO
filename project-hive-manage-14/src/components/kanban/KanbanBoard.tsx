import React, { useState, useMemo, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProject } from '../../contexts/ProjectContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Plus, Calendar, User } from 'lucide-react';
import TaskDialog from '../tasks/TaskDialog';
import TaskDetailDialog from '../tasks/TaskDetailDialog';
import KanbanFilters from './KanbanFilters';
import { Database } from '@/integrations/supabase/types';
import { supabase } from '@/lib/supabase';
import { toast } from 'react-hot-toast';
import { logger } from '@/lib/logger';
import { LinkifiedText } from '@/components/common/LinkifiedText';

type Project = Database['public']['Tables']['projects']['Row'] & {
  members?: Database['public']['Tables']['project_members']['Row'][];
  tasks?: Database['public']['Tables']['tasks']['Row'][];
};

type Task = Database['public']['Tables']['tasks']['Row'];

const KanbanBoard = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject, updateTask } = useProject();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isTaskDetailOpen, setIsTaskDetailOpen] = useState(false);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [assigneesProfiles, setAssigneesProfiles] = useState<Record<string, { name: string }>>({});

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [assigneeFilter, setAssigneeFilter] = useState('all');

  // Get unique assignees for filter
  const assignees = useMemo(() => {
    if (!project?.tasks) return [];
    const allAssignees = project.tasks
      .map(task => task.assigned_to)
      .filter((id): id is string => id !== null);
    return [...new Set(allAssignees)];
  }, [project?.tasks]);

  // Filter tasks based on current filters
  const filteredTasks = useMemo(() => {
    if (!project?.tasks) return [];
    return project.tasks.filter(task => {
      const matchesSearch = task.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (task.description?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
      const matchesAssignee = assigneeFilter === 'all' || task.assigned_to === assigneeFilter;
      return matchesSearch && matchesPriority && matchesAssignee;
    });
  }, [project?.tasks, searchTerm, priorityFilter, assigneeFilter]);

  useEffect(() => {
    const loadProject = async () => {
      if (!id) {
        logger.error('ID do projeto não fornecido', { projectId: id }, { context: 'KanbanBoard' });
        return;
      }

      try {
        setIsLoading(true);
        logger.debug('Carregando projeto', { projectId: id }, { context: 'KanbanBoard' });
        const projectData = await getProject(id);
        
        if (!projectData) {
          logger.error('Projeto não encontrado', { projectId: id }, { context: 'KanbanBoard' });
          toast.error('Projeto não encontrado');
          return;
        }

        logger.info('Projeto carregado com sucesso', { projectId: id }, { context: 'KanbanBoard' });
        setProject(projectData);
      } catch (error: any) {
        logger.error('Erro ao carregar projeto', { error, projectId: id }, { context: 'KanbanBoard', showToast: true });
        toast.error('Erro ao carregar projeto: ' + error.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadProject();
  }, [id, getProject]);

  useEffect(() => {
    const fetchAssignees = async () => {
      if (!project?.tasks) return;
      const assigneeIds = [...new Set(project.tasks
        .map(task => task.assigned_to)
        .filter((id): id is string => id !== null))];
      if (assigneeIds.length === 0) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', assigneeIds);

      if (error) return;

      const profilesMap = data.reduce((acc: Record<string, { name: string }>, profile: any) => {
        acc[profile.id] = profile;
        return acc;
      }, {});
      setAssigneesProfiles(profilesMap);
    };

    fetchAssignees();
  }, [project?.tasks]);

  // Configurar assinatura em tempo real para o kanban
  useEffect(() => {
    if (!id) return;

    logger.debug('Configurando assinatura em tempo real', { projectId: id }, { context: 'KanbanBoard' });
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelay = 3000; // 3 segundos
    let subscription: any = null;
    let heartbeatInterval: NodeJS.Timeout | null = null;
    let isReconnecting = false;
    let mounted = true;
    let updateTimeout: NodeJS.Timeout | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;
    let heartbeatTimeout: NodeJS.Timeout | null = null;

    const cleanup = () => {
      logger.debug('Executando cleanup', { projectId: id }, { context: 'KanbanBoard' });
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      if (subscription) {
        try {
          subscription.unsubscribe();
          subscription = null;
        } catch (error) {
          logger.error('Erro ao desinscrever', { error, projectId: id }, { context: 'KanbanBoard' });
        }
      }
    };

    const setupSubscription = () => {
      if (!mounted) {
        logger.debug('Componente desmontado, não configurando assinatura');
        return;
      }

      if (isReconnecting) {
        logger.debug('Já existe uma reconexão em andamento, ignorando...');
        return;
      }

      cleanup();
      isReconnecting = true;

      logger.debug('Iniciando nova assinatura...');
      
      // Configurar canal com retry automático
      subscription = supabase
      .channel(`kanban_${id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
          filter: `project_id=eq.${id}`
        },
        async (payload) => {
            if (!mounted) return;
            
            logger.debug('Mudança detectada:', payload);
            
          try {
              // Implementar debounce para evitar múltiplas atualizações
              if (updateTimeout) {
                clearTimeout(updateTimeout);
              }
              
              updateTimeout = setTimeout(async () => {
            const projectData = await getProject(id);
              if (projectData && mounted) {
              setProject(projectData);
                logger.info('Projeto atualizado com sucesso', { projectId: id }, { context: 'KanbanBoard' });
              } else {
                logger.error('Projeto não encontrado após atualização', { projectId: id }, { context: 'KanbanBoard' });
            }
              }, 300); // Debounce de 300ms
              
          } catch (error) {
              logger.error('Erro ao atualizar projeto', { error, projectId: id }, { context: 'KanbanBoard' });
              if (mounted) {
                toast.error('Erro ao atualizar projeto: ' + (error as Error).message);
              }
          }
        }
      )
        .subscribe((status) => {
          if (!mounted) return;
          
          logger.debug('Status da assinatura:', status);
          
          if (status === 'SUBSCRIBED') {
            logger.info('Assinatura configurada com sucesso', { projectId: id }, { context: 'KanbanBoard' });
            retryCount = 0;
            isReconnecting = false;
            
            // Configurar heartbeat com backoff exponencial
            const setupHeartbeat = () => {
              if (subscription && mounted) {
                try {
                  subscription.send({
                    type: 'broadcast',
                    event: 'heartbeat',
                    payload: { timestamp: new Date().toISOString() }
                  });
                  
                  // Aumentar intervalo do heartbeat gradualmente
                  const currentInterval = heartbeatInterval || 30000;
                  const nextInterval = Math.min(currentInterval * 1.5, 60000); // Máximo de 1 minuto
                  heartbeatInterval = nextInterval;
                  
                  heartbeatTimeout = setTimeout(setupHeartbeat, nextInterval) as unknown as NodeJS.Timeout;
                } catch (error) {
                  logger.error('Erro ao enviar heartbeat', { error, projectId: id }, { context: 'KanbanBoard' });
                  // Tentar reconectar em caso de erro
                  if (mounted) {
                    setupSubscription();
                  }
                }
              }
            };
            
            // Iniciar heartbeat com intervalo inicial de 30 segundos
            heartbeatInterval = 30000;
            setupHeartbeat();
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            // Implementar retry com backoff exponencial
            const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);
            retryCount++;
            
            logger.warn(`Assinatura fechada/erro, tentando reconectar em ${retryDelay}ms`, 
              { status, retryCount, projectId: id }, 
              { context: 'KanbanBoard' }
            );
            
            retryTimeout = setTimeout(() => {
              if (mounted) {
                  setupSubscription();
                }
            }, retryDelay) as unknown as NodeJS.Timeout;
          }
        });
    };

    subscription = setupSubscription();

    return () => {
      logger.debug('Componente desmontando, limpando assinatura...');
      mounted = false;
      cleanup();
    };
  }, [id, getProject]);

  const hasActiveFilters = searchTerm !== '' || priorityFilter !== 'all' || assigneeFilter !== 'all';
  
  const clearFilters = () => {
    setSearchTerm('');
    setPriorityFilter('all');
    setAssigneeFilter('all');
  };

  const columns = [
    {
      id: 'todo',
      title: 'A Fazer',
      status: 'todo' as const,
      color: 'bg-gray-100'
    },
    {
      id: 'doing',
      title: 'Em Progresso',
      status: 'doing' as const,
      color: 'bg-blue-100'
    },
    {
      id: 'done',
      title: 'Concluído',
      status: 'done' as const,
      color: 'bg-green-100'
    }
  ];

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: 'todo' | 'doing' | 'done') => {
    e.preventDefault();
    if (!draggedTask) return;

    try {
      logger.debug('Iniciando movimentação da tarefa:', {
        taskId: draggedTask.id,
        oldStatus: draggedTask.status,
        newStatus
      }, { context: 'KanbanBoard' });

      // Atualizar o estado local otimisticamente
      setProject(prevProject => {
        if (!prevProject) return null;
        return {
          ...prevProject,
          tasks: prevProject.tasks?.map(task =>
            task.id === draggedTask.id
              ? { ...task, status: newStatus, updated_at: new Date().toISOString() }
              : task
          )
        };
      });

      // Atualizar no banco de dados
      await updateTask(draggedTask.id, {
        status: newStatus,
        updated_at: new Date().toISOString()
      });

      logger.debug('Tarefa movida com sucesso', { taskId: draggedTask.id, newStatus }, { context: 'KanbanBoard' });
      toast.success('Tarefa movida com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao mover tarefa', { error, taskId: draggedTask.id }, { context: 'KanbanBoard', showToast: true });
      toast.error('Erro ao mover tarefa: ' + error.message);
      
      // Reverter o estado em caso de erro
      setProject(prevProject => {
        if (!prevProject) return null;
        return {
          ...prevProject,
          tasks: prevProject.tasks?.map(task =>
            task.id === draggedTask.id
              ? { ...task, status: draggedTask.status }
              : task
          )
        };
      });
    } finally {
      setDraggedTask(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500';
      case 'medium':
        return 'border-l-yellow-500';
      case 'low':
        return 'border-l-green-500';
      default:
        return 'border-l-gray-500';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-500 hover:bg-green-600';
      case 'doing':
        return 'bg-blue-500 hover:bg-blue-600';
      default:
        return 'bg-red-500 hover:bg-red-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'done':
        return 'Concluída';
      case 'doing':
        return 'Em Progresso';
      default:
        return 'Pendente';
    }
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
    setIsTaskDetailOpen(true);
  };

  const TaskCard = ({ task }: { task: Task }) => (
    <Card 
      className={`mb-3 cursor-move hover:shadow-md transition-shadow border-l-4 ${getPriorityColor(task.priority)}`} 
      draggable 
      onDragStart={() => handleDragStart(task)} 
      onClick={() => handleTaskClick(task)}
    >
      <CardContent className="p-4">
        <h4 className="font-medium text-sm mb-2">{task.title}</h4>
        {task.description && (
          <LinkifiedText 
            text={task.description} 
            className="text-xs mb-3 line-clamp-2 text-slate-50"
          />
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            <Badge className={`text-white ${getStatusColor(task.status)}`}>
              {getStatusLabel(task.status)}
            </Badge>
            <Badge 
              variant={task.priority === 'high' ? 'destructive' : task.priority === 'medium' ? 'default' : 'secondary'} 
              className="text-xs"
            >
              {task.priority}
            </Badge>
          </div>
          
          <div className="flex items-center space-x-2 text-xs text-gray-500">
            {task.assigned_to && (
              <div className="flex items-center">
                <User className="h-3 w-3 mr-1" />
                <span className="text-slate-50">{assigneesProfiles[task.assigned_to]?.name || 'Usuário'}</span>
              </div>
            )}
            {task.due_date && (
              <div className="flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                <span>{new Date(task.due_date).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Carregando projeto...</p>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-500">Projeto não encontrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" size="sm" asChild>
            <Link to={`/projects/${project.id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar ao Projeto
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-slate-50">{project.name}</h1>
            <p className="text-slate-50">Quadro Kanban</p>
          </div>
        </div>
        <Button onClick={() => setIsTaskDialogOpen(true)} className="bg-gradient-to-r from-blue-600 to-purple-600">
          <Plus className="mr-2 h-4 w-4" />
          Nova Tarefa
        </Button>
      </div>

      <KanbanFilters 
        searchTerm={searchTerm} 
        onSearchChange={setSearchTerm} 
        priorityFilter={priorityFilter} 
        onPriorityFilterChange={setPriorityFilter} 
        assigneeFilter={assigneeFilter} 
        onAssigneeFilterChange={setAssigneeFilter} 
        assignees={assignees} 
        assigneesProfiles={assigneesProfiles}
        onClearFilters={clearFilters} 
        hasActiveFilters={hasActiveFilters} 
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-[calc(100vh-300px)]">
        {columns.map(column => {
          const columnTasks = filteredTasks.filter(task => task.status === column.status);
          return (
            <div 
              key={column.id} 
              className={`${column.color} rounded-lg p-4`} 
              onDragOver={handleDragOver} 
              onDrop={e => handleDrop(e, column.status)}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900">{column.title}</h3>
                <Badge variant="secondary" className="bg-blue-500">
                  {columnTasks.length}
                </Badge>
              </div>
              
              <div className="space-y-3 min-h-[200px]">
                {columnTasks.map(task => (
                  <TaskCard key={task.id} task={task} />
                ))}
                
                {columnTasks.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <p className="text-sm">Nenhuma tarefa</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDialog 
        open={isTaskDialogOpen} 
        onOpenChange={setIsTaskDialogOpen} 
        projectId={project.id} 
      />

      <TaskDetailDialog 
        open={isTaskDetailOpen} 
        onOpenChange={setIsTaskDetailOpen} 
        task={selectedTask} 
        projectId={project.id} 
      />
    </div>
  );
};

export default KanbanBoard;