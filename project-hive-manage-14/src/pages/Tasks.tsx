import { useState } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useUserTasks } from '@/hooks/useTaskQueries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Database } from '@/integrations/supabase/types';
import { Task } from '@/types/task';
import TaskFiltersComponent, { TaskFilters } from '@/components/tasks/TaskFilters';
import { useNavigate } from 'react-router-dom';

export default function Tasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'overdue'>('all');
  const [showOnlyAssigned, setShowOnlyAssigned] = useState(false);
  const [filters, setFilters] = useState<TaskFilters>({});

  // Buscar projetos do usuário
  const { projects = [] } = useProject();
  const projectIds = projects.map(p => p.id);

  // Montar lista única de membros dos projetos
  const teamMembers = Array.from(
    projects
      .flatMap(p => p.members || [])
      .reduce((map, member) => {
        const name = (member as any).profiles?.name || (member as any).name || member.user_id;
        if (!map.has(member.user_id)) {
          map.set(member.user_id, { id: member.user_id, name });
        }
        return map;
      }, new Map()),
    ([, value]) => value
  );

  // Buscar tarefas dos projetos
  const { data: tasks = [], isLoading, error } = useUserTasks(projectIds, showOnlyAssigned);

  // Aplicar filtros avançados
  const filteredTasks = tasks.filter(task => {
    // Filtro por título
    if (filters.title && !task.title.toLowerCase().includes(filters.title.toLowerCase())) {
      return false;
    }
    // Filtro por status
    if (filters.status && task.status !== filters.status) {
      return false;
    }
    // Filtro por prioridade
    if (filters.priority && task.priority !== filters.priority) {
      return false;
    }
    // Filtro por responsável
    if (filters.assignedTo) {
      if (filters.assignedTo === 'unassigned') {
        if (task.assigned_to) return false;
      } else {
        if (task.assigned_to !== filters.assignedTo) return false;
      }
    }
    // Filtro por atrasadas
    if (filters.overdue) {
      if (!task.due_date) return false;
      if (!(new Date(task.due_date) < new Date() && task.status !== 'done')) return false;
    }
    // Filtro por aba (todas/atrasadas)
    if (filter === 'overdue') {
      if (!task.due_date || !(new Date(task.due_date) < new Date())) return false;
    }
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-8">
          <p className="text-red-500">Erro ao carregar tarefas. Tente novamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tarefas</h1>
          <p className="text-muted-foreground">
            Gerencie todas as suas tarefas em um só lugar
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Tabs defaultValue="all" value={filter} onValueChange={(value) => setFilter(value as 'all' | 'overdue')}>
          <TabsList>
            <TabsTrigger value="all">Todas</TabsTrigger>
            <TabsTrigger value="overdue">Atrasadas</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center space-x-2">
          <Switch
            id="show-only-assigned"
            checked={showOnlyAssigned}
            onCheckedChange={setShowOnlyAssigned}
          />
          <Label htmlFor="show-only-assigned">Mostrar apenas minhas tarefas</Label>
        </div>
      </div>

      <TaskFiltersComponent
        filters={filters}
        onFiltersChange={setFilters}
        teamMembers={teamMembers}
      />

      <div className="grid gap-4">
        {filteredTasks.map((task) => (
          <Card 
            key={task.id} 
            className="cursor-pointer hover:bg-accent/50 transition-colors" 
            onClick={() => navigate(`/tasks/${task.id}`)}
          >
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">{task.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{task.projects?.name}</p>
                </div>
                <div className="flex gap-2">
                  <Badge className={task.status === 'done' ? 'bg-green-500' : task.status === 'doing' ? 'bg-blue-500' : 'bg-gray-500'}>
                    {task.status === 'done' ? 'Concluída' : task.status === 'doing' ? 'Em andamento' : 'A fazer'}
                  </Badge>
                  <Badge className={task.priority === 'high' ? 'bg-red-500' : task.priority === 'medium' ? 'bg-yellow-500' : 'bg-green-500'}>
                    {task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground line-clamp-2">{task.description}</p>
              {task.due_date && (
                <p className="text-sm text-muted-foreground mt-2">
                  Prazo: {new Date(task.due_date).toLocaleDateString()}
                </p>
              )}
            </CardContent>
          </Card>
        ))}

        {filteredTasks.length === 0 && (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Nenhuma tarefa encontrada.</p>
          </div>
        )}
      </div>
    </div>
  );
} 