import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Calendar, Plus, ArrowLeft, Clock, Settings, FileDown } from 'lucide-react';
import { Project } from '../../contexts/ProjectContext';
import EditProjectDialog from './EditProjectDialog';
import * as XLSX from 'xlsx';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';

interface ProjectHeaderProps {
  project: Project;
  progress: number;
  completedTasks: number;
  onNewTask: () => void;
}

const ProjectHeader: React.FC<ProjectHeaderProps> = ({
  project,
  progress,
  completedTasks,
  onNewTask
}) => {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Ativo';
      case 'completed':
        return 'Concluído';
      case 'on-hold':
        return 'Pausado';
      default:
        return status;
    }
  };

  const tasks = project.tasks || [];

  const exportToXLSX = async () => {
    try {
      // Buscar todos os comentários do projeto
      const { data: allComments, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .eq('project_id', project.id)
        .order('created_at', { ascending: false });

      if (commentsError) throw commentsError;

      // Buscar perfis dos responsáveis
      const assigneeIds = [...new Set(project.tasks.map(task => task.assigned_to).filter(Boolean))];
      let assigneesProfiles: Record<string, { name: string }> = {};
      
      if (assigneeIds.length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', assigneeIds);

        if (error) throw error;

        assigneesProfiles = data.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, { name: string }>);
      }

      // Buscar perfis dos autores dos comentários
      const commentAuthorIds = [...new Set(allComments?.map(comment => comment.created_by) || [])];
      
      let commentAuthorsProfiles: Record<string, { name: string }> = {};
      
      if (commentAuthorIds.length > 0) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, name')
          .in('id', commentAuthorIds);

        if (error) throw error;

        commentAuthorsProfiles = data.reduce((acc, profile) => {
          acc[profile.id] = profile;
          return acc;
        }, {} as Record<string, { name: string }>);
      }

      // Ordenar tarefas alfabeticamente
      const sortedTasks = project.tasks.sort((a, b) => 
        (a.title || '').localeCompare(b.title || '', 'pt-BR', { sensitivity: 'base' })
      );

      // Preparar dados das tarefas seguindo o padrão do relatório completo
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

      sortedTasks.forEach(task => {
        const assignedTo = task.assigned_to ? assigneesProfiles[task.assigned_to]?.name || 'Não atribuído' : 'Não atribuído';
        
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
            const commentAuthor = comment.created_by ? commentAuthorsProfiles[comment.created_by]?.name || 'Desconhecido' : 'Desconhecido';
            
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

      // Criar planilha
      const ws = XLSX.utils.aoa_to_sheet(tasksData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Tarefas');

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

      // Salvar arquivo
      XLSX.writeFile(wb, `${project.name}_relatorio.xlsx`);
      toast.success('Relatório exportado com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar relatório:', error);
      toast.error('Erro ao exportar relatório');
    }
  };

  return (
    <>
      <div className="flex items-center space-x-4">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/projects">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar aos Projetos
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className={`w-4 h-4 rounded-full ${project.color}`}></div>
              <CardTitle className="text-2xl">{project.name}</CardTitle>
              <Badge variant="outline">{getStatusText(project.status)}</Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" onClick={exportToXLSX}>
                <FileDown className="mr-2 h-4 w-4" />
                Exportar Relatório
              </Button>
              <Button variant="outline" size="sm" onClick={() => setIsEditDialogOpen(true)}>
                <Settings className="mr-2 h-4 w-4" />
                Editar Projeto
              </Button>
            </div>
          </div>
          <CardDescription>{project.description}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center space-x-2 text-sm">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span>Início: {new Date(project.start_date).toLocaleDateString('pt-BR')}</span>
            </div>
            {project.end_date && (
              <div className="flex items-center space-x-2 text-sm">
                <Clock className="h-4 w-4 text-gray-500" />
                <span>Fim: {new Date(project.end_date).toLocaleDateString('pt-BR')}</span>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Progresso do Projeto</span>
              <span className="text-sm text-slate-50">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
            <div className="text-sm text-gray-500">
              {completedTasks} de {tasks.length} tarefas concluídas
            </div>
          </div>

          <div className="flex space-x-2">
            <Button onClick={onNewTask} className="bg-gradient-to-r from-[#2c5d96] to-white hover:from-[#1e4875] hover:to-gray-100">
              <Plus className="mr-2 h-4 w-4" />
              Nova Tarefa
            </Button>
            <Button variant="outline" asChild>
              <Link to={`/projects/${project.id}/kanban`}>Ver Kanban</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <EditProjectDialog
        open={isEditDialogOpen}
        onOpenChange={setIsEditDialogOpen}
        project={project}
      />
    </>
  );
};

export default ProjectHeader;
