import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUpdateTask } from '@/hooks/useTaskMutations';
import { toast } from 'sonner';
import { Task } from '@/contexts/ProjectContext';
import { supabase } from '@/lib/supabase';
import { Database } from '@/integrations/supabase/types';
import { useAuth } from '@/contexts/AuthContext';
import { logger } from '@/lib/logger';

type ProjectMember = Database['public']['Tables']['project_members']['Row'] & {
  profiles: Database['public']['Tables']['profiles']['Row'];
};

interface EditTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  projectId: string;
}

export const EditTaskDialog: React.FC<EditTaskDialogProps> = ({ open, onOpenChange, task, projectId }) => {
  const { user } = useAuth();
  const updateTask = useUpdateTask();
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'todo' as 'todo' | 'doing' | 'done',
    priority: 'medium' as 'high' | 'medium' | 'low',
    assigned_to: '',
    due_date: ''
  });

  // Chave única para o localStorage baseada na tarefa e usuário
  const editTaskStorageKey = `editTask_${task?.id}_${user?.id || 'anonymous'}`;

  // Função para salvar dados do formulário no localStorage
  const saveFormDataToStorage = (data: typeof formData) => {
    try {
      localStorage.setItem(editTaskStorageKey, JSON.stringify(data));
    } catch (error) {
      logger.error('Erro ao salvar dados no localStorage', { error, context: 'EditTaskDialog' });
    }
  };

  // Função para carregar dados do formulário do localStorage
  const loadFormDataFromStorage = () => {
    try {
      const savedData = localStorage.getItem(editTaskStorageKey);
      return savedData ? JSON.parse(savedData) : null;
    } catch (error) {
      logger.error('Erro ao carregar dados do localStorage', { error, context: 'EditTaskDialog' });
      return null;
    }
  };

  // Função para limpar dados do localStorage
  const clearFormDataFromStorage = () => {
    try {
      localStorage.removeItem(editTaskStorageKey);
    } catch (error) {
      logger.error('Erro ao limpar dados do localStorage', { error, context: 'EditTaskDialog' });
    }
  };

  // Função para verificar se há dados não salvos
  const hasUnsavedData = () => {
    if (!task) return false;
    
    return (
      formData.title !== task.title ||
      formData.description !== (task.description || '') ||
      formData.status !== task.status ||
      formData.priority !== task.priority ||
      formData.assigned_to !== (task.assigned_to || '') ||
      formData.due_date !== (task.due_date || '')
    );
  };

  // Função para lidar com o fechamento do diálogo
  const handleDialogClose = (shouldClose: boolean) => {
    if (!shouldClose) return;
    
    if (hasUnsavedData()) {
      const shouldKeepData = window.confirm(
        'Você tem alterações não salvas. Deseja manter essas alterações ou descartá-las?\n\nOK = Manter alterações\nCancelar = Descartar alterações'
      );
      
      if (!shouldKeepData && task) {
        // Limpar dados do localStorage e restaurar dados originais
        clearFormDataFromStorage();
        setFormData({
          title: task.title,
          description: task.description || '',
          status: (task.status as 'todo' | 'doing' | 'done') || 'todo',
          priority: (task.priority as 'high' | 'medium' | 'low') || 'medium',
          assigned_to: task.assigned_to || '',
          due_date: task.due_date || ''
        });
      } else {
        // Salvar dados no localStorage antes de fechar
        saveFormDataToStorage(formData);
      }
    }
    
    onOpenChange(false);
  };

  // Carregar dados salvos quando o diálogo abrir ou a tarefa mudar
  useEffect(() => {
    if (open && task) {
      const savedData = loadFormDataFromStorage();
      if (savedData) {
        // Usar dados salvos se existirem
        setFormData(savedData);
      } else {
        // Usar dados originais da tarefa
        setFormData({
          title: task.title,
          description: task.description || '',
          status: (task.status as 'todo' | 'doing' | 'done') || 'todo',
          priority: (task.priority as 'high' | 'medium' | 'low') || 'medium',
          assigned_to: task.assigned_to || '',
          due_date: task.due_date || ''
        });
      }
    }
  }, [open, task?.id, editTaskStorageKey]);

  // Salvar automaticamente os dados quando o formulário mudar
  useEffect(() => {
    if (open && task && hasUnsavedData()) {
      saveFormDataToStorage(formData);
    }
  }, [formData, open, task, editTaskStorageKey]);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data, error } = await supabase
        .from('project_members')
        .select(`
          *,
          profiles:user_id (
            id,
            name,
            email,
            avatar
          )
        `)
        .eq('project_id', projectId);

      if (error) {
        logger.error('Erro ao buscar membros', { error, projectId, context: 'EditTaskDialog' });
        return;
      }

      setProjectMembers(data || []);
    };

    fetchMembers();
  }, [projectId]);

  useEffect(() => {
    if (task) {
      logger.debug('Inicializando formulário com tarefa', { taskId: task.id, context: 'EditTaskDialog' });
      setFormData({
        title: task.title,
        description: task.description || '',
        status: (task.status as 'todo' | 'doing' | 'done') || 'todo',
        priority: (task.priority as 'high' | 'medium' | 'low') || 'medium',
        assigned_to: task.assigned_to || '',
        due_date: task.due_date || ''
      });
    }
  }, [task]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!task?.id) {
      logger.error('ID da tarefa não encontrado', { context: 'EditTaskDialog' });
      toast.error('Erro ao atualizar tarefa: ID não encontrado');
      return;
    }

    try {
      logger.debug('Atualizando tarefa', { id: task.id, formData, context: 'EditTaskDialog' });
      
      // Preparar os dados da tarefa
      const taskData = {
        ...formData,
        project_id: projectId
      };

      // Se a data de entrega estiver vazia, forçar null
      if (!formData.due_date || formData.due_date.trim() === '') {
        taskData.due_date = null;
      }

      // Remover campos vazios, exceto due_date que pode ser null
      const cleanTaskData = Object.fromEntries(
        Object.entries(taskData).filter(([key, value]) => {
          if (key === 'due_date') return true; // Sempre incluir due_date
          return value !== null && value !== '';
        })
      );

      logger.debug('Dados limpos para atualização', { cleanTaskData, context: 'EditTaskDialog' });

      await updateTask.mutateAsync({ 
        id: task.id, 
        updates: cleanTaskData 
      });
      
      // Limpar dados salvos após sucesso
      clearFormDataFromStorage();
      onOpenChange(false);
    } catch (error) {
      logger.error('Erro ao atualizar tarefa', { error, taskId: task.id, context: 'EditTaskDialog' });
      toast.error('Erro ao atualizar tarefa. Tente novamente.');
    }
  };

  if (!task) return null;

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
            'Você tem alterações não salvas. Deseja manter essas alterações ou descartá-las?\n\nOK = Manter alterações\nCancelar = Descartar alterações'
          );
          
          if (!shouldKeepData && task) {
            clearFormDataFromStorage();
            setFormData({
              title: task.title,
              description: task.description || '',
              status: (task.status as 'todo' | 'doing' | 'done') || 'todo',
              priority: (task.priority as 'high' | 'medium' | 'low') || 'medium',
              assigned_to: task.assigned_to || '',
              due_date: task.due_date || ''
            });
          } else {
            saveFormDataToStorage(formData);
          }
          onOpenChange(false);
        }
      }}
      onInteractOutside={(e) => {
        if (hasUnsavedData()) {
          e.preventDefault();
          const shouldKeepData = window.confirm(
            'Você tem alterações não salvas. Deseja manter essas alterações ou descartá-las?\n\nOK = Manter alterações\nCancelar = Descartar alterações'
          );
          
          if (!shouldKeepData && task) {
            clearFormDataFromStorage();
            setFormData({
              title: task.title,
              description: task.description || '',
              status: (task.status as 'todo' | 'doing' | 'done') || 'todo',
              priority: (task.priority as 'high' | 'medium' | 'low') || 'medium',
              assigned_to: task.assigned_to || '',
              due_date: task.due_date || ''
            });
          } else {
            saveFormDataToStorage(formData);
          }
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Tarefa</DialogTitle>
          <DialogDescription>
            Faça as alterações necessárias na tarefa.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Título da Tarefa</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="Digite o título da tarefa"
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Descrição</label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva a tarefa"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <Select
                value={formData.status}
                onValueChange={(value: 'todo' | 'doing' | 'done') => 
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">A Fazer</SelectItem>
                  <SelectItem value="doing">Em Progresso</SelectItem>
                  <SelectItem value="done">Concluído</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Prioridade</label>
              <Select
                value={formData.priority}
                onValueChange={(value: 'high' | 'medium' | 'low') => 
                  setFormData({ ...formData, priority: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="low">Baixa</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Responsável</label>
            <Select
              value={formData.assigned_to}
              onValueChange={(value) => setFormData({ ...formData, assigned_to: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {projectMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    {member.profiles?.name || 'Usuário'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Data de Entrega</label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={formData.due_date}
                onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              />
              {formData.due_date && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    // Atualizar o estado local
                    setFormData({ ...formData, due_date: '' });
                    
                    // Atualizar imediatamente no servidor
                    try {
                      await updateTask.mutateAsync({ 
                        id: task.id, 
                        updates: { 
                          ...formData,
                          due_date: null,
                          project_id: projectId
                        } 
                      });
                      toast.success('Data de entrega removida com sucesso!');
                    } catch (error) {
                      logger.error('Erro ao remover data', { error, taskId: task.id, context: 'EditTaskDialog' });
                      toast.error('Erro ao remover data de entrega');
                      // Reverter o estado local em caso de erro
                      setFormData({ ...formData, due_date: task.due_date || '' });
                    }
                  }}
                >
                  Remover
                </Button>
              )}
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={updateTask.isPending}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              className="bg-gradient-to-r from-blue-600 to-purple-600"
              disabled={updateTask.isPending}
            >
              {updateTask.isPending ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditTaskDialog;
