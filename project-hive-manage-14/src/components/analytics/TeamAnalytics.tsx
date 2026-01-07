import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Users, User, Trophy, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';
import { Database } from '@/integrations/supabase/types';

type Project = Database['public']['Tables']['projects']['Row'] & {
  tasks: Database['public']['Tables']['tasks']['Row'][];
  members: (Database['public']['Tables']['project_members']['Row'] & {
    user: {
      id: string;
      email: string;
      name: string;
      avatar_url: string;
      status: string;
    };
  })[];
};

interface TeamAnalyticsProps {
  projects: Project[];
  dateRange: number;
  selectedProject: string;
}

const TeamAnalytics: React.FC<TeamAnalyticsProps> = ({
  projects,
  dateRange,
  selectedProject
}) => {
  // Buscar dados atualizados do Supabase
  const { data: realtimeData, isLoading } = useQuery({
    queryKey: ['analytics-team', selectedProject, dateRange],
    queryFn: async () => {
      // Buscar TODAS as tarefas, não apenas as dos últimos X dias
      const { data: tasks, error } = await supabase
        .from('tasks')
        .select('*, projects(*), profiles!assigned_to(*)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return tasks;
    },
    refetchInterval: 30000, // Atualiza a cada 30 segundos
  });

  const filteredProjects = selectedProject === 'all' 
    ? projects 
    : projects.filter(p => p.id === selectedProject);

  const teamMetrics = useMemo(() => {
    if (isLoading || !realtimeData) {
      return {
        teamData: [],
        totalMembers: 0,
        activeMembers: 0,
        avgTasksPerMember: 0,
        avgCompletionRate: 0,
        topPerformer: { name: 'N/A', completionRate: 0 },
        memberProductivity: [],
        workloadDistribution: []
      };
    }

    // Agrupar tarefas por membro
    const memberTasks = new Map();
    realtimeData.forEach(task => {
      if (!task.assigned_to || !task.profiles) return;
      
      const memberId = task.assigned_to;
      if (!memberTasks.has(memberId)) {
        memberTasks.set(memberId, {
          name: task.profiles.full_name || 'Usuário Desconhecido',
          totalTasks: 0,
          completedTasks: 0,
          inProgressTasks: 0
        });
      }

      const memberData = memberTasks.get(memberId);
      memberData.totalTasks++;
      
      if (task.status === 'done') {
        memberData.completedTasks++;
      } else if (task.status === 'doing') {
        memberData.inProgressTasks++;
      }
    });

    // Converter para array e calcular métricas
    const teamData = Array.from(memberTasks.values()).map(member => ({
      ...member,
      completionRate: member.totalTasks > 0 ? (member.completedTasks / member.totalTasks) * 100 : 0
    }));

    // Calcular total de membros e membros ativos
    const totalMembers = filteredProjects.reduce((acc, p) => acc + p.members.length, 0);
    const activeMembers = teamData.length;

    const avgTasksPerMember = teamData.reduce((acc, m) => acc + m.totalTasks, 0) / Math.max(activeMembers, 1);
    const avgCompletionRate = teamData.reduce((acc, m) => acc + m.completionRate, 0) / Math.max(activeMembers, 1);
    const topPerformer = teamData.reduce((top, current) => 
      current.completionRate > top.completionRate ? current : top, teamData[0] || { name: 'N/A', completionRate: 0 });

    // Dados para gráficos
    const memberProductivity = teamData.slice(0, 10).map(member => ({
      name: typeof member.name === 'string' ? member.name.split('@')[0] : member.name,
      completed: member.completedTasks,
      inProgress: member.inProgressTasks,
      total: member.totalTasks
    }));

    const workloadDistribution = teamData.map(member => ({
      name: typeof member.name === 'string' ? member.name.split('@')[0] : member.name,
      value: member.totalTasks,
      color: member.totalTasks > avgTasksPerMember ? '#ef4444' : '#22c55e'
    }));

    return {
      teamData,
      totalMembers,
      activeMembers,
      avgTasksPerMember,
      avgCompletionRate,
      topPerformer,
      memberProductivity,
      workloadDistribution
    };
  }, [filteredProjects, realtimeData, isLoading]);

  const chartConfig = {
    completed: { label: 'Concluídas', color: '#22c55e' },
    inProgress: { label: 'Em Progresso', color: '#3b82f6' },
    total: { label: 'Total', color: '#6b7280' }
  };

  return (
    <div className="space-y-6">
      {/* Métricas da Equipe */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="animate-fade-in">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Membros</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{teamMetrics.totalMembers}</div>
            <p className="text-xs text-muted-foreground">
              {teamMetrics.activeMembers} membros ativos
            </p>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tarefas por Membro</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(teamMetrics.avgTasksPerMember)}</div>
            <p className="text-xs text-muted-foreground">
              média por pessoa
            </p>
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Produtividade Média</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{Math.round(teamMetrics.avgCompletionRate)}%</div>
            <Progress value={teamMetrics.avgCompletionRate} className="mt-2" />
          </CardContent>
        </Card>

        <Card className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Performer</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-bold truncate">
              {typeof teamMetrics.topPerformer?.name === 'string' 
                ? teamMetrics.topPerformer.name.split('@')[0] 
                : teamMetrics.topPerformer?.name || 'N/A'}
            </div>
            <div className="text-xs text-muted-foreground">
              {Math.round(teamMetrics.topPerformer?.completionRate || 0)}% conclusão
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Produtividade Individual */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.4s' }}>
          <CardHeader>
            <CardTitle>Produtividade por Membro</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamMetrics.memberProductivity}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={60} />
                  <YAxis />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="completed" fill="#22c55e" />
                  <Bar dataKey="inProgress" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Distribuição de Carga de Trabalho */}
        <Card className="animate-fade-in" style={{ animationDelay: '0.5s' }}>
          <CardHeader>
            <CardTitle>Distribuição de Carga de Trabalho</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={teamMetrics.workloadDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {teamMetrics.workloadDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TeamAnalytics;
