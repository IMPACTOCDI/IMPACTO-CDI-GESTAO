import React, { useState, useEffect } from 'react';
import { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Edit, Calendar, User, Flag, Tag, Trash2, Loader2, CheckSquare, Eye } from 'lucide-react';
import TaskComments from './TaskComments2';
import { EditTaskDialog } from './EditTaskDialog';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { useDeleteTask } from '@/hooks/useTaskMutations';
import { useTask } from '@/hooks/useTaskQueries';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Task } from '@/types/task';
import { Link, useNavigate } from 'react-router-dom';
import { useToast } from '@/components/ui/use-toast';
import { LinkifiedText } from '@/components/common/LinkifiedText';

type Profile = Database['public']['Tables']['profiles']['Row'];
type Comment = Database['public']['Tables']['comments']['Row'] & {
  profiles?: Profile;
};

interface TaskDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  projectId: string;
  onTaskDeleted?: () => void;
}

const TaskDetailDialog = ({
  open,
  onOpenChange,
  task,
  projectId,
  onTaskDeleted
}: TaskDetailDialogProps) => {
  const { user } = useAuth();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const deleteTask = useDeleteTask();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Estado para o comentário sendo digitado
  const [currentComment, setCurrentComment] = useState('');
  
  // Chave única para o localStorage baseada na tarefa e usuário
  const commentStorageKey = `taskComment_${task?.id}_${user?.id || 'anonymous'}`;
  
  // Usar o hook useTask apenas quando o diálogo estiver aberto
  const { data: currentTask, isLoading, isError } = useTask(open ? task?.id : undefined);

  // Função para salvar comentário no localStorage
  const saveCommentToStorage = (comment: string) => {
    if (comment.trim()) {
      localStorage.setItem(commentStorageKey, comment);
    } else {
      localStorage.removeItem(commentStorageKey);
    }
  };

  // Função para carregar comentário do localStorage
  const loadCommentFromStorage = () => {
    try {
      return localStorage.getItem(commentStorageKey) || '';
    } catch (error) {
      logger.error('Erro ao carregar comentário do localStorage', { error, context: 'TaskDetailDialog' });
      return '';
    }
  };

  // Função para verificar se há dados não salvos
  const hasUnsavedData = () => {
    return currentComment.trim().length > 0;
  };

  // Carregar comentário salvo quando o diálogo abrir
  useEffect(() => {
    if (open && task?.id) {
      const savedComment = loadCommentFromStorage();
      setCurrentComment(savedComment);
    } else {
      setCurrentComment('');
    }
  }, [open, task?.id, commentStorageKey]);

  // Função para lidar com o fechamento do diálogo
  const handleDialogClose = (shouldClose: boolean) => {
    if (!shouldClose) return;
    
    if (hasUnsavedData()) {
      const shouldKeepData = window.confirm(
        'Você tem dados não salvos. Deseja manter esses dados ou descartá-los?\n\nOK = Manter dados\nCancelar = Descartar dados'
      );
      
      if (!shouldKeepData) {
        // Limpar dados não salvos do localStorage e do estado
        localStorage.removeItem(commentStorageKey);
        setCurrentComment('');
      } else {
        // Salvar dados no localStorage antes de fechar
        saveCommentToStorage(currentComment);
      }
    }
    
    onOpenChange(false);
  };

  // Salvar automaticamente o comentário quando ele mudar
  useEffect(() => {
    if (!open) return;
    
    // Salvar o comentário no localStorage sempre que ele mudar
    if (currentComment) {
      saveCommentToStorage(currentComment);
    }
  }, [currentComment, open, commentStorageKey]);

  useEffect(() => {
    logger.debug('taskId recebido', { taskId: task?.id, context: 'TaskDetailDialog' });
  }, [task?.id]);

  const handleDeleteTask = async () => {
    if (!task?.id) {
      logger.error('ID da tarefa não encontrado', { context: 'TaskDetailDialog' });
      toast.error('Erro ao excluir tarefa: ID não encontrado');
      return;
    }
    
    try {
      logger.debug('Iniciando exclusão da tarefa', { taskId: task.id, context: 'TaskDetailDialog' });
      // Fechar o diálogo de confirmação
      setIsDeleteDialogOpen(false);
      // Executar a exclusão
      await deleteTask.mutateAsync(task.id);
      // Notificar sobre a exclusão
      if (onTaskDeleted) onTaskDeleted();
      // Fechar o diálogo principal após a exclusão
      onOpenChange(false);
      toast({
        title: "Sucesso",
        description: "Tarefa excluída com sucesso!"
      });
      logger.info('Tarefa excluída com sucesso', { taskId: task.id, context: 'TaskDetailDialog' });
    } catch (error: any) {
      logger.error('Erro ao excluir tarefa', { error, context: 'TaskDetailDialog' });
      toast({
        variant: "destructive",
        title: "Erro",
        description: "Erro ao excluir tarefa. Tente novamente."
      });
    }
  };

  // Se a tarefa foi excluída, fechar o diálogo automaticamente
  useEffect(() => {
    if (!currentTask && !isLoading && open) {
      onOpenChange(false);
    }
  }, [currentTask, isLoading, open, onOpenChange]);

  const handleViewDetails = () => {
    navigate(`/tasks/${task?.id}`);
    onOpenChange(false);
  };

  if (isLoading) {
    return (
      <Dialog 
        open={open} 
        onOpenChange={(open) => {
          if (!open) {
            handleDialogClose(true);
          } else {
            onOpenChange(open);
          }
        }}
        onEscapeKeyDown={(e) => {
          if (hasUnsavedData()) {
            e.preventDefault();
            const shouldKeepData = window.confirm(
              'Você tem dados não salvos. Deseja manter esses dados ou descartá-los?\n\nOK = Manter dados\nCancelar = Descartar dados'
            );
            
            if (!shouldKeepData) {
              localStorage.removeItem(commentStorageKey);
              setCurrentComment('');
            } else {
              saveCommentToStorage(currentComment);
            }
            onOpenChange(false);
          }
        }}
        onInteractOutside={(e) => {
          if (hasUnsavedData()) {
            e.preventDefault();
            const shouldKeepData = window.confirm(
              'Você tem dados não salvos. Deseja manter esses dados ou descartá-los?\n\nOK = Manter dados\nCancelar = Descartar dados'
            );
            
            if (!shouldKeepData) {
              localStorage.removeItem(commentStorageKey);
              setCurrentComment('');
            } else {
              saveCommentToStorage(currentComment);
            }
            onOpenChange(false);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="sr-only">Carregando tarefa</DialogTitle>
            <DialogDescription className="sr-only">Aguarde enquanto os dados da tarefa são carregados.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center h-40">
            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
            Carregando tarefa...
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (isError || !currentTask) {
    return (
      <Dialog 
        open={open} 
        onOpenChange={(open) => {
          if (!open) {
            handleDialogClose(true);
          } else {
            onOpenChange(open);
          }
        }}
        onEscapeKeyDown={(e) => {
          if (hasUnsavedData()) {
            e.preventDefault();
            const shouldKeepData = window.confirm(
              'Você tem dados não salvos. Deseja manter esses dados ou descartá-los?\n\nOK = Manter dados\nCancelar = Descartar dados'
            );
            
            if (!shouldKeepData) {
              localStorage.removeItem(commentStorageKey);
              setCurrentComment('');
            } else {
              saveCommentToStorage(currentComment);
            }
            onOpenChange(false);
          }
        }}
        onInteractOutside={(e) => {
          if (hasUnsavedData()) {
            e.preventDefault();
            const shouldKeepData = window.confirm(
              'Você tem dados não salvos. Deseja manter esses dados ou descartá-los?\n\nOK = Manter dados\nCancelar = Descartar dados'
            );
            
            if (!shouldKeepData) {
              localStorage.removeItem(commentStorageKey);
              setCurrentComment('');
            } else {
              saveCommentToStorage(currentComment);
            }
            onOpenChange(false);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="sr-only">Erro ao carregar tarefa</DialogTitle>
            <DialogDescription className="sr-only">Não foi possível carregar os dados da tarefa.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center h-40 text-red-500">
            Erro ao carregar tarefa ou tarefa não encontrada.
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'destructive';
      case 'medium':
        return 'default';
      case 'low':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done':
        return 'bg-green-500';
      case 'doing':
        return 'bg-blue-500';
      case 'todo':
        return 'bg-gray-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <>
      <Dialog 
        open={open} 
        onOpenChange={(open) => {
          if (!open) {
            handleDialogClose(true);
          } else {
            onOpenChange(open);
          }
        }}
        onEscapeKeyDown={(e) => {
          if (hasUnsavedData()) {
            e.preventDefault();
            const shouldKeepData = window.confirm(
              'Você tem dados não salvos. Deseja manter esses dados ou descartá-los?\n\nOK = Manter dados\nCancelar = Descartar dados'
            );
            
            if (!shouldKeepData) {
              localStorage.removeItem(commentStorageKey);
              setCurrentComment('');
            } else {
              saveCommentToStorage(currentComment);
            }
            onOpenChange(false);
          }
        }}
        onInteractOutside={(e) => {
          if (hasUnsavedData()) {
            e.preventDefault();
            const shouldKeepData = window.confirm(
              'Você tem dados não salvos. Deseja manter esses dados ou descartá-los?\n\nOK = Manter dados\nCancelar = Descartar dados'
            );
            
            if (!shouldKeepData) {
              localStorage.removeItem(commentStorageKey);
              setCurrentComment('');
            } else {
              saveCommentToStorage(currentComment);
            }
            onOpenChange(false);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Detalhes da Tarefa</DialogTitle>
            <DialogDescription className="sr-only">
              Visualize e gerencie os detalhes desta tarefa.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl">{currentTask?.title}</DialogTitle>
            <div className="flex items-center space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setIsEditOpen(true)}
                disabled={!currentTask?.id}
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
              <Button 
                variant="destructive" 
                size="sm" 
                onClick={() => setIsDeleteDialogOpen(true)}
                disabled={!currentTask?.id || deleteTask.isPending}
              >
                {deleteTask.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="mr-2 h-4 w-4" />
                )}
                Excluir
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  navigate(`/tasks/${currentTask?.id}`);
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver Detalhes
              </Button>
            </div>
          </div>
          <div className="space-y-6 max-h-[70vh] min-h-[300px] overflow-y-auto pr-2">
            <div className="flex items-center space-x-4">
              <div className={`w-3 h-3 rounded-full ${getStatusColor(currentTask?.status || '')}`}></div>
              <Badge variant={getPriorityColor(currentTask?.priority || '')}>
                <Flag className="mr-1 h-3 w-3" />
                {currentTask?.priority}
              </Badge>
            </div>
            <div>
              <h4 className="font-medium mb-2">Descrição</h4>
              <LinkifiedText 
                text={currentTask?.description || 'Nenhuma descrição fornecida'} 
                className="text-slate-50 break-words break-all whitespace-pre-line max-h-32 overflow-y-auto"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              {currentTask?.assigned_profile && (
                <div className="flex items-center space-x-2">
                  <User className="h-4 w-4 text-gray-500" />
                  <span>{currentTask.assigned_profile.name}</span>
                </div>
              )}
              {currentTask?.due_date && (
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span>Vencimento: {new Date(currentTask.due_date).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
              {currentTask?.created_at && (
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-500" />
                  <span>Criada em: {new Date(currentTask.created_at).toLocaleDateString('pt-BR')}</span>
                </div>
              )}
            </div>
            {currentTask?.tags && currentTask.tags.length > 0 && (
              <div>
                <h4 className="font-medium mb-2 flex items-center">
                  <Tag className="mr-2 h-4 w-4" />
                  Tags
                </h4>
                <div className="flex flex-wrap gap-2">
                  {currentTask.tags.map((tag, index) => (
                    <Badge key={index} variant="outline">
                      {tag}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <TaskComments 
              taskId={currentTask?.id} 
              projectId={projectId} 
              comments={currentTask?.comments || []} 
              currentComment={currentComment}
              onCommentChange={setCurrentComment}
              onCommentSubmit={() => {
                // Limpar o comentário salvo após envio bem-sucedido
                localStorage.removeItem(commentStorageKey);
                setCurrentComment('');
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <EditTaskDialog 
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        task={currentTask}
        projectId={projectId}
      />

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta tarefa? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask}>
              {deleteTask.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default TaskDetailDialog;