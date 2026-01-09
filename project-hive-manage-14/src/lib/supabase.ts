import { createClient } from '@supabase/supabase-js';
import { Database } from '../types/supabase';
import { logger } from './logger';

// Configurações de conexão robusta
export const CONNECTION_CONFIG = {
  MIN_REFRESH_INTERVAL: 60000, // 1 minuto entre refreshes de token
  MAX_RETRIES: 5, // Número máximo de tentativas de retry
  RETRY_DELAY: 1000, // Delay base para retry (ms)
  RECONNECT_COOLDOWN: 2000, // Cooldown entre tentativas de reconexão (ms)
  CONNECTION_TIMEOUT: 15000, // Timeout para operações de conexão (ms)
  HEARTBEAT_INTERVAL: 30000, // Intervalo para heartbeat do realtime (ms)
  CIRCUIT_BREAKER_THRESHOLD: 5, // Número de falhas para abrir o circuit breaker
  CIRCUIT_BREAKER_TIMEOUT: 60000 // Tempo para resetar o circuit breaker (ms) - aumentado para 60s
};

// Circuit Breaker para controle de falhas
class CircuitBreaker {
  private _isOpen = false;
  private failureCount = 0;
  private lastFailureTime = 0;

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this._isOpen) {
      const now = Date.now();
      const timeSinceLastFailure = now - this.lastFailureTime;
      
      if (timeSinceLastFailure > CONNECTION_CONFIG.CIRCUIT_BREAKER_TIMEOUT) {
        // Resetar o circuit breaker após o timeout
        this._isOpen = false;
        this.failureCount = 0;
        logger.info('Circuit breaker fechado, tentando novamente', { 
          context: 'CircuitBreaker',
          timeSinceLastFailure 
        });
      } else {
        // Log quando o circuit breaker ainda está aberto
        logger.debug('Circuit breaker ainda aberto', {
          context: 'CircuitBreaker',
          timeRemaining: CONNECTION_CONFIG.CIRCUIT_BREAKER_TIMEOUT - timeSinceLastFailure,
          failureCount: this.failureCount
        });
        throw new Error('Circuit breaker aberto - muitas falhas consecutivas');
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess() {
     this.failureCount = 0;
     this._isOpen = false;
   }

   private onFailure() {
     this.failureCount++;
     this.lastFailureTime = Date.now();
     
     if (this.failureCount >= CONNECTION_CONFIG.CIRCUIT_BREAKER_THRESHOLD) {
       this._isOpen = true;
       logger.warn('Circuit breaker aberto devido a muitas falhas', {
         context: 'CircuitBreaker',
         failureCount: this.failureCount
       });
       
       // Atualizar connectionState quando o circuit breaker abrir
       connectionState.isCircuitOpen = true;
     }
   }

  isOpen(): boolean {
    return this._isOpen;
  }

  reset() {
    this._isOpen = false;
    this.failureCount = 0;
    this.lastFailureTime = 0;
    connectionState.isCircuitOpen = false;
    logger.info('Circuit breaker resetado manualmente', { context: 'CircuitBreaker' });
  }
}

// Interface para controle de estado da conexão
export interface ConnectionState {
  isRefreshing: boolean;
  lastTokenRefresh: number;
  isReconnecting: boolean;
  reconnectPromise: Promise<boolean> | null;
  lastReconnectAttempt: number;
  failureCount: number;
  lastFailureTime: number;
  isCircuitOpen: boolean;
  connectionQuality: 'good' | 'poor' | 'bad';
  circuitBreaker: CircuitBreaker;
}

// Estado global da conexão
export const connectionState: ConnectionState = {
  isRefreshing: false,
  lastTokenRefresh: 0,
  isReconnecting: false,
  reconnectPromise: null,
  lastReconnectAttempt: 0,
  failureCount: 0,
  lastFailureTime: 0,
  isCircuitOpen: false,
  connectionQuality: 'good'
};

// Obter variáveis de ambiente
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Remover logs sensíveis mesmo em desenvolvimento
if (!supabaseUrl || !supabaseAnonKey) {
  logger.error('[Supabase] Variáveis de ambiente ausentes', {
    url: supabaseUrl ? 'Presente' : 'Ausente',
    key: supabaseAnonKey ? 'Presente' : 'Ausente'
  });
  throw new Error('Supabase URL and Anon Key são obrigatórios');
}

// Configuração já declarada no início do arquivo

const circuitBreaker = new CircuitBreaker();

// Atualizar connectionState para incluir circuitBreaker
connectionState.circuitBreaker = circuitBreaker;

// Storage seguro com validação
const secureStorage = {
  getItem: (key: string) => {
    try {
      const value = localStorage.getItem(key);
      if (!value) return null;
      
      const parsed = JSON.parse(value);
      const now = Date.now();
      
      // Verificar se o token está próximo de expirar (5 minutos)
      if (parsed.expires_at && parsed.expires_at - now < 300000) {
        // Verificar se já passou tempo suficiente desde o último refresh
        if (!connectionState.isRefreshing && now - connectionState.lastTokenRefresh > CONNECTION_CONFIG.MIN_REFRESH_INTERVAL) {
          connectionState.isRefreshing = true;
          connectionState.lastTokenRefresh = now;
          
          // Refresh assíncrono sem bloquear
          refreshTokenAsync();
        }
      }
      return value;
    } catch (error) {
      logger.error('Erro ao recuperar token do storage:', error, { context: 'SecureStorage' });
      return null;
    }
  },
  setItem: (key: string, value: string) => {
    try {
      localStorage.setItem(key, value);
    } catch (error) {
      logger.error('Erro ao salvar no storage:', error, { context: 'SecureStorage' });
    }
  },
  removeItem: (key: string) => {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      logger.error('Erro ao remover do storage:', error, { context: 'SecureStorage' });
    }
  }
};

// Função para refresh assíncrono de token
async function refreshTokenAsync() {
  try {
    await circuitBreaker.execute(async () => {
      const { error } = await supabase.auth.refreshSession();
      if (error) throw error;
    });
    logger.info('Token atualizado com sucesso', { context: 'Auth' });
  } catch (error) {
    logger.error('Erro ao atualizar token:', error, { context: 'Auth' });
  } finally {
    connectionState.isRefreshing = false;
  }
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'impacto-auth',
    storage: secureStorage
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    },
    timeout: CONNECTION_CONFIG.CONNECTION_TIMEOUT,
    heartbeatIntervalMs: CONNECTION_CONFIG.HEARTBEAT_INTERVAL
  },
  global: {
    headers: {
      'X-Client-Info': 'impacto-gestao'
    }
  }
});

// Função para verificar a conexão com o Supabase
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    return await circuitBreaker.execute(async () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONNECTION_CONFIG.CONNECTION_TIMEOUT);
      
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id')
          .limit(1);
          
        clearTimeout(timeoutId);
        
        if (error) {
          logger.error('Erro na conexão com Supabase:', error, { context: 'Connection' });
          return false;
        }
        
        connectionState.connectionQuality = 'good';
        return true;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    });
  } catch (error) {
    logger.error('Erro ao verificar conexão:', error, { context: 'Connection' });
    connectionState.connectionQuality = 'bad';
    return false;
  }
}

// Função para reconectar ao Supabase com retry inteligente
export async function reconnectSupabase(): Promise<boolean> {
  // Evitar múltiplas tentativas de reconexão simultâneas
  if (connectionState.isReconnecting) {
    return connectionState.reconnectPromise || Promise.resolve(false);
  }

  // Verificar cooldown
  const now = Date.now();
  const RECONNECT_COOLDOWN = 2000; // 2 segundos entre tentativas
  if (now - connectionState.lastReconnectAttempt < RECONNECT_COOLDOWN) {
    logger.info('Aguardando cooldown para reconexão', { 
      remainingTime: RECONNECT_COOLDOWN - (now - connectionState.lastReconnectAttempt),
      context: 'Connection' 
    });
    return false;
  }

  // Verificar se circuit breaker está aberto
  if (connectionState.isCircuitOpen) {
    logger.warn('Circuit breaker aberto, não tentando reconexão', { context: 'Connection' });
    return false;
  }

  connectionState.isReconnecting = true;
  connectionState.lastReconnectAttempt = now;

  connectionState.reconnectPromise = (async () => {
    let retryCount = 0;
    const maxRetries = CONNECTION_CONFIG.MAX_RETRIES;
    
    while (retryCount < maxRetries) {
      try {
        logger.info(`Tentativa de reconexão ${retryCount + 1}/${maxRetries}`, { context: 'Connection' });
        
        // Tentar refresh da sessão primeiro
        await circuitBreaker.execute(async () => {
          const { error: refreshError } = await supabase.auth.refreshSession();
          if (refreshError) {
            throw new Error(`Erro no refresh da sessão: ${refreshError.message}`);
          }
        });

        // Verificar se a conexão está funcionando
        const isConnected = await checkSupabaseConnection();
        
        if (isConnected) {
          logger.info('Reconexão bem-sucedida', { 
            attempts: retryCount + 1,
            context: 'Connection' 
          });
          connectionState.connectionQuality = 'good';
          return true;
        }
        
        throw new Error('Falha na verificação de conexão');
        
      } catch (error) {
        retryCount++;
        logger.error(`Falha na tentativa ${retryCount}:`, error, { context: 'Connection' });
        
        if (retryCount < maxRetries) {
          // Backoff exponencial com jitter
          const baseDelay = CONNECTION_CONFIG.RETRY_DELAY * Math.pow(2, retryCount - 1);
          const jitter = Math.random() * 1000; // Adicionar até 1s de jitter
          const delay = Math.min(baseDelay + jitter, 30000); // Máximo 30s
          
          logger.info(`Aguardando ${Math.round(delay)}ms antes da próxima tentativa`, { context: 'Connection' });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    logger.error('Todas as tentativas de reconexão falharam', { 
      totalAttempts: maxRetries,
      context: 'Connection' 
    });
    connectionState.connectionQuality = 'bad';
    return false;
    
  })().finally(() => {
    connectionState.isReconnecting = false;
    connectionState.reconnectPromise = null;
  });

  return connectionState.reconnectPromise;
}

// Função para executar operações com retry e circuit breaker
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = CONNECTION_CONFIG.MAX_RETRIES,
  delay: number = CONNECTION_CONFIG.RETRY_DELAY,
  useCircuitBreaker: boolean = true
): Promise<T> {
  const executeOperation = useCircuitBreaker 
    ? () => circuitBreaker.execute(operation)
    : operation;
    
  let lastError: Error;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const result = await executeOperation();
      
      // Se chegou até aqui, a operação foi bem-sucedida
      if (attempt > 1) {
        logger.info(`Operação bem-sucedida na tentativa ${attempt}`, { context: 'Retry' });
      }
      
      return result;
    } catch (error) {
      lastError = error as Error;
      
      // Se é erro de circuit breaker aberto, não tentar novamente
      if (lastError.message.includes('Circuit breaker aberto')) {
        logger.warn('Circuit breaker aberto, interrompendo tentativas', { context: 'Retry' });
        throw lastError;
      }
      
      logger.warn(`Tentativa ${attempt}/${maxRetries} falhou:`, error, { 
        context: 'Retry',
        connectionQuality: connectionState.connectionQuality
      });
      
      if (attempt === maxRetries) {
        break;
      }
      
      // Backoff exponencial com jitter
      const baseDelay = delay * Math.pow(2, attempt - 1);
      const jitter = Math.random() * 500; // Até 500ms de jitter
      const backoffDelay = Math.min(baseDelay + jitter, 30000); // Máximo 30s
      
      logger.info(`Aguardando ${Math.round(backoffDelay)}ms antes da próxima tentativa`, { 
        context: 'Retry',
        attempt,
        maxRetries
      });
      
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  logger.error(`Operação falhou após ${maxRetries} tentativas`, lastError, { 
    context: 'Retry',
    connectionQuality: connectionState.connectionQuality,
    isCircuitOpen: connectionState.isCircuitOpen
  });
  
  throw lastError;
}

// Exporta funções auxiliares
export const supabaseHelpers = {
  checkConnection: checkSupabaseConnection,
  reconnect: reconnectSupabase,
  withRetry
};

// Funções auxiliares para trabalhar com o Supabase
export const getProfile = async (userId: string) => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
};

export const getUserProjects = async (userId: string) => {
  const { data, error } = await supabase
    .from('projects')
    .select(`
      *,
      project_members!inner(user_id)
    `)
    .eq('project_members.user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data;
};

export const createProject = async (project: Database['public']['Tables']['projects']['Insert']) => {
  const { data, error } = await supabase
    .from('projects')
    .insert(project)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateProject = async (id: string, project: Database['public']['Tables']['projects']['Update']) => {
  const { data, error } = await supabase
    .from('projects')
    .update(project)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteProject = async (id: string) => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const getProjectMembers = async (projectId: string) => {
  const { data, error } = await supabase
    .from('project_members')
    .select(`
      *,
      profiles(*)
    `)
    .eq('project_id', projectId);

  if (error) throw error;
  return data;
};

export const addProjectMember = async (member: Database['public']['Tables']['project_members']['Insert']) => {
  // Inserir sem retornar dados para evitar erro 406 com políticas RLS
  const { error: insertError } = await supabase
    .from('project_members')
    .insert(member, { returning: 'minimal' });

  if (insertError) throw insertError;

  // Buscar os dados inseridos separadamente
  const { data, error: selectError } = await supabase
    .from('project_members')
    .select('*, profiles(*)')
    .eq('project_id', member.project_id)
    .eq('user_id', member.user_id)
    .single();

  if (selectError) {
    // Se não conseguir buscar os dados, retorna um objeto básico
    return {
      project_id: member.project_id,
      user_id: member.user_id,
      role: member.role,
      created_at: new Date().toISOString()
    };
  }

  return data;
};

export const removeProjectMember = async (projectId: string, userId: string) => {
  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId);

  if (error) throw error;
};

export const getProjectTasks = async (projectId: string) => {
  const { data, error } = await supabase
    .from('tasks')
    .select(`
      *,
      task_tags(tag),
      comments(*)
    `)
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data.map(task => ({
    ...task,
    tags: task.task_tags.map(tag => tag.tag)
  }));
};

export const createTask = async (task: Database['public']['Tables']['tasks']['Insert']) => {
  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateTask = async (id: string, task: Database['public']['Tables']['tasks']['Update']) => {
  const { data, error } = await supabase
    .from('tasks')
    .update(task)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteTask = async (id: string) => {
  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const addTaskTag = async (tag: Database['public']['Tables']['task_tags']['Insert']) => {
  const { data, error } = await supabase
    .from('task_tags')
    .insert(tag)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const removeTaskTag = async (taskId: string, tag: string) => {
  const { error } = await supabase
    .from('task_tags')
    .delete()
    .eq('task_id', taskId)
    .eq('tag', tag);

  if (error) throw error;
};

export const addComment = async (comment: {
  content: string;
  task_id: string;
  project_id: string;
  created_by: string;
  created_at: string;
}) => {
  const { data, error } = await supabase
    .from('comments')
    .insert([comment])
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateComment = async (id: string, comment: Database['public']['Tables']['comments']['Update']) => {
  const { data, error } = await supabase
    .from('comments')
    .update(comment)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteComment = async (id: string) => {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const getCalendarEvents = async (userId: string) => {
  const { data, error } = await supabase
    .from('calendar_events')
    .select('*')
    .eq('created_by', userId)
    .order('start_time', { ascending: true });

  if (error) throw error;
  return data;
};

export const createCalendarEvent = async (event: Database['public']['Tables']['calendar_events']['Insert']) => {
  const { data, error } = await supabase
    .from('calendar_events')
    .insert(event)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const updateCalendarEvent = async (id: string, event: Database['public']['Tables']['calendar_events']['Update']) => {
  const { data, error } = await supabase
    .from('calendar_events')
    .update(event)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
};

export const deleteCalendarEvent = async (id: string) => {
  const { error } = await supabase
    .from('calendar_events')
    .delete()
    .eq('id', id);

  if (error) throw error;
};

export const clearTrash = async () => {
  const { error } = await supabase
    .from('projects')
    .delete()
    .not('deleted_at', 'is', null);

  if (error) throw error;
};

// Alias para compatibilidade com importações existentes
export const reconnectToSupabase = reconnectSupabase;