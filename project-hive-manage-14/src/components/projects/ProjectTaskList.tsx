import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Task } from '@/types/task';
import { Link } from 'react-router-dom';
import { CheckSquare, Eye } from 'lucide-react';

interface ProjectTaskListProps {
  tasks: Task[];
  onTaskClick: (task: Task) => void;
  onNewTask: () => void;
}

const ProjectTaskList: React.FC<ProjectTaskListProps> = ({
  tasks = [],
  onTaskClick,
  onNewTask
}) => {
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      case 'doing':
        return 'outline';
      default:
        return 'outline';
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

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tarefas</CardTitle>
        <CardDescription>Todas as tarefas do projeto</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
          {tasks.map(task => (
            <div 
              key={task.id} 
              onClick={() => onTaskClick(task)} 
              className="flex items-center space-x-4 p-3 border rounded-lg cursor-pointer transition-colors hover:bg-accent/50 bg-transparent"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{task.title}</p>
                <p className="text-sm text-muted-foreground truncate">{task.description}</p>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onTaskClick(task)}
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Ver Detalhes
                </Button>
                <Badge className={`text-white ${getStatusColor(task.status)}`}>
                  {getStatusLabel(task.status)}
                </Badge>
                <Badge variant={getPriorityColor(task.priority)}>
                  {task.priority}
                </Badge>
                {task.due_date && (
                  <span className="text-xs text-gray-500">
                    Venc: {new Date(task.due_date).toLocaleDateString('pt-BR')}
                  </span>
                )}
              </div>
            </div>
          ))}
          {tasks.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>Nenhuma tarefa criada ainda</p>
              <Button variant="outline" className="mt-2" onClick={onNewTask}>
                Criar primeira tarefa
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectTaskList;
