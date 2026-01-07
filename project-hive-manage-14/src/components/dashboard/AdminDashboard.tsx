import React, { useState, useEffect, useCallback } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, Clock, User, TrendingUp, Eye, Calendar, CheckCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import UserManagement from '../admin/UserManagement';
import InactiveTaskAlerts from '@/components/notifications/InactiveTaskAlerts';
import { Database } from '@/integrations/supabase/types';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';
import { toast } from 'react-hot-toast';

type Task = Database['public']['Tables']['tasks']['Row'] & {
  tags?: string[];
  comments?: Database['public']['Tables']['comments']['Row'][];
  projectName?: string;
  projects?: {
    name: string;
  };
};

const AdminDashboard = () => {
  const { projects, getOverdueTasks, getUpcomingTasks } = useProject();
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'users'>('dashboard');
  const [overdueTasks, setOverdueTasks] = useState<Task[]>([]);
  const [upcomingTasks, setUpcomingTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userProfiles, setUserProfiles] = useState<Record<string, { name: string }>>({});

  const loadDashboardData = useCallback(async () => {
    if (!user) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      logger.debug('[AdminDashboard] Iniciando carregamento de dados...');
      
      const [overdueTasksData, upcomingTasksData] = await Promise.all([
        getOverdueTasks(),
        getUpcomingTasks(7)
      ]);

      setOverdueTasks(overdueTasksData);
      setUpcomingTasks(upcomingTasksData);
      
      logger.debug('[AdminDashboard] Dados carregados com sucesso', {
        overdueTasks: overdueTasksData.length,
        upcomingTasks: upcomingTasksData.length
      });
    } catch (error) {
      logger.error('[AdminDashboard] Erro ao carregar dados', { error });
      setError('Erro ao carregar dados do dashboard');
      toast.error('Erro ao carregar dados do dashboard');
    } finally {
      setIsLoading(false);
    }
  }, [user, getOverdueTasks, getUpcomingTasks]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  // Buscar perfis de usuários para exibir nomes em vez de IDs
  useEffect(() => {
    const fetchUserProfiles = async () => {
      // Combinar IDs de usuários de tarefas atrasadas e próximas
      const allTasks = [...overdueTasks, ...upcomingTasks];
      const userIds = [...new Set(allTasks
        .map(task => task.assigned_to)
        .filter((id): id is string => id !== null))];
      
      if (userIds.length === 0) return;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', userIds);

        if (error) {
          logger.error('[AdminDashboard] Erro ao buscar perfis de usuários', { error });
          return;
        }

        const profilesMap = data.reduce((acc: Record<string, { name: string }>, profile: any) => {
          acc[profile.id] = profile;
          return acc;
        }, {});
        
        setUserProfiles(profilesMap);
      } catch (error) {
        logger.error('[AdminDashboard] Erro ao processar perfis de usuários', { error });
      }
    };

    if (overdueTasks.length > 0 || upcomingTasks.length > 0) {
      fetchUserProfiles();
    }
  }, [overdueTasks, upcomingTasks]);

  // Configurar assinaturas em tempo real
  useEffect(() => {
    if (!user) return;

    logger.debug('[AdminDashboard] Configurando assinaturas em tempo real...');

    let retryCount = 0;
    const maxRetries = 5;
    const retryDelay = 5000;
    let subscription: ReturnType<typeof supabase.channel> | null = null;
    let retryTimeout: NodeJS.Timeout | null = null;
    let isComponentMounted = true;

    const setupSubscription = async () => {
      try {
        // Limpar assinatura anterior se existir
        if (subscription) {
          try {
            await subscription.unsubscribe();
          } catch (error) {
            logger.error('[AdminDashboard] Erro ao limpar assinatura anterior:', error);
          }
        }

        // Limpar timeout anterior se existir
        if (retryTimeout) {
          clearTimeout(retryTimeout);
        }

        // Criar nova assinatura
        subscription = supabase
          .channel('admin_dashboard_tasks')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'tasks'
            },
            async (payload) => {
              if (!isComponentMounted) return;
              
              logger.debug('[AdminDashboard] Mudança detectada em tarefas:', payload);
              try {
                await loadDashboardData();
                logger.debug('[AdminDashboard] Dados atualizados com sucesso');
              } catch (error) {
                logger.error('[AdminDashboard] Erro ao atualizar dados:', error);
              }
            }
          )
          .subscribe(async (status) => {
            if (!isComponentMounted) return;

            logger.debug('[AdminDashboard] Status da assinatura:', status);
            
            if (status === 'SUBSCRIBED') {
              retryCount = 0;
              logger.debug('[AdminDashboard] Assinatura estabelecida com sucesso');
            } else if (status === 'CHANNEL_ERROR' || status === 'CLOSED') {
              logger.error('[AdminDashboard] Erro na assinatura', { status, retryCount });
              
              if (retryCount < maxRetries && isComponentMounted) {
                retryCount++;
                logger.debug(`[AdminDashboard] Tentativa ${retryCount} de reconexão em ${retryDelay}ms`);
                
                retryTimeout = setTimeout(async () => {
                  if (isComponentMounted) {
                    await setupSubscription();
                  }
                }, retryDelay);
              } else {
                logger.error('[AdminDashboard] Máximo de tentativas de reconexão atingido');
                toast.error('Não foi possível estabelecer conexão em tempo real. Algumas atualizações podem não ser refletidas imediatamente.');
              }
            }
          });

        return subscription;
      } catch (error) {
        logger.error('[AdminDashboard] Erro ao configurar assinatura:', error);
        throw error;
      }
    };

    // Iniciar assinatura
    setupSubscription().catch(error => {
      logger.error('[AdminDashboard] Erro ao iniciar assinatura:', error);
    });

    // Cleanup
    return () => {
      isComponentMounted = false;
      logger.debug('[AdminDashboard] Limpando assinaturas...');
      
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
      
      if (subscription) {
        subscription.unsubscribe().catch(error => {
          logger.error('[AdminDashboard] Erro ao limpar assinatura:', error);
        });
      }
    };
  }, [user, loadDashboardData]);

  if (!user || !hasPermission('view_analytics')) {
    return null;
  }

  const totalTasks = projects.reduce((acc, project) => acc + (project.tasks?.length || 0), 0);
  const completedTasks = projects.reduce((acc, project) => 
    acc + (project.tasks?.filter(task => task.status === 'done').length || 0), 0);
  const taskProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

  const projectsWithIssues = projects.filter(project => {
    const projectOverdueTasks = (project.tasks || []).filter(task => 
      task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done'
    ).length;
    return projectOverdueTasks > 0;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-red-500 bg-red-500/10';
      case 'medium': return 'border-l-yellow-500 bg-yellow-500/10';
      case 'low': return 'border-l-green-500 bg-green-500/10';
      default: return 'border-l-gray-500 bg-gray-500/10';
    }
  };

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

  // Função para obter o nome do usuário a partir do ID
  const getUserName = (userId: string | null) => {
    if (!userId) return 'Não atribuído';
    return userProfiles[userId]?.name || userId;
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header com Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
          Dashboard Administrativo
        </h1>
        <div className="flex space-x-2 bg-muted/50 p-1 rounded-lg">
          <Button
            variant={activeTab === 'dashboard' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('dashboard')}
            className="flex items-center"
          >
            <TrendingUp className="mr-2 h-4 w-4" />
            Dashboard
          </Button>
          <Button
            variant={activeTab === 'users' ? 'default' : 'ghost'}
            onClick={() => setActiveTab('users')}
            className="flex items-center"
          >
            <User className="mr-2 h-4 w-4" />
            Usuários
          </Button>
        </div>
      </div>

      {activeTab === 'users' ? (
        <UserManagement />
      ) : (
        <>
          {error && (
            <Alert variant="destructive" className="animate-in fade-in slide-in-from-top-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Cards de Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="card-dark hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Projetos</CardTitle>
                <CardDescription>Total de projetos ativos</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col justify-between min-h-[160px]">
                <div className="flex flex-col gap-4">
                  <div className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    {projects.length}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Projetos ativos no sistema
                  </div>
                </div>
                <Link to="/projects">
                  <Button variant="link" className="p-0 h-auto text-sm mt-2">
                    <Eye className="h-3 w-3 mr-1" /> Ver todos
                  </Button>
                </Link>
              </CardContent>
            </Card>

            <Card className="card-dark hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Tarefas</CardTitle>
                <CardDescription>Progresso geral</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col justify-between min-h-[160px]">
                <div className="flex flex-col gap-4">
                  <div className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                    {completedTasks}/{totalTasks}
                  </div>
                  <div className="space-y-2">
                    <Progress value={taskProgress} className="h-2" />
                    <div className="text-sm text-muted-foreground">
                      {taskProgress.toFixed(0)}% concluído
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-dark hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Projetos com Atrasos</CardTitle>
                <CardDescription>Projetos com tarefas atrasadas</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col justify-between min-h-[160px]">
                <div className="flex flex-col gap-4">
                  <div className="text-5xl font-bold bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent">
                    {projectsWithIssues.length}
                  </div>
                  <div className="space-y-2">
                    {projectsWithIssues.length > 0 ? (
                      <div className="text-sm text-red-400 flex items-center">
                        <AlertTriangle className="h-4 w-4 mr-1" />
                        Atenção necessária!
                      </div>
                    ) : (
                      <div className="text-sm text-green-400 flex items-center">
                        <CheckCircle className="h-4 w-4 mr-1" />
                        Tudo em dia!
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="card-dark hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center text-red-500">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  Tarefas Atrasadas
                </CardTitle>
                <CardDescription>Tarefas que precisam de atenção imediata</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col justify-between min-h-[160px]">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <span className="text-5xl font-bold text-red-500">{overdueTasks.length}</span>
                    <Badge variant="destructive" className="ml-2">
                      Atrasadas
                    </Badge>
                  </div>
                  
                  {overdueTasks.length > 0 ? (
                    <div className="text-sm text-muted-foreground">
                      <p>Você tem {overdueTasks.length} {overdueTasks.length === 1 ? 'tarefa atrasada' : 'tarefas atrasadas'} que precisam de atenção imediata.</p>
                    </div>
                  ) : (
                    <div className="text-sm text-green-400 flex items-center">
                      <CheckCircle className="h-4 w-4 mr-1" />
                      <p>Parabéns! Você não tem tarefas atrasadas.</p>
                    </div>
                  )}
                </div>
                
                <Button variant="outline" size="sm" asChild className="mt-2">
                  <Link to="/tasks" className="w-full flex items-center justify-center">
                    <Eye className="mr-2 h-4 w-4" /> Ver Todas as Tarefas
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Alertas de Tarefas Inativas */}
          <InactiveTaskAlerts 
            maxAlerts={3}
            showDetails={true}
            onTaskClick={(taskId) => {
              // Navegar para a tarefa quando clicada
              window.location.href = `/tasks/${taskId}`;
            }}
          />

          {/* Cards de Tarefas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overdue Tasks */}
            <Card className="card-dark hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center text-red-400">
                  <AlertTriangle className="mr-2 h-5 w-5" />
                  Tarefas Atrasadas
                </CardTitle>
                <CardDescription>Tarefas que já passaram do prazo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {overdueTasks.slice(0, 6).map((task, index) => {
                    const status = getTaskStatus(task.status);
                    return (
                      <div 
                        key={task.id} 
                        className={`p-3 rounded-lg border-l-4 border-l-red-500 bg-red-500/5 hover:bg-red-500/10 transition-all duration-300 animate-slide-up`}
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground truncate">{task.projectName}</p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant={status.variant} className="text-xs">
                                {status.label}
                              </Badge>
                              <span className="text-xs text-red-400">
                                Venceu: {new Date(task.due_date!).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>
                          {task.assigned_to && (
                            <div className="flex items-center ml-2">
                              <User className="h-3 w-3 text-muted-foreground mr-1" />
                              <span className="text-xs text-muted-foreground">{getUserName(task.assigned_to)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {overdueTasks.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertTriangle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm">Nenhuma tarefa atrasada! 🎉</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Upcoming Tasks */}
            <Card className="card-dark hover:shadow-lg transition-all duration-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center text-yellow-400">
                  <Clock className="mr-2 h-5 w-5" />
                  Próximos Prazos
                </CardTitle>
                <CardDescription>Tarefas que vencem nos próximos 7 dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {upcomingTasks.slice(0, 6).map((task, index) => {
                    const status = getTaskStatus(task.status);
                    return (
                      <div 
                        key={task.id} 
                        className={`p-3 rounded-lg border-l-4 border-l-yellow-500 bg-yellow-500/5 hover:bg-yellow-500/10 transition-all duration-300 animate-slide-up`}
                        style={{ animationDelay: `${index * 0.1}s` }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {task.projectName || task.projects?.name || 'Projeto não encontrado'}
                            </p>
                            <div className="flex items-center space-x-2 mt-1">
                              <Badge variant={status.variant} className="text-xs">
                                {status.label}
                              </Badge>
                              <span className="text-xs text-yellow-400">
                                Vence: {new Date(task.due_date!).toLocaleDateString('pt-BR')}
                              </span>
                            </div>
                          </div>
                          {task.assigned_to && (
                            <div className="flex items-center ml-2">
                              <User className="h-3 w-3 text-muted-foreground mr-1" />
                              <span className="text-xs text-muted-foreground">{getUserName(task.assigned_to)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {upcomingTasks.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <Clock className="h-8 w-8 mx-auto mb-2 text-green-500" />
                      <p className="text-sm">Nenhum prazo próximo!</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Calendário */}
          <Card className="card-dark hover:shadow-lg transition-all duration-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Calendário de Atividades
              </CardTitle>
              <CardDescription>Visão geral das próximas atividades</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-2" />
                <p className="text-sm">Calendário em desenvolvimento</p>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};

export default AdminDashboard;
