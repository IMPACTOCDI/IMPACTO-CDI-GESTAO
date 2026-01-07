import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTask } from '@/hooks/useTaskQueries';
import { useProject } from '@/contexts/ProjectContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Edit, Calendar, User, Flag, Tag, Trash2, Loader2, CheckSquare, ArrowLeft } from 'lucide-react';
import TaskComments from '@/components/tasks/TaskComments2';
import { EditTaskDialog } from '@/components/tasks/EditTaskDialog';
import { useDeleteTask } from '@/hooks/useTaskMutations';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checklist } from '@/types/checklist';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { LinkifiedText } from '@/components/common/LinkifiedText';

const TaskDetailPage = () => {
  const navigate = useNavigate();
  const { taskId } = useParams<{ taskId: string }>();
  const { user } = useAuth();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentComment, setCurrentComment] = useState('');
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newChecklistTitle, setNewChecklistTitle] = useState('');
  const [newItemTexts, setNewItemTexts] = useState<{ [key: string]: string }>({});
  const [isCreatingChecklist, setIsCreatingChecklist] = useState(false);
  const [isAddingItem, setIsAddingItem] = useState<{ [key: string]: boolean }>({});

  const { data: task, isLoading: isLoadingTask, isError: isTaskError } = useTask(taskId);
  const deleteTask = useDeleteTask();
  const { getTaskChecklists, createChecklist, updateChecklist, deleteChecklist, createChecklistItem, updateChecklistItem, deleteChecklistItem } = useProject();

  // Chave única para o localStorage baseada na tarefa e usuário
  const commentStorageKey = `taskComment_${taskId}_${user?.id || 'anonymous'}`;

  useEffect(() => {
    if (taskId) {
      loadChecklists();
    }
  }, [taskId]);

  const loadChecklists = async () => {
    if (!taskId) return;
    
    try {
      setLoading(true);
      setError(null);
      const data = await getTaskChecklists(taskId);
      setChecklists(data);
    } catch (error: any) {
      setError(error.message || 'Erro ao carregar checklists');
      logger.error('Erro ao carregar checklists', { error, taskId, context: 'TaskDetailPage' });
    } finally {
      setLoading(false);
    }
  };

  const createNewChecklist = async () => {
    if (!taskId || !newChecklistTitle.trim()) {
      toast.error('Por favor, insira um título para o checklist');
      return;
    }
    
    try {
      setIsCreatingChecklist(true);
      const checklist = await createChecklist({
        title: newChecklistTitle.trim(),
        task_id: taskId
      });
      
      setChecklists([...checklists, checklist]);
      setNewChecklistTitle('');
      toast.success('Checklist criado com sucesso!');
    } catch (error: any) {
      setError(error.message || 'Erro ao criar checklist');
      logger.error('Erro ao criar checklist', { error, taskId, context: 'TaskDetailPage' });
    } finally {
      setIsCreatingChecklist(false);
    }
  };

  const addItemToChecklist = async (checklistId: string) => {
    const itemText = newItemTexts[checklistId];
    if (!itemText?.trim()) return;
    
    try {
      setIsAddingItem({ ...isAddingItem, [checklistId]: true });
      const item = await createChecklistItem({
        text: itemText,
        checklist_id: checklistId
      });
      
      setChecklists(checklists.map(checklist => 
        checklist.id === checklistId 
          ? { ...checklist, items: [...(checklist.items || []), item] }
          : checklist
      ));
      
      setNewItemTexts({ ...newItemTexts, [checklistId]: '' });
    } catch (error: any) {
      setError(error.message || 'Erro ao adicionar item');
      logger.error('Erro ao adicionar item ao checklist', { error, checklistId, context: 'TaskDetailPage' });
    } finally {
      setIsAddingItem({ ...isAddingItem, [checklistId]: false });
    }
  };

  const toggleItemCompletion = async (checklistId: string, itemId: string, completed: boolean) => {
    try {
      await updateChecklistItem(itemId, { completed });
      
      setChecklists(checklists.map(checklist => 
        checklist.id === checklistId 
          ? {
              ...checklist,
              items: checklist.items?.map(item => 
                item.id === itemId 
                  ? { ...item, completed, completed_at: completed ? new Date().toISOString() : null }
                  : item
              ) || []
            }
          : checklist
      ));
    } catch (error) {
      logger.error('Erro ao atualizar item do checklist', { error, checklistId, itemId, context: 'TaskDetailPage' });
    }
  };

  const deleteItem = async (checklistId: string, itemId: string) => {
    try {
      await deleteChecklistItem(itemId);
      
      setChecklists(checklists.map(checklist => 
        checklist.id === checklistId 
          ? {
              ...checklist,
              items: checklist.items?.filter(item => item.id !== itemId) || []
            }
          : checklist
      ));
    } catch (error) {
      logger.error('Erro ao excluir item do checklist', { error, checklistId, itemId, context: 'TaskDetailPage' });
    }
  };

  const deleteChecklistGroup = async (checklistId: string) => {
    try {
      await deleteChecklist(checklistId);
      setChecklists(checklists.filter(checklist => checklist.id !== checklistId));
    } catch (error) {
      logger.error('Erro ao excluir checklist', { error, checklistId, context: 'TaskDetailPage' });
    }
  };

  const getCompletionStats = (items: Checklist['items'] = []) => {
    const completed = items.filter(item => item.completed).length;
    const total = items.length;
    return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 };
  };

  const handleDeleteTask = async () => {
    if (!taskId) {
      logger.error('ID da tarefa não encontrado', { context: 'TaskDetailPage' });
      toast.error('Erro ao excluir tarefa: ID não encontrado');
      return;
    }
    
    try {
      setIsDeleteDialogOpen(false);
      await deleteTask.mutateAsync(taskId);
      navigate(-1);
      toast.success('Tarefa excluída com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao excluir tarefa', { error, context: 'TaskDetailPage' });
      toast.error('Erro ao excluir tarefa. Tente novamente.');
    }
  };

  if (isLoadingTask) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="text-muted-foreground">Carregando tarefa...</p>
        </div>
      </div>
    );
  }

  if (isTaskError || !task) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p className="text-destructive">Erro ao carregar tarefa ou tarefa não encontrada.</p>
        </div>
      </div>
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
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="hover:bg-secondary"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{task.title}</h1>
            <p className="text-muted-foreground">
              Detalhes e gerenciamento da tarefa
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => setIsEditOpen(true)}
          >
            <Edit className="mr-2 h-4 w-4" />
            Editar
          </Button>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={() => setIsDeleteDialogOpen(true)}
            disabled={deleteTask.isPending}
          >
            {deleteTask.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            Excluir
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Tabs defaultValue="details" className="space-y-4">
            <TabsList>
              <TabsTrigger value="details">Detalhes</TabsTrigger>
              <TabsTrigger value="checklist">Checklist</TabsTrigger>
              <TabsTrigger value="comments">Comentários</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Informações da Tarefa</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center space-x-4">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(task.status)}`}></div>
                    <Badge variant={getPriorityColor(task.priority)}>
                      <Flag className="mr-1 h-3 w-3" />
                      {task.priority}
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Descrição</h4>
                    <LinkifiedText 
                      text={task.description || 'Nenhuma descrição fornecida'} 
                      className="text-muted-foreground whitespace-pre-line"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {task.assigned_profile && (
                      <div className="flex items-center space-x-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{task.assigned_profile.name}</span>
                      </div>
                    )}
                    {task.due_date && (
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Vencimento: {new Date(task.due_date).toLocaleDateString('pt-BR')}</span>
                      </div>
                    )}
                    {task.created_at && (
                      <div className="flex items-center space-x-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Criada em: {new Date(task.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    )}
                  </div>
                  {task.tags && task.tags.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center">
                        <Tag className="mr-2 h-4 w-4" />
                        Tags
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {task.tags.map((tag, index) => (
                          <Badge key={index} variant="outline">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="checklist" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Checklists</CardTitle>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        placeholder="Nome do novo checklist"
                        value={newChecklistTitle}
                        onChange={(e) => setNewChecklistTitle(e.target.value)}
                        onKeyPress={(e) => {
                          if (e.key === 'Enter' && newChecklistTitle.trim()) {
                            createNewChecklist();
                          }
                        }}
                        className="px-3 py-2 border rounded-md bg-background text-foreground"
                        disabled={isCreatingChecklist}
                      />
                      <Button 
                        onClick={createNewChecklist} 
                        className="flex items-center space-x-2"
                        disabled={isCreatingChecklist || !newChecklistTitle.trim()}
                      >
                        {isCreatingChecklist ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckSquare className="h-4 w-4" />
                        )}
                        <span>{isCreatingChecklist ? 'Criando...' : 'Novo Checklist'}</span>
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4">
                    {checklists.map((checklist) => {
                      const stats = getCompletionStats(checklist.items);
                      return (
                        <Card key={checklist.id} className="flex flex-col">
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <CardTitle className="text-lg flex items-center space-x-2">
                                  <CheckSquare className="h-5 w-5 text-primary" />
                                  <span>{checklist.title}</span>
                                </CardTitle>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {stats.total} {stats.total === 1 ? 'item' : 'itens'}
                                </p>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deleteChecklistGroup(checklist.id)}
                                className="text-destructive hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            
                            <div className="flex items-center space-x-2">
                              <Badge variant={stats.percentage === 100 ? 'default' : 'secondary'}>
                                {stats.completed}/{stats.total} ({stats.percentage}%)
                              </Badge>
                              <div className="flex-1 bg-secondary rounded-full h-2">
                                <div 
                                  className="bg-primary h-2 rounded-full transition-all duration-300"
                                  style={{ width: `${stats.percentage}%` }}
                                />
                              </div>
                            </div>
                          </CardHeader>
                          
                          <CardContent className="flex-1 space-y-3">
                            <div className="space-y-2">
                              {checklist.items?.map((item) => (
                                <div key={item.id} className="flex items-center space-x-2 group">
                                  <Checkbox
                                    checked={item.completed}
                                    onCheckedChange={(checked) => toggleItemCompletion(checklist.id, item.id, checked as boolean)}
                                  />
                                  <span 
                                    className={`flex-1 text-sm ${
                                      item.completed 
                                        ? 'line-through text-muted-foreground' 
                                        : 'text-foreground'
                                    }`}
                                  >
                                    {item.text}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => deleteItem(checklist.id, item.id)}
                                    className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive p-1 h-auto"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              ))}
                            </div>
                            
                            <div className="flex space-x-2 pt-2 border-t">
                              <input
                                type="text"
                                placeholder="Adicionar item..."
                                value={newItemTexts[checklist.id] || ''}
                                onChange={(e) => setNewItemTexts({ 
                                  ...newItemTexts, 
                                  [checklist.id]: e.target.value 
                                })}
                                onKeyPress={(e) => e.key === 'Enter' && addItemToChecklist(checklist.id)}
                                className="flex-1 px-3 py-2 border rounded-md bg-background text-foreground"
                                disabled={isAddingItem[checklist.id]}
                              />
                              <Button 
                                size="sm" 
                                onClick={() => addItemToChecklist(checklist.id)}
                                className="px-3"
                                disabled={isAddingItem[checklist.id]}
                              >
                                {isAddingItem[checklist.id] ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckSquare className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                    
                    {checklists.length === 0 && (
                      <div className="text-center py-12">
                        <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-muted-foreground mb-2">
                          Nenhum checklist criado
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Crie seu primeiro checklist para começar a organizar suas tarefas
                        </p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="comments">
              <Card>
                <CardHeader>
                  <CardTitle>Comentários</CardTitle>
                </CardHeader>
                <CardContent>
                  <TaskComments 
                    taskId={task.id} 
                    projectId={task.project_id} 
                    comments={task.comments?.map(comment => ({
                      ...comment,
                      task_id: task.id,
                      project_id: task.project_id,
                      created_by: comment.profiles?.id || '',
                      updated_at: comment.created_at,
                      deleted_at: null
                    })) || []} 
                    currentComment={currentComment}
                    onCommentChange={setCurrentComment}
                    onCommentSubmit={() => {
                      localStorage.removeItem(commentStorageKey);
                      setCurrentComment('');
                    }}
                  />
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Progresso</span>
                  <Badge variant="outline">
                    {task.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Prioridade</span>
                  <Badge variant={getPriorityColor(task.priority)}>
                    {task.priority}
                  </Badge>
                </div>
                {task.due_date && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Data de entrega</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(task.due_date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}
                {task.created_at && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Data de criação</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(task.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <EditTaskDialog 
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
        task={task}
        projectId={task.project_id}
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
    </div>
  );
};

export default TaskDetailPage; 