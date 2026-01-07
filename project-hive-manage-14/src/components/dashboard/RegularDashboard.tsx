import React, { useEffect, useState } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Clock, User, TrendingUp, Eye, Calendar, Plus, FolderOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Database } from '@/integrations/supabase/types';
import { getOverdueTasks, getUpcomingTasks, getOverdueProjects } from '@/lib/tasks';
import { supabase } from '@/lib/supabase';
import { toast } from '@/components/ui/use-toast';
import { logger } from '@/lib/logger';
import InactiveTaskAlerts from '@/components/notifications/InactiveTaskAlerts';

type Task = Database['public']['Tables']['tasks']['Row'] & {
  tags?: string[];
  comments?: Database['public']['Tables']['comments']['Row'][];
  projectName?: string;
};

type Project = Database['public']['Tables']['projects']['Row'] & {
  tasks: Task[];
};

type ProjectWithOverdueTasks = {
  id: string;
  name: string;
  overdueTasks: number;
};

const RegularDashboard = () => {
  const { projects } = useProject();
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [overdueProjects, setOverdueProjects] = useState<ProjectWithOverdueTasks[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, { name: string }>>({});

  const totalProjects = projects.length;
  const activeProjects = projects.filter(p => p.status === 'active').length;
  const completedProjects = projects.filter(p => p.status === 'completed').length;

  const recentTasks = projects
    .flatMap(project => project.tasks.map(task => ({
      ...task,
      projectName: project.name
    })))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5);

  const getTaskStatus = (status: string) => {
    switch (status) {
      case 'done':
        return { label: 'Concluída', variant: 'default' as const };
      case 'doing':
        return { label: 'Em Progresso', variant: 'secondary' as const };
      default:
        return { label: 'Pendente', variant: 'outline' as const };
    }
  };

  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const [overdueTasksData, upcomingTasksData, overdueProjectsData] = await Promise.all([
          getOverdueTasks(),
          getUpcomingTasks(7),
          getOverdueProjects()
        ]);

        setOverdueTasks(overdueTasksData);
        setUpcomingTasks(upcomingTasksData);
        setOverdueProjects(overdueProjectsData);
      } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
        toast.error('Erro ao carregar dados do dashboard');
      }
    };

    loadDashboardData();

    // Configurar assinaturas em tempo real
    logger.debug('[Dashboard] Configurando assinaturas em tempo real...');

    let retryCount = 0;
    const maxRetries = 5;
    const baseDelay = 1000; // 1 segundo
    let setupTimeout: NodeJS.Timeout;

    const getRetryDelay = () => {
      // Backoff exponencial com jitter
      const exponentialDelay = baseDelay * Math.pow(2, retryCount);
      const jitter = Math.random() * 1000; // Adiciona até 1 segundo de jitter
      return exponentialDelay + jitter;
    };

    const tasksSubscription = supabase
      .channel('dashboard_tasks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks'
        },
        async (payload) => {
          logger.debug('[Dashboard] Mudança detectada em tarefas:', payload);
          
          // Debounce para evitar múltiplas atualizações
          clearTimeout(setupTimeout);
          setupTimeout = setTimeout(async () => {
          try {
            await loadDashboardData();
              logger.debug('[Dashboard] Dados atualizados com sucesso');
          } catch (error) {
              logger.error('[Dashboard] Erro ao atualizar dados:', error);
              toast.error('Erro ao atualizar dados do dashboard');
          }
          }, 1000);
        }
      )
      .subscribe((status) => {
        logger.debug('[Dashboard] Status da assinatura:', status);
        
        if (status === 'SUBSCRIBED') {
          retryCount = 0;
          logger.debug('[Dashboard] Assinatura estabelecida com sucesso');
        } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED' || status === 'TIMED_OUT') {
          logger.error('[Dashboard] Erro na assinatura', { status, retryCount });
          
          if (retryCount < maxRetries) {
            retryCount++;
            const delay = getRetryDelay();
            logger.debug(`[Dashboard] Tentativa ${retryCount} de reconexão em ${delay}ms`);
            setTimeout(() => {
              if (tasksSubscription.state === 'CLOSED') {
                tasksSubscription.subscribe();
              }
            }, delay);
          } else {
            logger.error('[Dashboard] Máximo de tentativas de reconexão atingido');
            toast.error('Erro de conexão com o servidor. Por favor, recarregue a página.');
          }
        }
      });

    // Verificar saúde da assinatura a cada 30 segundos
    const healthCheckInterval = setInterval(() => {
      if (tasksSubscription.state !== 'SUBSCRIBED') {
        logger.warn('[Dashboard] Assinatura em estado não ideal:', tasksSubscription.state);
        tasksSubscription.subscribe();
      }
    }, 30000);

    return () => {
      logger.debug('[Dashboard] Limpando assinatura...');
      clearInterval(healthCheckInterval);
      clearTimeout(setupTimeout);
      tasksSubscription.unsubscribe();
    };
  }, [getOverdueTasks, getUpcomingTasks]);

  // Buscar perfis de usuários quando as tarefas forem carregadas
  useEffect(() => {
    const fetchUserProfiles = async () => {
      try {
        // Buscar perfis de usuários para exibir nomes em vez de IDs
        const allTasks = [...overdueTasks, ...upcomingTasks, ...recentTasks];
        const userIds = [...new Set(allTasks
          .map(task => task.assigned_to)
          .filter((id): id is string => id !== null))];
        
        if (userIds.length > 0) {
          const { data, error } = await supabase
            .from('profiles')
            .select('id, name')
            .in('id', userIds);

          if (!error && data) {
            const profilesMap = data.reduce((acc: Record<string, { name: string }>, profile: any) => {
              acc[profile.id] = profile;
              return acc;
            }, {});
            
            setUserProfiles(profilesMap);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar perfis de usuários:', error);
      }
    };

    if (overdueTasks.length > 0 || upcomingTasks.length > 0 || recentTasks.length > 0) {
      fetchUserProfiles();
    }
  }, [overdueTasks, upcomingTasks, recentTasks]);

  // Função para obter o nome do usuário a partir do ID
  const getUserName = (userId: string | null) => {
    if (!userId) return 'Não atribuído';
    return userProfiles[userId]?.name || userId;
  };

  return (
    <div className="space-y-6 p-6 bg-background min-h-screen">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral dos seus projetos e tarefas</p>
        </div>
        <div className="flex gap-3">
          <Button asChild className="gradient-primary hover:opacity-90">
            <Link to="/projects">
              <Plus className="mr-2 h-4 w-4" />
              Novo Projeto
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-border hover:bg-accent">
            <Link to="/calendar">
              <Calendar className="mr-2 h-4 w-4" />
              Calendário
            </Link>
          </Button>
        </div>
      </div>

      {/* Alerta destacado para tarefas atrasadas */}
      {overdueTasks.length > 0 && (
        <Alert className="bg-red-500/20 border-2 border-red-500 text-red-600 animate-pulse shadow-lg">
          <AlertTriangle className="h-6 w-6 text-red-500" />
          <AlertDescription className="font-bold text-lg">
            🚨 ATENÇÃO: {overdueTasks.length} {overdueTasks.length === 1 ? 'tarefa atrasada precisa' : 'tarefas atrasadas precisam'} de atenção imediata!
          </AlertDescription>
        </Alert>
      )}

      {/* Alertas de Tarefas Inativas */}
      <InactiveTaskAlerts 
        maxAlerts={3}
        showDetails={true}
        onTaskClick={(taskId) => {
          // Navegar para a tarefa quando clicada
          window.location.href = `/tasks/${taskId}`;
        }}
      />

      {/* Grid com Stats Cards e Ações Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stats Cards */}
        <Card className="card-dark animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Total de Projetos</CardTitle>
            <FolderOpen className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalProjects}</div>
            <p className="text-xs text-muted-foreground">
              {activeProjects} ativos, {completedProjects} concluídos, {overdueProjects.length} {overdueProjects.length === 1 ? 'com atraso' : 'com atrasos'}
            </p>
          </CardContent>
        </Card>

        <Card className="card-dark animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">Tarefas Recentes</CardTitle>
            <Clock className="h-5 w-5 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{recentTasks.length}</div>
            <p className="text-xs text-muted-foreground">
              Últimas {recentTasks.length} {recentTasks.length === 1 ? 'tarefa criada' : 'tarefas criadas'}
            </p>
          </CardContent>
        </Card>

        <Card className="card-dark animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">
              {overdueTasks.length > 0 ? (
                <span className="flex items-center gap-1">
                  Tarefas Atrasadas
                  <Badge variant="destructive" className="ml-1">{overdueTasks.length}</Badge>
                </span>
              ) : (
                "Próximos Prazos"
              )}
            </CardTitle>
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">
              {overdueTasks.length > 0 ? overdueTasks.length : upcomingTasks.length}
            </div>
            <p className="text-xs text-muted-foreground">
              {overdueTasks.length > 0 
                ? 'Precisam de atenção imediata' 
                : `Próximos ${upcomingTasks.length} ${upcomingTasks.length === 1 ? 'dia' : 'dias'}`}
            </p>
          </CardContent>
        </Card>

        {/* Tarefas com Atraso */}
        <Card className="card-dark animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-card-foreground flex items-center">
              <AlertTriangle className="mr-2 h-4 w-4 text-red-500" /> 
              Tarefas com Atraso
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-2xl font-bold">{overdueTasks.length}</span>
                <Badge variant="destructive" className="ml-2">
                  Atrasadas
                </Badge>
              </div>
              
              {overdueTasks.length > 0 ? (
                <div className="text-sm text-muted-foreground">
                  <p>Você tem {overdueTasks.length} {overdueTasks.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'} que precisam de atenção.</p>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  <p>Parabéns! Você não tem tarefas atrasadas.</p>
                </div>
              )}
              
              <Button variant="outline" size="sm" asChild className="mt-2">
                <Link to="/tasks" className="w-full flex items-center justify-center">
                  <Eye className="mr-2 h-4 w-4" /> Ver Todas as Tarefas
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Tasks */}
      <Card className="card-dark">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Tarefas Recentes</CardTitle>
              <CardDescription>Últimas tarefas criadas</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/tasks">
                <Eye className="mr-2 h-4 w-4" />
                Ver Todas
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recentTasks.map((task, index) => {
              const status = getTaskStatus(task.status);
              return (
                <div 
                  key={task.id}
                  className="p-4 rounded-lg border border-border bg-accent/20 hover:bg-accent/30 transition-colors animate-slide-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{task.projectName}</span>
                        {task.due_date && (
                          <span>Venc: {new Date(task.due_date).toLocaleDateString('pt-BR')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={status.variant}>
                        {status.label}
                      </Badge>
                      {task.assigned_to && (
                        <div className="flex items-center">
                          <User className="h-3 w-3 text-muted-foreground mr-1" />
                          <span className="text-xs text-muted-foreground">{getUserName(task.assigned_to)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {recentTasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <FolderOpen className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Nenhuma tarefa recente</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Upcoming Tasks */}
      <Card className="card-dark">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-foreground">Próximos Prazos</CardTitle>
              <CardDescription>Tarefas que vencem nos próximos 7 dias</CardDescription>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/tasks">
                <Eye className="mr-2 h-4 w-4" />
                Ver Todas
              </Link>
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {upcomingTasks.map((task, index) => {
              const status = getTaskStatus(task.status);
              return (
                <div 
                  key={task.id}
                  className="p-4 rounded-lg border border-border bg-accent/20 hover:bg-accent/30 transition-colors animate-slide-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{task.projectName}</span>
                        {task.due_date && (
                          <span>Venc: {new Date(task.due_date).toLocaleDateString('pt-BR')}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <Badge variant={status.variant}>
                        {status.label}
                      </Badge>
                      {task.assigned_to && (
                        <div className="flex items-center">
                          <User className="h-3 w-3 text-muted-foreground mr-1" />
                          <span className="text-xs text-muted-foreground">{getUserName(task.assigned_to)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            {upcomingTasks.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Clock className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Nenhum prazo próximo</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default RegularDashboard;
