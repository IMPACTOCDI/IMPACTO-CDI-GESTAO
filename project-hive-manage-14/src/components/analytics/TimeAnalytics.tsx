import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { Project } from '../../contexts/ProjectContext';
import { Calendar, Clock, TrendingUp, Timer, CheckCircle, AlertTriangle } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'] & {
  tasks: Database['public']['Tables']['tasks']['Row'][];
};

interface TimeAnalyticsProps {
  projects: Project[];
  dateRange: number;
  selectedProject: string;
}

const TimeAnalytics: React.FC<TimeAnalyticsProps> = ({
  projects,
  dateRange,
  selectedProject
}) => {
  // Buscar dados atualizados do Supabase
  const { data: realtimeData, isLoading } = useQuery({
    queryKey: ['analytics-time', selectedProject, dateRange],
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

  const timeMetrics = useMemo(() => {
    if (isLoading || !realtimeData) {
      return {
        dailyCompletion: [],
        weeklyData: [],
        weekdayDistribution: [],
        avgCompletionTime: 0,
        totalTasksInPeriod: 0,
        completedInPeriod: 0,
        avgDailyCreation: 0,
        avgDailyCompletion: 0,
        velocity: 0
      };
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - dateRange);

    // Tendência diária de conclusão de tarefas
    const dailyCompletion = [];
    for (let i = dateRange - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dayStart = new Date(date.setHours(0, 0, 0, 0));
      const dayEnd = new Date(date.setHours(23, 59, 59, 999));
      
      const completed = realtimeData.filter(t => {
        if (t.status !== 'done') return false;
        const updatedDate = new Date(t.updated_at);
        return updatedDate >= dayStart && updatedDate <= dayEnd;
      }).length;

      const created = realtimeData.filter(t => {
        const createdDate = new Date(t.created_at);
        return createdDate >= dayStart && createdDate <= dayEnd;
      }).length;

      dailyCompletion.push({
        date: date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        completed,
        created,
        net: completed - created
      });
    }

    // Análise semanal
    const weeklyData = [];
    for (let i = Math.ceil(dateRange / 7) - 1; i >= 0; i--) {
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - (i + 1) * 7);
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - i * 7);

      const weekTasks = realtimeData.filter(t => {
        const createdDate = new Date(t.created_at);
        return createdDate >= weekStart && createdDate <= weekEnd;
      }).length;

      const weekCompleted = realtimeData.filter(t => {
        if (t.status !== 'done') return false;
        const updatedDate = new Date(t.updated_at);
        return updatedDate >= weekStart && updatedDate <= weekEnd;
      }).length;

      weeklyData.push({
        week: `Sem ${Math.ceil(dateRange / 7) - i}`,
        tasks: weekTasks,
        completed: weekCompleted,
        productivity: weekTasks > 0 ? (weekCompleted / weekTasks) * 100 : 0
      });
    }

    // Análise de tempo médio de conclusão
    const completedTasks = realtimeData.filter(t => t.status === 'done');

    const avgCompletionTime = completedTasks.length > 0 
      ? completedTasks.reduce((acc, task) => {
          const created = new Date(task.created_at);
          const updated = new Date(task.updated_at);
          return acc + (updated.getTime() - created.getTime());
        }, 0) / completedTasks.length / (1000 * 60 * 60 * 24) // em dias
      : 0;

    // Distribuição por dia da semana
    const weekdayDistribution = Array.from({ length: 7 }, (_, i) => {
      const dayName = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][i];
      const dayTasks = completedTasks.filter(task => {
        const day = new Date(task.updated_at).getDay();
        return day === i;
      }).length;

      return {
        day: dayName,
        tasks: dayTasks,
        percentage: completedTasks.length > 0 ? (dayTasks / completedTasks.length) * 100 : 0
      };
    });

    // Métricas gerais
    const totalTasksInPeriod = realtimeData.filter(t => {
      const createdDate = new Date(t.created_at);
      return createdDate >= cutoffDate;
    }).length;

    const completedInPeriod = realtimeData.filter(t => {
      if (t.status !== 'done') return false;
      const updatedDate = new Date(t.updated_at);
      return updatedDate >= cutoffDate;
    }).length;

    const avgDailyCreation = dateRange > 0 ? totalTasksInPeriod / dateRange : 0;
    const avgDailyCompletion = dateRange > 0 ? completedInPeriod / dateRange : 0;

    return {
      dailyCompletion,
      weeklyData,
      weekdayDistribution,
      avgCompletionTime: isNaN(avgCompletionTime) ? 0 : avgCompletionTime,
      totalTasksInPeriod,
      completedInPeriod,
      avgDailyCreation: isNaN(avgDailyCreation) ? 0 : avgDailyCreation,
      avgDailyCompletion: isNaN(avgDailyCompletion) ? 0 : avgDailyCompletion,
      velocity: isNaN(avgDailyCompletion - avgDailyCreation) ? 0 : avgDailyCompletion - avgDailyCreation
    };
  }, [filteredProjects, dateRange, realtimeData, isLoading]);

  const chartConfig = {
    completed: { label: 'Concluídas', color: '#22c55e' },
    created: { label: 'Criadas', color: '#3b82f6' },
    net: { label: 'Saldo', color: '#f59e0b' },
    tasks: { label: 'Tarefas', color: '#6b7280' },
    productivity: { label: 'Produtividade', color: '#8b5cf6' }
  };

  return (
    <div className="space-y-6">
      {/* Métricas de Tempo */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tarefas Concluídas</CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {isNaN(timeMetrics.completedInPeriod) ? 0 : timeMetrics.completedInPeriod}
            </div>
            <p className="text-xs text-muted-foreground">
              de {isNaN(timeMetrics.totalTasksInPeriod) ? 0 : timeMetrics.totalTasksInPeriod} tarefas totais
            </p>
            <Progress 
              value={timeMetrics.totalTasksInPeriod > 0 
                ? (timeMetrics.completedInPeriod / timeMetrics.totalTasksInPeriod) * 100 
                : 0} 
              className="mt-2" 
            />
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tarefas Atrasadas</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timeMetrics.totalTasksInPeriod - timeMetrics.completedInPeriod}</div>
            <p className="text-xs text-muted-foreground">
              {(((timeMetrics.totalTasksInPeriod - timeMetrics.completedInPeriod) / timeMetrics.totalTasksInPeriod) * 100).toFixed(1)}% do total
            </p>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tempo Médio</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(timeMetrics.avgCompletionTime)}</div>
            <p className="text-xs text-muted-foreground">
              dias para conclusão
            </p>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No Prazo</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{timeMetrics.completedInPeriod}</div>
            <p className="text-xs text-muted-foreground">
              {((timeMetrics.completedInPeriod / timeMetrics.totalTasksInPeriod) * 100).toFixed(1)}% das concluídas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos Temporais */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Tendência Diária */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <CardHeader>
            <CardTitle>Tendência Diária de Tarefas</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={timeMetrics.dailyCompletion}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Line type="monotone" dataKey="completed" stroke="#22c55e" strokeWidth={2} />
                  <Line type="monotone" dataKey="created" stroke="#3b82f6" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Análise Semanal */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <CardHeader>
            <CardTitle>Produtividade Semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timeMetrics.weeklyData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area 
                    type="monotone" 
                    dataKey="productivity" 
                    stroke="#8b5cf6" 
                    fill="#8b5cf6" 
                    fillOpacity={0.3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* Distribuição por Dia da Semana */}
      <Card className="animate-fade-in" style={{ animationDelay: '0.6s' }}>
        <CardHeader>
          <CardTitle>Padrão de Conclusão por Dia da Semana</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timeMetrics.weekdayDistribution}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <ChartTooltip 
                  content={<ChartTooltipContent />} 
                  formatter={(value, name) => {
                    const numValue = typeof value === 'number' ? value : parseFloat(value.toString());
                    return [
                      name === 'tasks' ? `${numValue} tarefas` : `${numValue.toFixed(1)}%`,
                      name === 'tasks' ? 'Tarefas Concluídas' : 'Percentual'
                    ];
                  }}
                />
                <Bar dataKey="tasks" fill="#22c55e" />
              </BarChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Insights Temporais */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="animate-fade-in" style={{ animationDelay: '0.7s' }}>
          <CardHeader>
            <CardTitle className="text-lg">Padrões Identificados</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {timeMetrics.velocity > 0 && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                <p className="text-sm text-green-700">
                  ✅ Velocidade positiva - mais tarefas sendo concluídas que criadas
                </p>
              </div>
            )}
            
            {timeMetrics.avgCompletionTime > 7 && (
              <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-sm text-yellow-700">
                  ⏰ Tempo médio alto - considere quebrar tarefas maiores
                </p>
              </div>
            )}
            
            {timeMetrics.weekdayDistribution.some(day => day.tasks === 0) && (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <p className="text-sm text-blue-700">
                  📅 Alguns dias sem conclusões - oportunidade de distribuição
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.8s' }}>
          <CardHeader>
            <CardTitle className="text-lg">Dias Mais Produtivos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {timeMetrics.weekdayDistribution
                .sort((a, b) => b.tasks - a.tasks)
                .slice(0, 3)
                .map((day, index) => (
                  <div key={day.day} className="flex items-center justify-between">
                    <span className="text-sm">{day.day}</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="default">{day.tasks} tarefas</Badge>
                      <span className="text-xs text-muted-foreground">
                        {day.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.9s' }}>
          <CardHeader>
            <CardTitle className="text-lg">Métricas do Período</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Período analisado:</span>
              <span className="text-sm font-medium">{dateRange} dias</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tarefas criadas:</span>
              <span className="text-sm font-medium">{timeMetrics.totalTasksInPeriod}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Tarefas concluídas:</span>
              <span className="text-sm font-medium">{timeMetrics.completedInPeriod}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">Média diária criação:</span>
              <span className="text-sm font-medium">{timeMetrics.avgDailyCreation.toFixed(1)}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TimeAnalytics;
