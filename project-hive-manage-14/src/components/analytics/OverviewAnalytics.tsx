import { useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle, Calendar, Clock, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'] & {
  tasks: Database['public']['Tables']['tasks']['Row'][];
  status: 'active' | 'completed' | 'on-hold';
  members: Database['public']['Tables']['project_members']['Row'][];
};

interface OverviewAnalyticsProps {
  projects: Project[];
  dateRange: number;
  selectedProject: string;
}

interface WeeklyCompletionData {
  day: string;
  completed: number;
}

const OverviewAnalytics: React.FC<OverviewAnalyticsProps> = ({
  projects,
  dateRange,
  selectedProject
}) => {
  // Buscar dados atualizados do Supabase
  const { data: realtimeData, isLoading } = useQuery({
    queryKey: ['analytics-overview', selectedProject, dateRange],
    queryFn: async () => {
      // Buscar TODAS as tarefas, não apenas as dos últimos X dias
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return tasks;
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const filteredProjects = selectedProject === 'all' 
    ? projects 
    : projects.filter(p => p.id === selectedProject);

  const analytics = useMemo(() => {
    if (isLoading || !realtimeData) {
      return {
        totalTasks: 0,
        completedTasks: 0,
        inProgressTasks: 0,
        todoTasks: 0,
        overdueTasks: 0,
        completionRate: 0,
        tasksByStatus: [],
        projectsByStatus: [],
        weeklyCompletion: [],
        activeProjects: 0,
        totalProjects: 0
      };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - dateRange);

    const totalTasks = realtimeData.length;
    const completedTasks = realtimeData.filter(t => t.status === 'done').length;
    const inProgressTasks = realtimeData.filter(t => t.status === 'doing').length;
    const todoTasks = realtimeData.filter(t => t.status === 'todo').length;

    const overdueTasks = realtimeData.filter(t => 
      t.due_date && new Date(t.due_date) < new Date() && t.status !== 'done'
    ).length;

    const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

    // Gráfico de tarefas por status
    const tasksByStatus = [
      { name: 'Concluídas', value: completedTasks, color: '#22c55e' },
      { name: 'Em Progresso', value: inProgressTasks, color: '#3b82f6' },
      { name: 'Pendentes', value: todoTasks, color: '#f59e0b' },
      { name: 'Atrasadas', value: overdueTasks, color: '#ef4444' }
    ];

    // Gráfico de projetos por status
    const projectsByStatus = [
      { 
        name: 'Ativos', 
        value: filteredProjects.filter(p => p.status === 'active').length,
        color: '#22c55e'
      },
      { 
        name: 'Concluídos', 
        value: filteredProjects.filter(p => p.status === 'completed').length,
        color: '#3b82f6'
      },
      { 
        name: 'Em Pausa', 
        value: filteredProjects.filter(p => p.status === 'on-hold').length,
        color: '#f59e0b'
      }
    ];

    // Tendência semanal de conclusão de tarefas
    const weeklyCompletion: WeeklyCompletionData[] = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const completed = realtimeData.filter(t => {
        if (t.status !== 'done') return false;
        const updatedDate = new Date(t.updated_at);
        return updatedDate >= dayStart && updatedDate <= dayEnd;
      }).length;

      weeklyCompletion.push({
        day: date.toLocaleDateString('pt-BR', { weekday: 'short' }),
        completed
      });
    }

    return {
      totalTasks,
      completedTasks,
      inProgressTasks,
      todoTasks,
      overdueTasks,
      completionRate,
      tasksByStatus,
      projectsByStatus,
      weeklyCompletion,
      activeProjects: filteredProjects.filter(p => p.status === 'active').length,
      totalProjects: filteredProjects.length
    };
  }, [filteredProjects, dateRange, realtimeData, isLoading]);

  const chartConfig = {
    completed: { label: 'Concluídas', color: '#22c55e' },
    inProgress: { label: 'Em Progresso', color: '#3b82f6' },
    todo: { label: 'Pendentes', color: '#f59e0b' },
    overdue: { label: 'Atrasadas', color: '#ef4444' }
  };

  return (
    <div className="space-y-6">
      {/* Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Tarefas</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.totalTasks}</div>
            <div className="flex items-center space-x-1 text-xs text-muted-foreground">
              <span>{analytics.completedTasks} concluídas</span>
              <Badge variant="secondary" className="text-xs">
                {Math.round(analytics.completionRate)}%
              </Badge>
            </div>
            <Progress value={analytics.completionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projetos Ativos</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.activeProjects}</div>
            <p className="text-xs text-muted-foreground">
              de {analytics.totalProjects} projetos
            </p>
            <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-primary transition-all duration-300" 
                style={{ width: `${(analytics.activeProjects / Math.max(analytics.totalProjects, 1)) * 100}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Em Progresso</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{analytics.inProgressTasks}</div>
            <p className="text-xs text-muted-foreground">
              tarefas sendo executadas
            </p>
            <div className="flex items-center mt-2">
              <TrendingUp className="h-3 w-3 text-green-500 mr-1" />
              <span className="text-xs text-green-500">Produtivo</span>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Atrasadas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{analytics.overdueTasks}</div>
            <p className="text-xs text-muted-foreground">
              precisam de atenção
            </p>
            {analytics.overdueTasks > 0 && (
              <div className="flex items-center mt-2">
                <TrendingDown className="h-3 w-3 text-red-500 mr-1" />
                <span className="text-xs text-red-500">Crítico</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendência Semanal */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <CardHeader>
            <CardTitle>Tendência de Conclusão (7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analytics.weeklyCompletion}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="day" />
                  <YAxis />
                  <RechartsTooltip content={<ChartTooltipContent />} />
                  <Area 
                    type="monotone" 
                    dataKey="completed" 
                    stroke="#22c55e" 
                    fill="#22c55e" 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Distribuição de Tarefas */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <CardHeader>
            <CardTitle>Distribuição de Tarefas</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={analytics.tasksByStatus.filter(item => item.value > 0)}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {analytics.tasksByStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Estatísticas Detalhadas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="animate-fade-in" style={{ animationDelay: '0.6s' }}>
          <CardHeader>
            <CardTitle className="text-lg">Performance Geral</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Taxa de Conclusão</span>
              <Badge variant="secondary">{Math.round(analytics.completionRate)}%</Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Tarefas por Projeto</span>
              <span className="font-medium">
                {analytics.totalProjects > 0 ? Math.round(analytics.totalTasks / analytics.totalProjects) : 0}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Eficiência</span>
              <Badge variant={analytics.overdueTasks === 0 ? "default" : "destructive"}>
                {analytics.overdueTasks === 0 ? "Excelente" : "Atenção"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.7s' }}>
          <CardHeader>
            <CardTitle className="text-lg">Status dos Projetos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.projectsByStatus.map((status, index) => (
              <div key={status.name} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div 
                    className="w-3 h-3 rounded-full" 
                    style={{ backgroundColor: status.color }}
                  />
                  <span className="text-sm">{status.name}</span>
                </div>
                <Badge variant="outline">{status.value}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.8s' }}>
          <CardHeader>
            <CardTitle className="text-lg">Insights</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {analytics.completionRate > 80 && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-700">
                  🎉 Excelente taxa de conclusão!
                </p>
              </div>
            )}
            {analytics.overdueTasks > 0 && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-sm text-red-700">
                  ⚠️ {analytics.overdueTasks} tarefas atrasadas precisam de atenção
                </p>
              </div>
            )}
            {analytics.inProgressTasks > analytics.completedTasks && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-700">
                  🚀 Muitas tarefas em progresso - boa dinâmica!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OverviewAnalytics;
