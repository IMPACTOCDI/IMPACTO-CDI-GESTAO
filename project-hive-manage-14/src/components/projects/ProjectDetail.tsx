import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProject } from '@/contexts/ProjectContext';
import { useProjectTasks } from '@/hooks/useProjectTasks';
import ProjectHeader from './ProjectHeader';
import ProjectTaskList from './ProjectTaskList';
import ProjectStats from './ProjectStats';
import TaskDialog from '../tasks/TaskDialog';
import TaskFiltersComponent, { TaskFilters } from '../tasks/TaskFilters';
import { Card } from '../ui/card';
import TeamMembers from './TeamMembers';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import { Project, Task, ProjectMember } from '../../types/project';

type Project = Database['public']['Tables']['projects']['Row'] & {
  members?: Database['public']['Tables']['project_members']['Row'][];
  tasks?: Task[];
};

type Task = Database['public']['Tables']['tasks']['Row'] & {
  tags?: string[];
  comments?: Database['public']['Tables']['comments']['Row'][];
};

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getProject } = useProject();
  const [project, setProject] = useState<Project | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>({});

  // Usar o hook useProjectTasks para buscar as tarefas
  const { data: allTasks = [], isLoading: isLoadingTasks } = useProjectTasks(id);

  // Filtrar tarefas baseado nos filtros ativos
  const filteredTasks = useMemo(() => {
    let filtered = (allTasks as Task[]);

    // Filtro por status
    if (filters.status) {
      filtered = filtered.filter(task => task.status === filters.status);
    }

    // Filtro por prioridade
    if (filters.priority) {
      filtered = filtered.filter(task => task.priority === filters.priority);
    }

    // Filtro por responsável
    if (filters.assignedTo) {
      if (filters.assignedTo === 'unassigned') {
        filtered = filtered.filter(task => !task.assigned_to);
      } else {
        filtered = filtered.filter(task => task.assigned_to === filters.assignedTo);
      }
    }

    // Filtro por tarefas atrasadas
    if (filters.overdue) {
      const now = new Date();
      filtered = filtered.filter(task => {
        if (!task.due_date) return false;
        const dueDate = new Date(task.due_date);
        return dueDate < now && task.status !== 'done';
      });
    }

    // Filtro por título
    if (filters.title) {
      const searchTerm = filters.title.toLowerCase().trim();
      filtered = filtered.filter(task => 
        task.title.toLowerCase().includes(searchTerm)
      );
    }

    return filtered;
  }, [allTasks, filters]);

  // Preparar lista de membros da equipe para os filtros
  const teamMembers = useMemo(() => {
    if (!project?.members) return [];
    return (project.members as ProjectMember[]).map(member => ({
      id: member.user_id,
      name: (member as any).profiles?.name || (member as any).name || member.user_id
    }));
  }, [project?.members]);

  useEffect(() => {
    const loadProject = async () => {
      if (!id) return;
      
      try {
        const projectData = await getProject(id);
        setProject(projectData);
      } catch (error: any) {
        setError(error.message);
        logger.error('Erro ao carregar projeto', { error, projectId: id });
      } finally {
          setIsLoading(false);
      }
    };

    loadProject();
  }, [id, getProject]);

  if (isLoading || isLoadingTasks) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="text-gray-500">Carregando projeto...</p>
        </div>
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

  const completedTasks = allTasks.filter(task => task.status === 'done').length;
  const progress = allTasks.length > 0 ? (completedTasks / allTasks.length) * 100 : 0;

  const handleTaskClick = (task: Database['public']['Tables']['tasks']['Row']) => {
    navigate(`/tasks/${task.id}`);
  };

  const handleNewTask = () => {
    setIsTaskDialogOpen(true);
  };

  return (
    <div className="space-y-6 px-4 md:px-6 lg:px-8 max-w-[1600px] mx-auto">
      <ProjectHeader
        project={project}
        progress={progress}
        completedTasks={completedTasks}
        onNewTask={handleNewTask}
      />

      <TaskFiltersComponent
        filters={filters}
        onFiltersChange={setFilters}
        teamMembers={teamMembers}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <div className="rounded-lg p-4">
            <ProjectTaskList
              tasks={filteredTasks}
              onTaskClick={handleTaskClick}
              onNewTask={handleNewTask}
            />
          </div>
        </div>
        <div className="space-y-6">
          <div className="rounded-lg p-4">
            <ProjectStats tasks={allTasks} />
          </div>
          <div className="rounded-lg p-4">
            <TeamMembers members={project.members || []} projectId={project.id} />
          </div>
        </div>
      </div>

      <TaskDialog
        open={isTaskDialogOpen}
        onOpenChange={setIsTaskDialogOpen}
        projectId={project.id}
      />
    </div>
  );
};

export default ProjectDetail;
