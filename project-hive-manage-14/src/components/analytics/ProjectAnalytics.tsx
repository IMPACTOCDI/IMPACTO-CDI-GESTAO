import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from 'recharts';
import { Project } from '../../contexts/ProjectContext';
import { Calendar, Users, Clock, CheckCircle, Download } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Database } from '@/integrations/supabase/types';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';

interface ProjectAnalyticsProps {
  projects: Project[];
  dateRange: number;
  selectedProject: string;
}

const ProjectAnalytics: React.FC<ProjectAnalyticsProps> = ({
  projects,
  dateRange,
  selectedProject
}) => {
  // Buscar dados atualizados do Supabase
  const { data: realtimeData, isLoading } = useQuery({
    queryKey: ['analytics-projects', selectedProject, dateRange],
    queryFn: async () => {
      // Buscar TODAS as tarefas, não apenas as dos últimos X dias
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*, projects(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return tasks;
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const filteredProjects = selectedProject === 'all' 
    ? projects 
    : projects.filter(p => p.id === selectedProject);

  const projectMetrics = useMemo(() => {
    if (isLoading || !realtimeData) {
      return [];
    }

    return filteredProjects.map(project => {
      const projectTasks = realtimeData.filter(t => t.project_id === project.id);
      const totalTasks = projectTasks.length;
      const completedTasks = projectTasks.filter(t => t.status === 'done').length;
      const inProgressTasks = projectTasks.filter(t => t.status === 'doing').length;
      const todoTasks = projectTasks.filter(t => t.status === 'todo').length;
      
      const overdueTasks = projectTasks.filter(t => 
        t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
      ).length;

      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Calcular duração do projeto
      const startDate = project.start_date ? new Date(project.start_date) : new Date();
      const endDate = project.end_date ? new Date(project.end_date) : new Date();
      const duration = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      // Tarefas por prioridade
      const highPriorityTasks = projectTasks.filter(t => t.priority === 'high').length;
      const mediumPriorityTasks = projectTasks.filter(t => t.priority === 'medium').length;
      const lowPriorityTasks = projectTasks.filter(t => t.priority === 'low').length;

      return {
        id: project.id,
        name: project.name,
        start_date: project.start_date,
        end_date: project.end_date,
        status: project.status,
        color: project.color,
        members: project.members?.length || 0,
        totalTasks,
        completedTasks,
        inProgressTasks,
        todoTasks,
        overdueTasks,
        completionRate,
        duration,
        highPriorityTasks,
        mediumPriorityTasks,
        lowPriorityTasks,
        visibility: project.visibility
      };
    });
  }, [filteredProjects, realtimeData, isLoading]);

  // Dados para gráfico de barras
  const chartData = projectMetrics.map(project => ({
    name: project.name.length > 15 ? project.name.substring(0, 15) + '...' : project.name,
    completed: project.completedTasks,
    inProgress: project.inProgressTasks,
    todo: project.todoTasks,
    overdue: project.overdueTasks
  }));

  const chartConfig = {
    completed: { label: 'Concluídas', color: '#22c55e' },
    inProgress: { label: 'Em Progresso', color: '#3b82f6' },
    todo: { label: 'Pendentes', color: '#f59e0b' },
    overdue: { label: 'Atrasadas', color: '#ef4444' }
  };

  const averageCompletion = projectMetrics.length > 0 
    ? projectMetrics.reduce((acc, p) => acc + p.completionRate, 0) / projectMetrics.length 
    : 0;

  // Função para exportar relatório completo de todos os projetos
  const exportAllProjectsReport = async () => {
    try {
      toast({
        title: "Preparando relatório...",
        description: "Coletando dados de todos os projetos",
      });

      // Buscar projetos básicos primeiro
      const { data: allProjects, error: projectsError } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (projectsError) {
        console.error('Erro ao buscar projetos:', projectsError);
        throw projectsError;
      }

      if (!allProjects || allProjects.length === 0) {
        toast({
          title: "Nenhum projeto encontrado",
          description: "Não há projetos para exportar",
          variant: "destructive",
        });
        return;
      }

      // Buscar todas as tarefas
      const { data: allTasks, error: tasksError } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });


      if (tasksError) {
        console.error('Erro ao buscar tarefas:', tasksError);
        throw tasksError;
      }

      // Buscar todos os comentários
      const { data: allComments, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: false });



      if (commentsError) {
        console.error('Erro ao buscar comentários:', commentsError);
        throw commentsError;
      }

      // Buscar todos os membros da equipe
      const { data: allTeamMembers, error: teamError } = await supabase
        .from('project_members')
        .select('*');


      if (teamError) {
        console.error('Erro ao buscar membros da equipe:', teamError);
        throw teamError;
      }

      // Buscar todos os perfis
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('id, name, email');


      if (profilesError) {
        console.error('Erro ao buscar perfis:', profilesError);
        throw profilesError;
      }

      const profilesMap = profiles?.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {} as Record<string, { id: string; name: string; email: string }>) || {};


      // Criar workbook
      const wb = XLSX.utils.book_new();

      // Aba de resumo geral
      const summaryData = [
        ['Relatório Geral de Projetos'],
        ['Data de geração:', new Date().toLocaleString('pt-BR')],
        [''],
        ['Resumo por Projeto'],
        ['Nome do Projeto', 'Status', 'Total de Tarefas', 'Concluídas', 'Em Progresso', 'Pendentes', 'Atrasadas', 'Taxa de Conclusão (%)', 'Membros', 'Data Início', 'Data Fim']
      ];

      allProjects?.forEach(project => {
        const projectTasks = allTasks?.filter(task => task.project_id === project.id) || [];
        const projectMembers = allTeamMembers?.filter(member => member.project_id === project.id) || [];
        
        const totalTasks = projectTasks.length;
        const completedTasks = projectTasks.filter(t => t.status === 'done').length;
        const inProgressTasks = projectTasks.filter(t => t.status === 'doing').length;
        const todoTasks = projectTasks.filter(t => t.status === 'todo').length;
        const overdueTasks = projectTasks.filter(t => 
          t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
        ).length;
        const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        summaryData.push([
          project.name,
          project.status,
          totalTasks,
          completedTasks,
          inProgressTasks,
          todoTasks,
          overdueTasks,
          Math.round(completionRate),
          projectMembers.length,
          project.start_date ? new Date(project.start_date).toLocaleDateString('pt-BR') : '',
          project.end_date ? new Date(project.end_date).toLocaleDateString('pt-BR') : ''
        ]);
      });

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumo Geral');

      // Criar uma aba para cada projeto
      const usedSheetNames = new Set<string>();
      
      allProjects?.forEach(project => {
        const projectTasks = allTasks?.filter(task => task.project_id === project.id) || [];
        const projectMembers = allTeamMembers?.filter(member => member.project_id === project.id) || [];
        
        // Dados das tarefas do projeto
        const tasksData = [
          ['Relatório do Projeto: ' + project.name],
          ['Data de geração:', new Date().toLocaleString('pt-BR')],
          ['Status do Projeto:', project.status],
          ['Data de Início:', project.start_date ? new Date(project.start_date).toLocaleDateString('pt-BR') : ''],
          ['Data de Fim:', project.end_date ? new Date(project.end_date).toLocaleDateString('pt-BR') : ''],
          [''],
          ['Tarefas do Projeto'],
          ['Título', 'Descrição', 'Status', 'Prioridade', 'Responsável', 'Data de Criação', 'Data de Vencimento', 'Tarefas sem interação há mais de 7 dias', 'Comentário', 'Autor do Comentário', 'Data do Comentário']
        ];

        // Ordenar tarefas alfabeticamente por título
        const sortedTasks = projectTasks.sort((a, b) => 
          (a.title || '').localeCompare(b.title || '', 'pt-BR', { sensitivity: 'base' })
        );

        sortedTasks.forEach(task => {
          const assignedTo = task.assigned_to ? profilesMap[task.assigned_to]?.name || 'Não atribuído' : 'Não atribuído';
          const createdBy = task.created_by ? profilesMap[task.created_by]?.name || 'Desconhecido' : 'Desconhecido';
          
          // Buscar comentários desta tarefa
          const taskComments = allComments?.filter(comment => comment.task_id === task.id) || [];
          
          // Verificar se a tarefa está sem interação há mais de 7 dias
          const isInactive = (() => {
            const now = new Date();
            const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));
            
            // Se tem comentários, verificar o último comentário
            if (taskComments.length > 0) {
              const lastComment = taskComments.sort((a, b) => 
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
              )[0];
              const lastCommentDate = new Date(lastComment.created_at);
              return lastCommentDate < sevenDaysAgo;
            } else {
              // Se não tem comentários, verificar a data de criação da tarefa
              const taskCreatedDate = new Date(task.created_at);
              return taskCreatedDate < sevenDaysAgo;
            }
          })();
          
          if (taskComments.length > 0) {
            // Se tem comentários, criar uma linha para cada comentário
            taskComments.forEach(comment => {
              const commentAuthor = comment.created_by ? profilesMap[comment.created_by]?.name || 'Desconhecido' : 'Desconhecido';
              
              tasksData.push([
                task.title,
                task.description || '',
                task.status,
                task.priority,
                assignedTo,
                task.created_at ? new Date(task.created_at).toLocaleDateString('pt-BR') : '',
                task.due_date ? new Date(task.due_date).toLocaleDateString('pt-BR') : '',
                isInactive ? 'Sim' : 'Não',
                comment.content || '',
                commentAuthor,
                comment.created_at ? new Date(comment.created_at).toLocaleDateString('pt-BR') : ''
              ]);
            });
          } else {
            // Se não tem comentários, criar uma linha sem comentário
            tasksData.push([
              task.title,
              task.description || '',
              task.status,
              task.priority,
              assignedTo,
              task.created_at ? new Date(task.created_at).toLocaleDateString('pt-BR') : '',
              task.due_date ? new Date(task.due_date).toLocaleDateString('pt-BR') : '',
              isInactive ? 'Sim' : 'Não',
              '',
              '',
              ''
            ]);
          }
        });

        // Adicionar seção de membros da equipe
        tasksData.push(['']);
        tasksData.push(['Membros da Equipe']);
        tasksData.push(['Nome', 'Email', 'Função', 'Data de Entrada']);
        
        projectMembers.forEach(member => {
          const profile = profilesMap[member.user_id];
          tasksData.push([
            profile?.name || 'Desconhecido',
            profile?.email || '',
            member.role || '',
            member.joined_at ? new Date(member.joined_at).toLocaleDateString('pt-BR') : ''
          ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(tasksData);
        
        // Ajustar largura das colunas
        const wscols = [
          { wch: 30 }, // Título
          { wch: 50 }, // Descrição
          { wch: 15 }, // Status
          { wch: 15 }, // Prioridade
          { wch: 20 }, // Responsável
          { wch: 15 }, // Data de Criação
          { wch: 15 }, // Data de Vencimento
          { wch: 35 }, // Tarefas sem interação há mais de 7 dias
          { wch: 50 }, // Comentário
          { wch: 20 }, // Autor do Comentário
          { wch: 15 }  // Data do Comentário
        ];
        ws['!cols'] = wscols;

        // Nome da aba (limitado a 31 caracteres e sem caracteres especiais)
        const cleanProjectName = project.name
          .replace(/[:\\\/\?\*\[\]]/g, '') // Remove caracteres inválidos
          .replace(/\s+/g, ' ') // Remove espaços múltiplos
          .trim(); // Remove espaços no início e fim
        
        let sheetName = cleanProjectName.length > 31 
          ? cleanProjectName.substring(0, 28) + '...' 
          : cleanProjectName || 'Projeto'; // Fallback se o nome ficar vazio

        // Evitar nomes duplicados
        let finalSheetName = sheetName;
        let counter = 1;
        while (usedSheetNames.has(finalSheetName)) {
          const baseName = sheetName.length > 25 ? sheetName.substring(0, 25) : sheetName;
          finalSheetName = `${baseName}_${counter}`;
          counter++;
        }
        
        usedSheetNames.add(finalSheetName);

        XLSX.utils.book_append_sheet(wb, ws, finalSheetName);
      });

      // Salvar arquivo
      const fileName = `Relatorio_Completo_Projetos_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      
      toast({
        title: "Relatório exportado com sucesso!",
        description: `Arquivo ${fileName} foi baixado`,
      });
    } catch (error: unknown) {
      console.error('Erro detalhado ao exportar relatório:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      const errorStack = error instanceof Error ? error.stack : undefined;
      console.error('Stack trace:', errorStack);
      toast({
        title: "Erro ao exportar relatório",
        description: `Erro: ${errorMessage}`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Cabeçalho com botão de exportação */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Análise de Projetos</h2>
          <p className="text-muted-foreground">
            Métricas detalhadas e performance dos projetos
          </p>
        </div>
        <Button 
          onClick={exportAllProjectsReport}
          className="flex items-center gap-2"
          variant="outline"
        >
          <Download className="h-4 w-4" />
          Exportar Relatório Completo
        </Button>
      </div>

      {/* Métricas Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Projetos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectMetrics.length}</div>
            <p className="text-xs text-muted-foreground">
              {projectMetrics.filter(p => p.status === 'active').length} ativos
            </p>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Conclusão Média</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(averageCompletion)}%</div>
            <Progress value={averageCompletion} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Membros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {[...new Set(projectMetrics.flatMap(p => p.members))].length}
            </div>
            <p className="text-xs text-muted-foreground">
              membros únicos
            </p>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duração Média</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {Math.round(projectMetrics.reduce((acc, p) => acc + p.duration, 0) / Math.max(projectMetrics.length, 1))}
            </div>
            <p className="text-xs text-muted-foreground">dias por projeto</p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Tarefas por Projeto */}
      <Card className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
        <CardHeader>
          <CardTitle>Distribuição de Tarefas por Projeto</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="completed" stackId="a" fill="#22c55e" />
                <Bar dataKey="inProgress" stackId="a" fill="#3b82f6" />
                <Bar dataKey="todo" stackId="a" fill="#f59e0b" />
                <Bar dataKey="overdue" stackId="a" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Lista Detalhada de Projetos */}
      <div className="space-y-4">
        {projectMetrics.map((project, index) => (
          <Card key={project.id} className="animate-fade-in" style={{ animationDelay: `${0.5 + index * 0.1}s` }}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${project.color}`} />
                  {project.name}
                </CardTitle>
                <div className="flex gap-2">
                  <Badge variant={project.status === 'active' ? 'default' : 'secondary'}>
                    {project.status}
                  </Badge>
                  <Badge variant="outline">
                    {project.visibility}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Progress Bar */}
              <div>
                <div className="flex justify-between text-sm mb-1">
                  <span>Progresso</span>
                  <span>{Math.round(project.completionRate)}%</span>
                </div>
                <Progress value={project.completionRate} />
              </div>

              {/* Estatísticas */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total:</span>
                    <span className="font-medium">{project.totalTasks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Concluídas:</span>
                    <span className="font-medium text-green-600">{project.completedTasks}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Em Progresso:</span>
                    <span className="font-medium text-blue-600">{project.inProgressTasks}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Membros:</span>
                    <span className="font-medium">{project.members}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duração:</span>
                    <span className="font-medium">{project.duration} dias</span>
                  </div>
                  {project.overdueTasks > 0 && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Atrasadas:</span>
                      <span className="font-medium text-red-600">{project.overdueTasks}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Prioridades */}
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground mb-2">Tarefas por Prioridade:</p>
                <div className="flex gap-4 text-xs">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-red-500 rounded-full" />
                    <span>Alta: {project.highPriorityTasks}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                    <span>Média: {project.mediumPriorityTasks}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full" />
                    <span>Baixa: {project.lowPriorityTasks}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default ProjectAnalytics;
