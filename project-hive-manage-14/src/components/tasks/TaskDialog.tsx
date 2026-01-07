import { useState, useEffect } from 'react';
import { useCreateTask } from '@/hooks/useTaskMutations';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { supabase } from '@/lib/supabase';
import { TaskInsert } from '@/types/supabase';
import { Database } from '@/integrations/supabase/types';
import { logger } from '@/lib/logger';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProjectMember = Database['public']['Tables']['project_members']['Row'];

interface MemberWithProfile {
  user_id: string;
  role: string;
  name: string | null;
  email: string | null;
}

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const TaskDialog = ({
  open,
  onOpenChange,
  projectId
}: TaskDialogProps) => {
  const { user } = useAuth();
  const { getProject } = useProject();
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  // Chave única para o localStorage baseada no projeto e usuário
  const storageKey = `taskForm_${projectId}_${user?.id || 'anonymous'}`;
  
  // Função para carregar dados do localStorage
  const loadFormDataFromStorage = () => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (error) {
      logger.error('Erro ao carregar dados do localStorage', { error, context: 'TaskDialog' });
    }
    return {
      title: '',
      description: '',
      status: 'todo',
      priority: 'medium',
      dueDate: '',
      assignedTo: 'unassigned',
      comments: ''
    };
  };

  const [formData, setFormData] = useState(loadFormDataFromStorage);

  // Salvar dados no localStorage sempre que o formData mudar
  useEffect(() => {
    if (open && (formData.title || formData.description)) {
      logger.debug('Salvando dados no localStorage', { formData, context: 'TaskDialog' });
      localStorage.setItem(storageKey, JSON.stringify(formData));
    }
  }, [formData, storageKey, open]);

  // Carregar dados do localStorage quando o diálogo abrir
  useEffect(() => {
    if (open) {
      try {
        const saved = localStorage.getItem(storageKey);
        logger.debug('Dados salvos encontrados', { saved: !!saved, context: 'TaskDialog' });
        if (saved) {
          const savedData = JSON.parse(saved);
          logger.debug('Carregando dados salvos', { savedData, context: 'TaskDialog' });
          setFormData(savedData);
        }
      } catch (error) {
        logger.error('Erro ao carregar dados do localStorage', { error, context: 'TaskDialog' });
      }
    }
  }, [open, storageKey]);

  useEffect(() => {
    const loadProjectMembers = async () => {
      try {
        const project = await getProject(projectId);
        if (project?.members) {
          logger.debug('Membros carregados', { membersCount: project.members.length, context: 'TaskDialog' });
          
          // Buscar dados dos profiles para cada membro
          const membersWithProfiles = await Promise.all(
            project.members.map(async (member: ProjectMember) => {
              const { data, error } = await supabase
                .from('profiles')
                .select('id, name, email')
                .eq('id', member.user_id as any)
                .single();
              
              if (error) {
                logger.error('Erro ao buscar profile', { error, userId: member.user_id, context: 'TaskDialog' });
                return {
                  user_id: member.user_id,
                  role: member.role,
                  name: null,
                  email: null
                };
              }
              
              const profile = data as any;
              return {
                user_id: member.user_id,
                role: member.role,
                name: profile?.name || null,
                email: profile?.email || null
              };
            })
          );
          
          logger.debug('Membros com profiles', { membersWithProfiles, context: 'TaskDialog' });
          setMembers(membersWithProfiles);
        }
      } catch (error) {
        logger.error('Erro ao carregar membros do projeto', { error, projectId, context: 'TaskDialog' });
        toast.error('Erro ao carregar membros do projeto');
      }
    };

    if (projectId) {
      loadProjectMembers();
    }
  }, [projectId, getProject]);

  const createTask = useCreateTask();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    logger.debug('Iniciando submissão do formulário', { context: 'TaskDialog' });

    if (!projectId) {
      logger.error('ID do projeto não encontrado', { context: 'TaskDialog' });
      toast.error('Erro ao criar tarefa: Projeto não encontrado');
      return;
    }

    if (!user?.id) {
      logger.error('Usuário não autenticado', { context: 'TaskDialog' });
      toast.error('Erro ao criar tarefa: Usuário não autenticado');
      return;
    }

    const taskData: TaskInsert = {
      title: formData.title,
      description: formData.description,
      status: formData.status,
      priority: formData.priority,
      project_id: projectId,
      due_date: formData.dueDate || null,
      created_by: user.id,
      assigned_to: formData.assignedTo === 'unassigned' ? null : formData.assignedTo
    };

    logger.debug('Dados da tarefa preparados', { taskData, context: 'TaskDialog' });

    try {
      logger.debug('Chamando createTask...', { context: 'TaskDialog' });
      await createTask.mutateAsync(taskData);
      logger.info('Tarefa criada com sucesso', { taskTitle: taskData.title, projectId, context: 'TaskDialog' });
      
      // Limpar o formulário e o localStorage
      const emptyForm = {
        title: '',
        description: '',
        status: 'todo',
        priority: 'medium',
        dueDate: '',
        assignedTo: 'unassigned',
        comments: ''
      };
      setFormData(emptyForm);
      localStorage.removeItem(storageKey);
      
      // Fechar o diálogo
      onOpenChange(false);
    } catch (error) {
      logger.error('Erro ao criar tarefa', { error, context: 'TaskDialog' });
      toast.error('Erro ao criar tarefa. Tente novamente.');
    }
  };

  // Função para lidar com o fechamento do diálogo
  const handleDialogClose = (isOpen: boolean) => {
    logger.debug('handleDialogClose chamado', { 
      isOpen, 
      hasData: !!(formData.title || formData.description),
      context: 'TaskDialog'
    });
    
    if (!isOpen) {
      // Se há dados no formulário, perguntar se quer manter
      const hasData = formData.title || formData.description;
      if (hasData) {
        const keepData = window.confirm(
          'Você tem dados não salvos no formulário. Deseja manter esses dados para continuar depois?'
        );
        logger.debug('Usuário escolheu manter dados', { keepData, context: 'TaskDialog' });
        if (!keepData) {
          const emptyForm = {
            title: '',
            description: '',
            status: 'todo',
            priority: 'medium',
            dueDate: '',
            assignedTo: 'unassigned',
            comments: ''
          };
          setFormData(emptyForm);
          localStorage.removeItem(storageKey);
          logger.debug('Dados limpos do localStorage', { context: 'TaskDialog' });
        }
      }
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={handleDialogClose}
      // Impedir que o diálogo feche ao clicar fora ou pressionar ESC
      onEscapeKeyDown={(e) => {
        e.preventDefault();
        const hasData = formData.title || formData.description;
        if (hasData) {
          const keepData = window.confirm(
            'Você tem dados não salvos no formulário. Deseja manter esses dados para continuar depois?'
          );
          if (!keepData) {
            setFormData({
              title: '',
              description: '',
              status: 'todo',
              priority: 'medium',
              dueDate: '',
              assignedTo: 'unassigned',
              comments: ''
            });
            localStorage.removeItem(storageKey);
          }
        }
        onOpenChange(false);
      }}
      onInteractOutside={(e) => {
        e.preventDefault();
        const hasData = formData.title || formData.description;
        if (hasData) {
          const shouldClose = window.confirm(
            'Você tem dados não salvos no formulário. Deseja fechar o formulário?'
          );
          if (shouldClose) {
            const keepData = window.confirm(
              'Deseja manter esses dados para continuar depois?'
            );
            if (!keepData) {
              setFormData({
                title: '',
                description: '',
                status: 'todo',
                priority: 'medium',
                dueDate: '',
                assignedTo: 'unassigned',
                comments: ''
              });
              localStorage.removeItem(storageKey);
            }
            onOpenChange(false);
          }
        } else {
          onOpenChange(false);
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova Tarefa</DialogTitle>
          <DialogDescription className="sr-only">
            Preencha os campos para criar uma nova tarefa no projeto.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData(prev => ({ ...prev, status: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todo">Pendente</SelectItem>
                  <SelectItem value="doing">Em Progresso</SelectItem>
                  <SelectItem value="done">Concluída</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Prioridade</Label>
              <Select
                value={formData.priority}
                onValueChange={(value) => setFormData(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a prioridade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baixa</SelectItem>
                  <SelectItem value="medium">Média</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dueDate">Data de Vencimento</Label>
              <Input
                id="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assignedTo">Responsável</Label>
              <Select
                value={formData.assignedTo}
                onValueChange={(value) => setFormData(prev => ({ ...prev, assignedTo: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um membro" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="unassigned">Não atribuído</SelectItem>
                  {members.map((member) => {
                    const displayName = member.name || member.email || `Usuário ${member.user_id.slice(0, 8)}`;
                    return (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {displayName}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <Button type="button" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createTask.isPending}>
              {createTask.isPending ? 'Criando...' : 'Criar Tarefa'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TaskDialog;