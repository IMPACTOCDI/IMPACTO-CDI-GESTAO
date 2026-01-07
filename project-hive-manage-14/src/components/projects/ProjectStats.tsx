
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Task } from '../../contexts/ProjectContext';

interface ProjectStatsProps {
  tasks: Task[];
}

const ProjectStats: React.FC<ProjectStatsProps> = ({ tasks = [] }) => {
  const completedTasks = tasks.filter(t => t.status === 'done').length;
  const doingTasks = tasks.filter(t => t.status === 'doing').length;
  const todoTasks = tasks.filter(t => t.status === 'todo').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estatísticas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between bg-transparent">
          <span className="text-sm text-slate-50">Total de Tarefas</span>
          <span className="font-medium">{tasks.length}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-slate-50">Concluídas</span>
          <span className="font-medium text-green-600">{completedTasks}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-slate-50">Em Progresso</span>
          <span className="font-medium text-blue-600">{doingTasks}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-slate-50">Pendentes</span>
          <span className="font-medium text-red-600">{todoTasks}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default ProjectStats;
