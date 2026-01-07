import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { PostgrestError } from '@supabase/supabase-js';
import { RealtimeChannel } from '@supabase/supabase-js';
import { checkSupabaseConnection, reconnectSupabase } from '@/lib/supabase';
import { useAuth } from './SupabaseAuthContext';
import { logger } from '@/lib/logger';
import { useLocation } from 'react-router-dom';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { useQueryClient } from '@tanstack/react-query';
import { Checklist, ChecklistItem, CreateChecklistData, CreateChecklistItemData, UpdateChecklistItemData } from '@/types/checklist';

// Verificar se já existe uma instância do cliente
let supabaseInstance: typeof supabase | null = null;

// Função para obter a instância do Supabase
const getSupabaseInstance = () => {
  if (!supabaseInstance) {
    supabaseInstance = supabase;
  }
  return supabaseInstance;
};

export type Project = Database['public']['Tables']['projects']['Row'] & {
  status?: 'active' | 'completed' | 'on-hold';
  visibility?: 'public' | 'private';
  color?: string;
  start_date?: string | null;
  end_date?: string | null;
  members?: Database['public']['Tables']['project_members']['Row'][];
  tasks?: Task[];
};

type Task = Database['public']['Tables']['tasks']['Row'] & {
  tags?: string[];
  comments?: Database['public']['Tables']['comments']['Row'][];
  description: string | null;
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

interface ProjectContextType {
  projects: Project[];
  deletedProjects: Project[];
  loading: boolean;
  error: string | null;
  getProjects: () => Promise<void>;
  getProject: (id: string) => Promise<Project | null>;
  createProject: (project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) => Promise<void>;
  updateProject: (id: string, project: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  restoreProject: (id: string) => Promise<void>;
  permanentlyDeleteProject: (id: string) => Promise<void>;
  clearTrash: () => Promise<void>;
  getProjectMembers: (projectId: string) => Promise<Database['public']['Tables']['project_members']['Row'][]>;
  addProjectMember: (projectIdOrMember: string | Database['public']['Tables']['project_members']['Insert'], userId?: string) => Promise<void>;
  removeProjectMember: (projectId: string, userId: string) => Promise<void>;
  getProjectTasks: (projectId: string) => Promise<Task[]>;
  createTask: (projectId: string, taskData: Partial<Task>) => Promise<Task>;
  updateTask: (id: string, task: Partial<Task>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;
  addTaskTag: (taskId: string, tagId: string) => Promise<void>;
  removeTaskTag: (taskId: string, tagId: string) => Promise<void>;
  addComment: (comment: Database['public']['Tables']['comments']['Insert']) => Promise<void>;
  updateComment: (id: string, comment: Database['public']['Tables']['comments']['Update']) => Promise<void>;
  deleteComment: (id: string) => Promise<void>;
  getOverdueTasks: () => Promise<Task[]>;
  getUpcomingTasks: (days: number) => Promise<Task[]>;
  refreshProjects: () => Promise<void>;
  getTaskChecklists: (taskId: string) => Promise<Checklist[]>;
  createChecklist: (data: CreateChecklistData) => Promise<Checklist>;
  updateChecklist: (id: string, title: string) => Promise<void>;
  deleteChecklist: (id: string) => Promise<void>;
  createChecklistItem: (data: CreateChecklistItemData) => Promise<ChecklistItem>;
  updateChecklistItem: (id: string, data: UpdateChecklistItemData) => Promise<void>;
  deleteChecklistItem: (id: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// Cache para os checklists
const checklistCache = new Map<string, {
  data: Checklist[];
  timestamp: number;
}>();

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

type ProjectProviderProps = {
  children: ReactNode;
};

export function ProjectProvider({ children }: ProjectProviderProps) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  logger.debug('Iniciando carregamento do projeto', { context: 'ProjectContext' });
  const [projects, setProjects] = useState<Project[]>([]);
  const [deletedProjects, setDeletedProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const { user, isLoading: authLoading } = useAuth();

  // REFs para controle
  const isLoadingRef = useRef(false);
  const lastLoadTimeRef = useRef(0);
  const mountedRef = useRef(true);
  const initializationRef = useRef(false);

  // Função para lidar com reconexão de canais (simplificada)
  const handleChannelReconnection = (channel: RealtimeChannel, channelName: string, retryCount: number) => {
    if (!mountedRef.current) return;
    
    const state = channel.state as string;
    if (state === 'CLOSED' || state === 'CHANNEL_ERROR') {
      logger.debug(`Canal ${channelName} em estado crítico: ${state}. Tentando reconectar...`, { context: 'Realtime' });
      
      // Tentar reconectar após um delay exponencial
      const retryDelay = Math.min(1000 * Math.pow(2, retryCount), 30000);
      
      setTimeout(() => {
        if (mountedRef.current) {
          logger.debug(`Tentando reconectar canal ${channelName} após ${retryDelay}ms`, { context: 'Realtime' });
          try {
            channel.unsubscribe();
            setupChannel(channelName, channelName, retryCount + 1);
          } catch (error) {
            logger.error(`Erro ao reconectar canal ${channelName}`, { error, context: 'Realtime' });
          }
        }
      }, retryDelay);
    }
  };

  // Função para verificar a saúde dos canais
  const checkChannelsHealth = (channels: RealtimeChannel[]) => {
    channels.forEach((channel) => {
      const state = channel.state as string;
      if (state === 'CLOSED' || state === 'CHANNEL_ERROR') {
        logger.debug(`Canal em estado crítico. Será recriado na próxima inicialização.`, { channel, context: 'Realtime' });
        try {
          channel.unsubscribe();
        } catch (error) {
          logger.error(`Erro ao limpar canal ${(channel as any).id || 'desconhecido'}`, { error, context: 'Realtime' });
        }
      }
    });
  };

  // Função para limpar os canais
  const cleanupChannels = (channels: RealtimeChannel[]) => {
    channels.forEach((channel) => {
      try {
        channel.unsubscribe();
        logger.debug(`Canal ${(channel as any).id || 'desconhecido'} desinscrito com sucesso`, { context: 'Realtime' });
      } catch (error) {
        logger.error(`Erro ao desinscrever canal ${(channel as any).id || 'desconhecido'}`, { error, context: 'Realtime' });
      }
    });
  };

  const getProjects = useCallback(async () => {
    if (isLoadingRef.current || authLoading || !user?.id) {
      logger.debug('Pulando carregamento - condições não atendidas', {
        isLoading: isLoadingRef.current,
        authLoading,
        hasUser: !!user?.id,
        context: 'ProjectContext'
      });
      return;
    }

    const now = Date.now();
    const timeSinceLastLoad = now - lastLoadTimeRef.current;
    
    // Reduzir throttling em produção
    const throttleTime = process.env.NODE_ENV === 'development' ? 2000 : 1000;
    
    if (timeSinceLastLoad < throttleTime && initializationRef.current) {
      logger.debug('Throttling - muito cedo para recarregar', {
        timeSinceLastLoad,
        throttleTime,
        context: 'ProjectContext'
      });
      return;
    }

    isLoadingRef.current = true;
    lastLoadTimeRef.current = now;

    try {
      setLoading(true);
      setError(null);

      // Verificar conexão com o Supabase
      const isConnected = await checkSupabaseConnection();
      if (!isConnected) {
        throw new Error('Não foi possível conectar ao banco de dados');
      }

      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          creator:profiles!created_by(
            id,
            name,
            email,
            avatar,
            role,
            status
          ),
          project_members(
            *,
            profiles (
              id,
              name,
              email,
              avatar,
              role,
              status
            )
          ),
          tasks(*)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        if (error instanceof Error) {
          logger.error('Erro ao buscar projetos', { error: error.message, context: 'ProjectContext' });
          setError(error.message);
          toast.error('Erro ao carregar projetos: ' + error.message);
        } else if ((error as any)?.code) {
          logger.error('Erro do Supabase', { error: (error as any).message, context: 'ProjectContext' });
          setError((error as any).message);
          toast.error('Erro ao carregar projetos: ' + (error as any).message);
        } else {
          logger.error('Erro desconhecido', { error, context: 'ProjectContext' });
          setError('Erro desconhecido ao carregar projetos');
          toast.error('Erro desconhecido ao carregar projetos');
        }
        throw error;
      }

      if (process.env.NODE_ENV === 'development') logger.debug('Projetos encontrados', { count: data.length, context: 'ProjectContext' });

      const activeProjects = (data as any[])
        .filter(project => !project.deleted_at)
        .map(project => ({
          ...project,
          color: project.color || 'bg-custom-blue-500',
          creator: project.creator,
          members: project.project_members?.map((member: any) => ({
            ...member,
            name: member.profiles?.name || member.user_id,
            email: member.profiles?.email,
            avatar: member.profiles?.avatar,
            role: member.profiles?.role || 'member',
            status: member.profiles?.status
          })) || [],
          tasks: project.tasks?.map((task: any) => ({
            ...task,
            tags: [],
            comments: []
          })) || []
        }));

      const deletedProjects = (data as any[])
        .filter(project => project.deleted_at)
        .map(project => ({
          ...project,
          color: project.color || 'bg-custom-blue-500',
          creator: project.creator,
          members: project.project_members?.map((member: any) => ({
            ...member,
            name: member.profiles?.name || member.user_id,
            email: member.profiles?.email,
            avatar: member.profiles?.avatar,
            role: member.profiles?.role || 'member',
            status: member.profiles?.status
          })) || [],
          tasks: project.tasks?.map((task: any) => ({
            ...task,
            tags: [],
            comments: []
          })) || []
        }));

      if (process.env.NODE_ENV === 'development') logger.debug('Projetos ativos', { count: activeProjects.length, context: 'ProjectContext' });
      if (process.env.NODE_ENV === 'development') logger.debug('Projetos excluídos', { count: deletedProjects.length, context: 'ProjectContext' });

      setProjects(activeProjects);
      setDeletedProjects(deletedProjects);

      // Após carregar os dados, salvar no localStorage
      if (activeProjects.length > 0) {
        try {
          localStorage.setItem('cached_projects', JSON.stringify({
            data: activeProjects,
            timestamp: now
          }));
        } catch (error) {
          logger.error('Erro ao salvar cache local', { error, context: 'ProjectContext' });
        }
      }

    } catch (error: any) {
      logger.error('Erro ao carregar projetos', { 
        error: error.message,
        context: 'ProjectContext'
      });
      
      // Tentar recuperar dados do cache em caso de erro
      try {
        const cached = localStorage.getItem('cached_projects');
        if (cached) {
          const { data, timestamp } = JSON.parse(cached);
          const cacheAge = now - timestamp;
          
          // Usar cache apenas se tiver menos de 5 minutos
          if (cacheAge < 300000) {
            logger.debug('Usando dados do cache local', {
              cacheAge,
              context: 'ProjectContext'
            });
            setProjects(data);
            initializationRef.current = true;
            return;
          }
        }
      } catch (cacheError) {
        logger.error('Erro ao recuperar cache local', {
          error: cacheError,
          context: 'ProjectContext'
        });
      }
      
      setError(error.message);
      toast.error('Erro ao carregar projetos: ' + error.message);
    } finally {
      setLoading(false);
      isLoadingRef.current = false;
    }
  }, [user?.id, authLoading, initializationRef]);

  useEffect(() => {
    if (authLoading) {
      logger.debug('Aguardando autenticação...', { context: 'ProjectContext' });
      return;
    }
    
    if (!user) {
      logger.debug('Usuário não autenticado, resetando estado...', { context: 'ProjectContext' });
      setCurrentUserId(null);
      setProjects([]);
      setDeletedProjects([]);
      setLoading(false);
      return;
    }

    // Se o usuário mudou, resetar tudo
    if (currentUserId && currentUserId !== user.id) {
      logger.debug('Usuário mudou, resetando estado...', { 
        oldUserId: currentUserId,
        newUserId: user.id,
        context: 'ProjectContext'
      });
      setProjects([]);
      setDeletedProjects([]);
    }

    setCurrentUserId(user.id);
    
    // Inicializar dados apenas se não foi inicializado ainda
    if (!initializationRef.current) {
      logger.debug('Inicializando dados pela primeira vez...', { context: 'ProjectContext' });
      getProjects();
    }
  }, [user, authLoading, currentUserId, getProjects]);

  // Adicionar novo useEffect para monitorar mudanças de rota
  useEffect(() => {
    if (user?.id && initializationRef.current) {
      logger.debug('Rota alterada, verificando necessidade de recarregar dados', {
        path: location.pathname,
        context: 'ProjectContext'
      });
      
      // Verificar se a rota atual requer dados de projeto
      const requiresProjectData = location.pathname.includes('/projects') || 
                                location.pathname.includes('/dashboard');
      
      if (requiresProjectData) {
        const now = Date.now();
        const timeSinceLastLoad = now - lastLoadTimeRef.current;
        
        // Recarregar dados se passou mais de 30 segundos desde o último carregamento
        if (timeSinceLastLoad > 30000) {
          logger.debug('Recarregando dados após mudança de rota', {
            timeSinceLastLoad,
            context: 'ProjectContext'
          });
          getProjects();
        }
      }
    }
  }, [location.pathname, user?.id, initializationRef, getProjects]);

  // Configurar assinaturas em tempo real
  useEffect(() => {
    if (!currentUserId) return;

    mountedRef.current = true;
    const channels: RealtimeChannel[] = [];
    let retryCount = 0;
    const maxRetries = 5;

    const setupChannel = (channelName: string, table: string, currentRetryCount: number = 0) => {
      if (!mountedRef.current) return;

      // Verificar se já existe um canal com este nome
      const existingChannel = channels.find(ch => (ch as any).topic === channelName);
      if (existingChannel) {
        if (process.env.NODE_ENV === 'development') console.log(`[Realtime] Canal ${channelName} já existe, pulando criação`);
        return existingChannel;
      }

      const channel = supabase
        .channel(channelName)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: table
        }, async (payload) => {
          if (!mountedRef.current) return;
          if (process.env.NODE_ENV === 'development') console.log(`[Realtime] Mudança em ${channelName}:`, payload);
          await getProjects();
        })
        .subscribe((status) => {
          if (!mountedRef.current) return;
          
          const channelStatus = status as string;
          if (process.env.NODE_ENV === 'development') {
            logger.debug('Status da assinatura', { channel: channelName, status, context: 'Realtime' });
          }
          
          if (channelStatus === 'CHANNEL_ERROR' || channelStatus === 'CLOSED') {
            logger.error('Erro no canal', {
              channel: channelName,
              status,
              channelState: channel.state,
              context: 'Realtime'
            });

            // Tentar reconectar após um delay exponencial
            const retryDelay = Math.min(1000 * Math.pow(2, currentRetryCount), 30000);
            const nextRetryCount = Math.min(currentRetryCount + 1, maxRetries);

            setTimeout(() => {
              if (mountedRef.current) {
                logger.debug('Tentando reconectar canal', { 
                  channel: channelName, 
                  retryCount: nextRetryCount,
                  retryDelay,
                  context: 'Realtime' 
                });
                try {
                  channel.unsubscribe();
                  setupChannel(channelName, table, nextRetryCount);
                } catch (error) {
                  logger.error('Erro ao reconectar canal', { 
                    error, 
                    channel: channelName,
                    retryCount: nextRetryCount,
                    context: 'Realtime' 
                  });
                }
              }
            }, retryDelay);
          } else if (channelStatus === 'SUBSCRIBED') {
            // Resetar o contador de tentativas quando a conexão é bem-sucedida
            retryCount = 0;
          }
        });

      channels.push(channel);
      return channel;
    };

    // Configurar canais com debounce para evitar múltiplas reconexões
    const setupChannels = () => {
      if (!mountedRef.current) return;

      // Limpa canais existentes de forma completa
      cleanupChannels(channels);
      
      // Garantir que o array de canais esteja vazio após a limpeza
      channels.length = 0;

      // Configurar novos canais com tratamento de erro
      try {
        setupChannel('projects', 'projects');
        setupChannel('tasks', 'tasks');
        setupChannel('project_members', 'project_members');
        setupChannel('comments', 'comments');
        
        if (process.env.NODE_ENV === 'development') {
          logger.debug('Canais configurados com sucesso', { context: 'Realtime' });
        }
      } catch (error) {
        logger.error('Erro ao configurar canais', { error, context: 'Realtime' });
        
        // Tentar reconectar todos os canais após um delay
        setTimeout(() => {
          if (mountedRef.current) {
            logger.debug('Tentando reconectar todos os canais', { context: 'Realtime' });
            setupChannels();
          }
        }, 5000);
      }
    };

    // Configurar canais iniciais
    setupChannels();

    // Configurar verificação periódica de saúde dos canais
    const healthCheckInterval = setInterval(() => {
      if (mountedRef.current) {
        checkChannelsHealth(channels);
      }
    }, 30000); // Verificar a cada 30 segundos

    return () => {
      mountedRef.current = false;
      clearInterval(healthCheckInterval);
      cleanupChannels(channels);
    };
  }, [currentUserId, getProjects]);

  const getProject = async (id: string) => {
    // Se o id for 'new', retornamos um projeto vazio em vez de null
    // para permitir a criação de um novo projeto
    if (id === 'new') {
      logger.debug('Retornando projeto vazio para id="new"');
      return {
        id: 'new',
        name: '',
        description: '',
        status: 'active',
        visibility: 'public',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        created_by: '',
        color: '',
        start_date: new Date().toISOString(),
        end_date: null,
        deleted_at: null,
        members: [],
        tasks: []
      } as unknown as Project;
    }
    
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          *,
          project_members(*, profiles(id, name, email, avatar, role, status)),
          tasks(
            *,
            task_tags(tag),
            comments(*)
          )
        `)
        .eq('id', id)
        .single();

      if (error) throw error;

      return {
        ...data,
        color: data.color || 'bg-custom-blue-500',
        members: data.project_members?.map((member: any) => ({
          ...member,
          name: member.profiles?.name || member.user_id,
          email: member.profiles?.email,
          avatar: member.profiles?.avatar,
          role: member.profiles?.role || 'member',
          status: member.profiles?.status
        })) || [],
        tasks: data.tasks.map((task: any) => ({
          ...task,
          tags: task.task_tags?.map((tag: any) => tag.tag) || [],
          comments: task.comments || []
        })) || []
      };
    } catch (error: any) {
      toast.error('Erro ao carregar projeto: ' + error.message);
      return null;
    }
  };

  const createProject = async (project: Omit<Project, 'id' | 'created_at' | 'updated_at' | 'deleted_at'>) => {
    logger.debug('Iniciando criação de projeto', { project, context: 'ProjectContext' });
    try {
      // Atualizar o estado otimisticamente
      const optimisticProject = {
        ...project,
        id: crypto.randomUUID(), // ID temporário
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
      } as Project;

      if (process.env.NODE_ENV === 'development') logger.debug('Projeto otimista criado', { project: optimisticProject, context: 'ProjectContext' });
      setProjects(prevProjects => {
        const newProjects = [...prevProjects, optimisticProject];
        if (process.env.NODE_ENV === 'development') logger.debug('Estado atualizado (otimista)', { count: newProjects.length, context: 'ProjectContext' });
        return newProjects;
      });

      const { data, error } = await supabase
        .from('projects')
        .insert(project)
        .select()
        .single();

      if (error) {
        logger.error('Erro ao criar projeto no Supabase', { error, context: 'ProjectContext' });
        // Reverter o estado em caso de erro
        setProjects(prevProjects => {
          const revertedProjects = prevProjects.filter(p => p.id !== optimisticProject.id);
          if (process.env.NODE_ENV === 'development') logger.debug('Estado revertido após erro', { count: revertedProjects.length, context: 'ProjectContext' });
          return revertedProjects;
        });
        throw error;
      }

      logger.info('Projeto criado com sucesso no Supabase', { projectId: data.id, context: 'ProjectContext' });

      // Atualizar o projeto com os dados reais
      setProjects(prevProjects => {
        const updatedProjects = prevProjects.map(p => 
          p.id === optimisticProject.id ? { ...p, ...data } : p
        );
        if (process.env.NODE_ENV === 'development') logger.debug('Estado atualizado com dados reais', { count: updatedProjects.length, context: 'ProjectContext' });
        return updatedProjects;
      });

      toast.success('Projeto criado com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao criar projeto', { error: error.message, context: 'ProjectContext' });
      toast.error('Erro ao criar projeto: ' + error.message);
    }
  };

  const updateProject = async (id: string, project: Partial<Project>) => {
    logger.debug('Iniciando atualização do projeto', { id, project, context: 'ProjectContext' });
    
    // Salvar o estado anterior para possível reversão
    const previousProjects = projects;
    if (process.env.NODE_ENV === 'development') logger.debug('Estado anterior', { count: previousProjects.length, context: 'ProjectContext' });

    // Atualizar o estado otimisticamente
    setProjects(prevProjects => {
      const updatedProjects = prevProjects.map(p => 
        p.id === id ? { ...p, ...project, updated_at: new Date().toISOString() } : p
      );
      if (process.env.NODE_ENV === 'development') logger.debug('Estado atualizado (otimista)', { count: updatedProjects.length, context: 'ProjectContext' });
      return updatedProjects;
    });

    try {
      logger.debug('Enviando atualização para o Supabase', { projectId: id, context: 'ProjectContext' });
      const { error } = await supabase
        .from('projects')
        .update(project)
        .eq('id', id);

      if (error) {
        logger.error('Erro ao atualizar projeto no Supabase', { error, projectId: id, context: 'ProjectContext' });
        // Reverter o estado em caso de erro
        setProjects(previousProjects);
        if (process.env.NODE_ENV === 'development') logger.debug('Estado revertido após erro', { count: previousProjects.length, context: 'ProjectContext' });
        throw error;
      }

      logger.info('Projeto atualizado com sucesso no Supabase', { projectId: id, context: 'ProjectContext' });
      toast.success('Projeto atualizado com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao atualizar projeto', { error: error.message, projectId: id, context: 'ProjectContext' });
      toast.error('Erro ao atualizar projeto: ' + error.message);
    }
  };

  const deleteProject = async (id: string) => {
    logger.debug('Iniciando exclusão do projeto', { id, context: 'ProjectContext' });
    
    // Salvar o estado anterior para possível reversão
    const previousProjects = projects;
    const projectToDelete = projects.find(p => p.id === id);
    const deletedAt = new Date().toISOString();
    if (process.env.NODE_ENV === 'development') logger.debug('Estado anterior', { count: previousProjects.length, context: 'ProjectContext' });

    if (!projectToDelete) {
      logger.error('Projeto não encontrado', { projectId: id, context: 'ProjectContext' });
      toast.error('Projeto não encontrado');
      return;
    }

    // Atualizar o estado otimisticamente
    setProjects(prevProjects => {
      const updatedProjects = prevProjects.filter(p => p.id !== id);
      if (process.env.NODE_ENV === 'development') logger.debug('Estado atualizado (otimista)', { count: updatedProjects.length, context: 'ProjectContext' });
      return updatedProjects;
    });

    // Atualizar a lista de projetos deletados otimisticamente
    setDeletedProjects(prev => {
      const updatedDeletedProjects = [...prev, { ...projectToDelete, deleted_at: deletedAt }];
      if (process.env.NODE_ENV === 'development') logger.debug('Lista de projetos deletados atualizada', { count: updatedDeletedProjects.length, context: 'ProjectContext' });
      return updatedDeletedProjects;
    });

    try {
      logger.debug('Enviando exclusão para o Supabase', { projectId: id, context: 'ProjectContext' });
      const { error } = await supabase
        .from('projects')
        .update({ deleted_at: deletedAt })
        .eq('id', id);

      if (error) {
        logger.error('Erro ao excluir projeto no Supabase', { error, projectId: id, context: 'ProjectContext' });
        // Reverter o estado em caso de erro
        setProjects(previousProjects);
        setDeletedProjects(prev => prev.filter(p => p.id !== id));
        if (process.env.NODE_ENV === 'development') logger.debug('Estado revertido após erro', { context: 'ProjectContext' });
        throw error;
      }

      logger.info('Projeto excluído com sucesso no Supabase', { projectId: id, context: 'ProjectContext' });
      toast.success('Projeto movido para a lixeira!');
    } catch (error: any) {
      logger.error('Erro ao excluir projeto', { error: error.message, projectId: id, context: 'ProjectContext' });
      toast.error('Erro ao excluir projeto: ' + error.message);
    }
  };

  const restoreProject = async (id: string) => {
    logger.debug('Iniciando restauração do projeto', { id, context: 'ProjectContext' });
    
    // Salvar o estado anterior para possível reversão
    const previousProjects = projects;
    const previousDeletedProjects = deletedProjects;
    const projectToRestore = deletedProjects.find(p => p.id === id);
    
    if (process.env.NODE_ENV === 'development') logger.debug('Estado anterior', { 
      projectsCount: previousProjects.length, 
      deletedCount: previousDeletedProjects.length, 
      context: 'ProjectContext' 
    });

    if (!projectToRestore) {
      logger.error('Projeto não encontrado na lixeira', { projectId: id, context: 'ProjectContext' });
      toast.error('Projeto não encontrado na lixeira');
      return;
    }

    // Atualizar o estado otimisticamente
    setDeletedProjects(prev => {
      const updatedDeletedProjects = prev.filter(p => p.id !== id);
      if (process.env.NODE_ENV === 'development') logger.debug('Lista de projetos deletados atualizada', { count: updatedDeletedProjects.length, context: 'ProjectContext' });
      return updatedDeletedProjects;
    });

    setProjects(prev => {
      const updatedProjects = [...prev, { ...projectToRestore, deleted_at: null }];
      if (process.env.NODE_ENV === 'development') logger.debug('Lista de projetos atualizada', { count: updatedProjects.length, context: 'ProjectContext' });
      return updatedProjects;
    });

    try {
      logger.debug('Enviando restauração para o Supabase', { projectId: id, context: 'ProjectContext' });
      const { error } = await supabase
        .from('projects')
        .update({ deleted_at: null })
        .eq('id', id);

      if (error) {
        logger.error('Erro ao restaurar projeto no Supabase', { error, projectId: id, context: 'ProjectContext' });
        // Reverter o estado em caso de erro
        setProjects(previousProjects);
        setDeletedProjects(previousDeletedProjects);
        if (process.env.NODE_ENV === 'development') logger.debug('Estado revertido após erro', { context: 'ProjectContext' });
        throw error;
      }

      logger.info('Projeto restaurado com sucesso no Supabase', { projectId: id, context: 'ProjectContext' });
      toast.success('Projeto restaurado com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao restaurar projeto', { error: error.message, projectId: id, context: 'ProjectContext' });
      toast.error('Erro ao restaurar projeto: ' + error.message);
    }
  };

  const permanentlyDeleteProject = async (id: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('projects')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Projeto excluído permanentemente!');
    } catch (error: any) {
      logger.error('Erro ao excluir permanentemente projeto', { error: error.message, projectId: id, context: 'ProjectContext' });
      toast.error('Erro ao excluir permanentemente projeto: ' + error.message);
    }
  };

  const getProjectMembers = async (projectId: string) => {
    logger.debug('Buscando membros do projeto', { projectId, context: 'ProjectContext' });
    try {
      const { data, error } = await supabase
        .from('project_members')
        .select('*, profiles(*)')
        .eq('project_id', projectId);

      if (error) {
        logger.error('Erro ao buscar membros do projeto', { error, projectId, context: 'ProjectContext' });
        throw error;
      }

      logger.debug('Membros do projeto encontrados', { count: data.length, projectId, context: 'ProjectContext' });
      return data;
    } catch (error: any) {
      logger.error('Erro ao buscar membros do projeto', { error: error.message, projectId, context: 'ProjectContext' });
      toast.error('Erro ao buscar membros do projeto: ' + error.message);
      return [];
    }
  };

  const addProjectMember = async (projectIdOrMember: string | Database['public']['Tables']['project_members']['Insert'], userId?: string) => {
    // Determinar se é a nova assinatura (objeto) ou a antiga (parâmetros separados)
    let memberData: Database['public']['Tables']['project_members']['Insert'];
    
    if (typeof projectIdOrMember === 'string') {
      // Assinatura antiga: (projectId: string, userId: string)
      if (!userId) {
        throw new Error('userId é obrigatório quando projectId é uma string');
      }
      memberData = {
        project_id: projectIdOrMember,
        user_id: userId,
        role: 'member'
      };
    } else {
      // Nova assinatura: (member: ProjectMemberInsert)
      memberData = projectIdOrMember;
    }

    logger.debug('Adicionando membro ao projeto', { memberData, context: 'ProjectContext' });
    
    try {
      // Primeiro, inserir o membro sem retornar dados para evitar erro 406
      const { error: insertError } = await supabase
        .from('project_members')
        .insert(memberData, { returning: 'minimal' });

      if (insertError) {
        logger.error('Erro ao inserir membro no projeto', { error: insertError, memberData, context: 'ProjectContext' });
        throw insertError;
      }

      // Depois, buscar os dados do membro adicionado
      const { data, error: selectError } = await supabase
        .from('project_members')
        .select('*, profiles(*)')
        .eq('project_id', memberData.project_id)
        .eq('user_id', memberData.user_id)
        .single();

      if (selectError) {
        logger.error('Erro ao buscar dados do membro adicionado', { error: selectError, memberData, context: 'ProjectContext' });
        // Não falha aqui pois o membro foi adicionado com sucesso
        logger.info('Membro adicionado com sucesso ao projeto (sem dados de retorno)', { memberData, context: 'ProjectContext' });
        toast.success('Membro adicionado com sucesso!');
        return null;
      }

      logger.info('Membro adicionado com sucesso ao projeto', { memberData, context: 'ProjectContext' });
      toast.success('Membro adicionado com sucesso!');
      return data;
    } catch (error: any) {
      logger.error('Erro ao adicionar membro ao projeto', { error: error.message, memberData, context: 'ProjectContext' });
      toast.error('Erro ao adicionar membro: ' + error.message);
      return null;
    }
  };

  const removeProjectMember = async (projectId: string, userId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('project_members')
        .delete()
        .eq('project_id', projectId)
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('Membro removido com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao remover membro do projeto', { error: error.message, projectId, userId, context: 'ProjectContext' });
      toast.error('Erro ao remover membro: ' + error.message);
    }
  };

  const getProjectTasks = async (projectId: string) => {
    logger.debug('Buscando tarefas do projeto', { projectId, context: 'ProjectContext' });
    try {
      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          task_tags (id, task_id, tag_id, tags (id, name, color)),
          task_comments (id, task_id, user_id, content, created_at, profiles (id, name, avatar)),
          profiles (id, name, avatar)
        `)
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Erro ao buscar tarefas do projeto', { error, projectId, context: 'ProjectContext' });
        throw error;
      }

      logger.debug('Tarefas do projeto encontradas', { count: data.length, projectId, context: 'ProjectContext' });
      return data;
    } catch (error: any) {
      logger.error('Erro ao buscar tarefas do projeto', { error: error.message, projectId, context: 'ProjectContext' });
      toast.error('Erro ao carregar tarefas: ' + error.message);
      return [];
    }
  };

  const createTask = async (projectId: string, taskData: Partial<Task>): Promise<Task> => {
    try {
      const task: Task = {
        id: crypto.randomUUID(),
        project_id: projectId,
        title: taskData.title || '',
        description: taskData.description || null,
        status: taskData.status || 'pending',
        priority: taskData.priority || 'medium',
        due_date: taskData.due_date || null,
        assigned_to: taskData.assigned_to || null,
        created_by: user?.id || '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        deleted_at: null
      };

      const { data, error } = await supabase
        .from('tasks')
        .insert(task)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error: any) {
      logger.error('Erro ao criar tarefa', { error: error.message, projectId, context: 'ProjectContext' });
      toast.error('Erro ao criar tarefa: ' + error.message);
      throw error;
    }
  };

  const updateTask = async (taskId: string, taskData: Partial<Task>): Promise<void> => {
    try {
      const cleanTaskData: Partial<Task> = {
        ...taskData,
        updated_at: new Date().toISOString()
      };

      const { error } = await supabase
        .from('tasks')
        .update(cleanTaskData)
        .eq('id', taskId);

      if (error) throw error;
      toast.success('Tarefa atualizada com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao atualizar tarefa', { error: error.message, taskId, context: 'ProjectContext' });
      toast.error('Erro ao atualizar tarefa: ' + error.message);
      throw error;
    }
  };

  const deleteTask = async (id: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Tarefa excluída com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao excluir tarefa', { error: error.message, taskId: id, context: 'ProjectContext' });
      toast.error('Erro ao excluir tarefa: ' + error.message);
    }
  };

  const addTaskTag = async (taskId: string, tagId: string) => {
    logger.debug('Adicionando tag à tarefa', { taskId, tagId, context: 'ProjectContext' });
    try {
      const { data, error } = await supabase
        .from('task_tags')
        .insert({
          task_id: taskId,
          tag_id: tagId
        })
        .select('*, tags(*)');

      if (error) {
        logger.error('Erro ao adicionar tag à tarefa', { error, taskId, tagId, context: 'ProjectContext' });
        throw error;
      }

      logger.info('Tag adicionada com sucesso à tarefa', { taskId, tagId, context: 'ProjectContext' });
      toast.success('Tag adicionada com sucesso!');
      return data[0];
    } catch (error: any) {
      logger.error('Erro ao adicionar tag à tarefa', { error: error.message, taskId, tagId, context: 'ProjectContext' });
      toast.error('Erro ao adicionar tag: ' + error.message);
      return null;
    }
  };

  const removeTaskTag = async (taskId: string, tagId: string): Promise<void> => {
    try {
      const { error } = await supabase
        .from('task_tags')
        .delete()
        .eq('task_id', taskId)
        .eq('tag_id', tagId);

      if (error) throw error;
      toast.success('Tag removida com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao remover tag da tarefa', { error: error.message, taskId, tagId, context: 'ProjectContext' });
      toast.error('Erro ao remover tag: ' + error.message);
    }
  };

  const addComment = async (comment: Database['public']['Tables']['comments']['Insert']) => {
    logger.debug('Iniciando adição de comentário', { comment, context: 'ProjectContext' });
    try {
      const { error } = await supabase
        .from('comments')
        .insert(comment);

      if (error) {
        logger.error('Erro ao adicionar comentário no Supabase', { error, comment, context: 'ProjectContext' });
        throw error;
      }

      logger.info('Comentário adicionado com sucesso', { commentId: comment.id, context: 'ProjectContext' });
      toast.success('Comentário adicionado com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao adicionar comentário', { error: error.message, comment, context: 'ProjectContext' });
      toast.error('Erro ao adicionar comentário: ' + error.message);
    }
  };

  const updateComment = async (id: string, comment: Database['public']['Tables']['comments']['Update']) => {
    logger.debug('Iniciando atualização de comentário', { id, comment, context: 'ProjectContext' });
    try {
      const { error } = await supabase
        .from('comments')
        .update(comment)
        .eq('id', id);

      if (error) {
        logger.error('Erro ao atualizar comentário no Supabase', { error, id, comment, context: 'ProjectContext' });
        throw error;
      }

      logger.info('Comentário atualizado com sucesso', { id, context: 'ProjectContext' });
      toast.success('Comentário atualizado com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao atualizar comentário', { error: error.message, id, comment, context: 'ProjectContext' });
      toast.error('Erro ao atualizar comentário: ' + error.message);
    }
  };

  const deleteComment = async (id: string) => {
    logger.debug('Iniciando exclusão de comentário', { id, context: 'ProjectContext' });
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', id);

      if (error) {
        logger.error('Erro ao excluir comentário no Supabase', { error, id, context: 'ProjectContext' });
        throw error;
      }

      logger.info('Comentário excluído com sucesso', { id, context: 'ProjectContext' });
      toast.success('Comentário excluído com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao excluir comentário', { error: error.message, id, context: 'ProjectContext' });
      toast.error('Erro ao excluir comentário: ' + error.message);
    }
  };

  const getOverdueTasks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const { data, error } = await supabase
        .from('tasks')
        .select(`
          *,
          task_tags(tag),
          comments(*),
          projects!inner(name),
          profiles!tasks_assigned_to_fkey(name)
        `)
        .lt('due_date', new Date().toISOString())
        .neq('status', 'done')
        .eq('assigned_to', user.id)
        .order('due_date', { ascending: true });

      if (error) throw error;

      return data.map(task => ({
        ...task,
        tags: task.task_tags.map(tag => tag.tag),
        comments: task.comments,
        projectName: task.projects?.name || 'Projeto não encontrado',
        assignedToName: task.profiles?.name || 'Não atribuído'
      }));
    } catch (error: any) {
      toast.error('Erro ao carregar tarefas atrasadas: ' + error.message);
      return [];
    }
  };

  const getUpcomingTasks = async (days: number = 7) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + days);

      if (process.env.NODE_ENV === 'development') logger.debug('Buscando tarefas próximas', { context: 'ProjectContext' });
      if (process.env.NODE_ENV === 'development') logger.debug('Período de busca', { 
        dataInicial: today.toISOString(), 
        dataFinal: endDate.toISOString(),
        context: 'ProjectContext'
      });

      const { data: tasks, error } = await supabase
        .from('tasks')
        .select(`
          *,
          task_tags(tag),
          comments(*),
          projects!inner(name),
          profiles!tasks_assigned_to_fkey(name)
        `)
        .gte('due_date', today.toISOString())
        .lte('due_date', endDate.toISOString())
        .neq('status', 'done')
        .eq('assigned_to', user.id)
        .order('due_date', { ascending: true });

      if (error) {
        logger.error('Erro detalhado', { error, context: 'ProjectContext' });
        throw error;
      }

      if (process.env.NODE_ENV === 'development') logger.debug('Tarefas encontradas', { count: tasks?.length || 0, context: 'ProjectContext' });

      return tasks.map(task => ({
        ...task,
        tags: task.task_tags?.map(tag => tag.tag) || [],
        comments: task.comments || [],
        projectName: task.projects?.name || 'Projeto não encontrado',
        assignedToName: task.profiles?.name || 'Não atribuído'
      }));
    } catch (error) {
      logger.error('Erro ao buscar tarefas próximas', { error, context: 'ProjectContext' });
      return [];
    }
  };

  const clearTrash = async () => {
    try {
      if (process.env.NODE_ENV === 'development') logger.debug('Iniciando limpeza da lixeira', { context: 'ProjectContext' });
      if (process.env.NODE_ENV === 'development') logger.debug('Projetos na lixeira', { count: deletedProjects.length, context: 'ProjectContext' });

      // Primeiro, vamos verificar se existem projetos para excluir
      const { data: projectsToDelete, error: checkError } = await supabase
        .from('projects')
        .select('id')
        .not('deleted_at', 'is', null);

      if (checkError) {
        logger.error('Erro ao verificar projetos na lixeira', { error: checkError, context: 'ProjectContext' });
        throw checkError;
      }

      if (process.env.NODE_ENV === 'development') logger.debug('Projetos encontrados para exclusão', { count: projectsToDelete?.length || 0, context: 'ProjectContext' });

      if (!projectsToDelete || projectsToDelete.length === 0) {
        if (process.env.NODE_ENV === 'development') logger.debug('Nenhum projeto encontrado para excluir', { context: 'ProjectContext' });
        toast.success('Lixeira já está vazia!');
        return;
      }

      // Agora vamos excluir os projetos
      const { error: deleteError } = await supabase
        .from('projects')
        .delete()
        .not('deleted_at', 'is', null);

      if (deleteError) {
        logger.error('Erro ao excluir projetos', { error: deleteError, context: 'ProjectContext' });
        throw deleteError;
      }

      logger.info('Projetos excluídos com sucesso', { context: 'ProjectContext' });
      await getProjects();
      toast.success('Lixeira limpa com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao limpar lixeira', { error, context: 'ProjectContext' });
      toast.error('Erro ao limpar lixeira: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const refreshProjects = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProjects(data || []);
      logger.info('Projetos atualizados com sucesso', { count: data?.length, context: 'Project' });
    } catch (error) {
      logger.error('Erro ao atualizar projetos', { error, context: 'Project' });
      setError('Erro ao carregar projetos');
    } finally {
      setLoading(false);
    }
  };

  // Função para refresh discreto
  const handleDiscreteRefresh = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    
    try {
      logger.debug('Iniciando refresh discreto dos projetos', { context: 'ProjectContext' });
      
      // Simula um refresh muito rápido e discreto
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Invalida queries relacionadas a projetos
      await queryClient.invalidateQueries({ queryKey: ['projects'] });
      await queryClient.invalidateQueries({ queryKey: ['tasks'] });
      
      logger.info('Refresh discreto dos projetos concluído', { context: 'ProjectContext' });
    } catch (error) {
      logger.error('Erro no refresh discreto dos projetos', { error, context: 'ProjectContext' });
    } finally {
      setIsRefreshing(false);
    }
  };

  // Hook para detectar quando usuário volta para a página
  usePageVisibility({
    onPageVisible: handleDiscreteRefresh,
    debounceMs: 1500 // Espera 1.5s após voltar
  });

  useEffect(() => {
    getProjects();
  }, [getProjects]);

  const getTaskChecklists = async (taskId: string) => {
    logger.debug('Iniciando busca de checklists da tarefa', { 
      taskId, 
      timestamp: new Date().toISOString(),
      context: 'ProjectContext' 
    });
    
    if (!taskId) {
      logger.error('taskId inválido', { 
        taskId, 
        timestamp: new Date().toISOString(),
        context: 'ProjectContext' 
      });
      throw new Error('ID da tarefa inválido');
    }

    try {
      // Verificar conexão com o Supabase
      const isConnected = await checkSupabaseConnection();
      logger.debug('Status da conexão com Supabase', { 
        isConnected, 
        taskId,
        timestamp: new Date().toISOString(),
        context: 'ProjectContext' 
      });

      if (!isConnected) {
        logger.error('Sem conexão com o Supabase', { 
          taskId, 
          timestamp: new Date().toISOString(),
          context: 'ProjectContext' 
        });
        throw new Error('Sem conexão com o banco de dados');
      }

      logger.debug('Iniciando query no Supabase', { 
        taskId,
        timestamp: new Date().toISOString(),
        context: 'ProjectContext' 
      });

      const { data, error } = await supabase
        .from('checklists')
        .select(`
          *,
          checklist_items(*)
        `)
        .eq('task_id', taskId)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Erro ao buscar checklists da tarefa', { 
          error: error.message,
          code: error.code,
          details: error.details,
          taskId,
          timestamp: new Date().toISOString(),
          context: 'ProjectContext'
        });
        throw new Error(`Erro ao buscar checklists: ${error.message}`);
      }

      if (!data) {
        logger.debug('Nenhum checklist encontrado', { 
          taskId, 
          timestamp: new Date().toISOString(),
          context: 'ProjectContext' 
        });
        return [];
      }

      logger.debug('Checklists encontrados com sucesso', { 
        count: data.length,
        taskId,
        timestamp: new Date().toISOString(),
        context: 'ProjectContext'
      });

      const checklists = data.map(checklist => ({
        ...checklist,
        items: checklist.checklist_items?.filter(item => !item.deleted_at) || []
      }));

      logger.debug('Checklists processados', { 
        count: checklists.length,
        itemsCount: checklists.reduce((acc, curr) => acc + curr.items.length, 0),
        taskId,
        timestamp: new Date().toISOString(),
        context: 'ProjectContext'
      });

      return checklists;
    } catch (error: any) {
      logger.error('Erro ao buscar checklists da tarefa', { 
        error: error.message, 
        taskId, 
        timestamp: new Date().toISOString(),
        context: 'ProjectContext' 
      });
      toast.error('Erro ao carregar checklists: ' + error.message);
      return [];
    }
  };

  const createChecklist = async (data: CreateChecklistData) => {
    logger.debug('Iniciando criação de checklist', { 
      data, 
      userId: user?.id,
      timestamp: new Date().toISOString(),
      context: 'ProjectContext' 
    });

    try {
      // Verificar conexão com o Supabase
      const isConnected = await checkSupabaseConnection();
      logger.debug('Status da conexão com Supabase', { 
        isConnected, 
        timestamp: new Date().toISOString(),
        context: 'ProjectContext' 
      });

      if (!isConnected) {
        logger.error('Sem conexão com o Supabase', { 
          timestamp: new Date().toISOString(),
          context: 'ProjectContext' 
        });
        throw new Error('Sem conexão com o banco de dados');
      }

      logger.debug('Iniciando inserção no Supabase', { 
        data,
        timestamp: new Date().toISOString(),
        context: 'ProjectContext' 
      });

      const { data: checklist, error } = await supabase
        .from('checklists')
        .insert({
          ...data,
          created_by: user?.id
        })
        .select()
        .single();

      if (error) {
        logger.error('Erro ao criar checklist', { 
          error: error.message,
          code: error.code,
          details: error.details,
          data,
          timestamp: new Date().toISOString(),
          context: 'ProjectContext' 
        });
        throw error;
      }

      logger.info('Checklist criado com sucesso', { 
        checklistId: checklist.id,
        taskId: data.task_id,
        timestamp: new Date().toISOString(),
        context: 'ProjectContext' 
      });
      toast.success('Checklist criado com sucesso!');
      return checklist;
    } catch (error: any) {
      logger.error('Erro ao criar checklist', { 
        error: error.message,
        data,
        timestamp: new Date().toISOString(),
        context: 'ProjectContext' 
      });
      toast.error('Erro ao criar checklist: ' + error.message);
      throw error;
    }
  };

  const updateChecklist = async (id: string, title: string) => {
    logger.debug('Atualizando checklist', { id, title, context: 'ProjectContext' });
    try {
      const { error } = await supabase
        .from('checklists')
        .update({ title })
        .eq('id', id);

      if (error) {
        logger.error('Erro ao atualizar checklist', { error, id, context: 'ProjectContext' });
        throw error;
      }

      logger.info('Checklist atualizado com sucesso', { id, context: 'ProjectContext' });
      toast.success('Checklist atualizado com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao atualizar checklist', { error: error.message, id, context: 'ProjectContext' });
      toast.error('Erro ao atualizar checklist: ' + error.message);
      throw error;
    }
  };

  const deleteChecklist = async (id: string) => {
    logger.debug('Excluindo checklist', { id, context: 'ProjectContext' });
    try {
      const { error } = await supabase
        .from('checklists')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        logger.error('Erro ao excluir checklist', { error, id, context: 'ProjectContext' });
        throw error;
      }

      logger.info('Checklist excluído com sucesso', { id, context: 'ProjectContext' });
      toast.success('Checklist excluído com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao excluir checklist', { error: error.message, id, context: 'ProjectContext' });
      toast.error('Erro ao excluir checklist: ' + error.message);
      throw error;
    }
  };

  const createChecklistItem = async (data: CreateChecklistItemData) => {
    logger.debug('Criando item do checklist', { data, context: 'ProjectContext' });
    try {
      const { data: item, error } = await supabase
        .from('checklist_items')
        .insert(data)
        .select()
        .single();

      if (error) {
        logger.error('Erro ao criar item do checklist', { error, data, context: 'ProjectContext' });
        throw error;
      }

      logger.info('Item do checklist criado com sucesso', { itemId: item.id, context: 'ProjectContext' });
      toast.success('Item adicionado com sucesso!');
      return item;
    } catch (error: any) {
      logger.error('Erro ao criar item do checklist', { error: error.message, data, context: 'ProjectContext' });
      toast.error('Erro ao adicionar item: ' + error.message);
      throw error;
    }
  };

  const updateChecklistItem = async (id: string, data: UpdateChecklistItemData) => {
    logger.debug('Atualizando item do checklist', { id, data, context: 'ProjectContext' });
    try {
      const updateData = {
        ...data,
        completed_at: data.completed ? new Date().toISOString() : null
      };

      const { error } = await supabase
        .from('checklist_items')
        .update(updateData)
        .eq('id', id);

      if (error) {
        logger.error('Erro ao atualizar item do checklist', { error, id, context: 'ProjectContext' });
        throw error;
      }

      logger.info('Item do checklist atualizado com sucesso', { id, context: 'ProjectContext' });
      toast.success('Item atualizado com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao atualizar item do checklist', { error: error.message, id, context: 'ProjectContext' });
      toast.error('Erro ao atualizar item: ' + error.message);
      throw error;
    }
  };

  const deleteChecklistItem = async (id: string) => {
    logger.debug('Excluindo item do checklist', { id, context: 'ProjectContext' });
    try {
      const { error } = await supabase
        .from('checklist_items')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        logger.error('Erro ao excluir item do checklist', { error, id, context: 'ProjectContext' });
        throw error;
      }

      logger.info('Item do checklist excluído com sucesso', { id, context: 'ProjectContext' });
      toast.success('Item excluído com sucesso!');
    } catch (error: any) {
      logger.error('Erro ao excluir item do checklist', { error: error.message, id, context: 'ProjectContext' });
      toast.error('Erro ao excluir item: ' + error.message);
      throw error;
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        projects,
        deletedProjects,
        loading,
        error,
        getProjects,
        getProject,
        createProject,
        updateProject,
        deleteProject,
        restoreProject,
        permanentlyDeleteProject,
        clearTrash,
        getProjectMembers,
        addProjectMember,
        removeProjectMember,
        getProjectTasks,
        createTask,
        updateTask,
        deleteTask,
        addTaskTag,
        removeTaskTag,
        addComment,
        updateComment,
        deleteComment,
        getOverdueTasks,
        getUpcomingTasks,
        refreshProjects,
        getTaskChecklists,
        createChecklist,
        updateChecklist,
        deleteChecklist,
        createChecklistItem,
        updateChecklistItem,
        deleteChecklistItem,
      }}
    >
      {isRefreshing && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-md text-sm opacity-75 z-50">
          Atualizando projetos...
        </div>
      )}
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject deve ser usado dentro de um ProjectProvider');
  }
  return context;
}

