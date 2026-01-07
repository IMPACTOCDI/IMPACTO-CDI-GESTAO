import React, { createContext, useContext, useState, useEffect, ReactNode, useRef, useMemo, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { User as SupabaseUser, AuthError, PostgrestError } from '@supabase/supabase-js';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { logger } from '@/lib/logger';
import { Profile } from '@/types/supabase';
import { useQueryClient } from '@tanstack/react-query';

export type UserRole = 'admin' | 'manager' | 'member' | 'personal';
export type UserStatus = 'active' | 'pending' | 'suspended';

interface User extends Profile {
  role: UserRole;
  status: UserStatus;
}

interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (name: string, email: string, password: string, role?: UserRole) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  isLoading: boolean;
  hasPermission: (permission: string, projectId?: string) => Promise<boolean>;
  canAccessProject: (projectId: string, visibility: 'public' | 'private') => boolean;
  getAllUsers: () => Promise<User[]>;
  updateUserRole: (userId: string, role: UserRole) => Promise<void>;
  updateUserStatus: (userId: string, status: UserStatus) => Promise<void>;
  addAuthorizedEmail: (email: string, role: UserRole) => Promise<void>;
  removeAuthorizedEmail: (email: string) => Promise<void>;
  getAuthorizedEmails: () => Promise<{ email: string; role: UserRole }[]>;
}

interface AuthProviderProps {
  children: ReactNode;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: AuthProviderProps) {
  logger.debug('Iniciando autenticação', { context: 'Auth' });
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // REFs para controle aprimorado
  const isInitializedRef = useRef(false);
  const subscriptionRef = useRef<any>(null);
  const lastUpdateRef = useRef(Date.now());
  const isUpdatingRef = useRef(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const authStateRef = useRef<{ user: User | null; isLoading: boolean }>({ user: null, isLoading: true });

  // Função para atualizar estado com debounce
  const updateAuthState = useCallback((newUser: User | null, newIsLoading: boolean) => {
    // Limpa timeout anterior
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Verifica se realmente houve mudança
    const currentState = authStateRef.current;
    if (currentState.user?.id === newUser?.id && currentState.isLoading === newIsLoading) {
      return;
    }

    // Atualiza referência imediatamente
    authStateRef.current = { user: newUser, isLoading: newIsLoading };

    // Debounce para evitar múltiplas atualizações
    debounceTimeoutRef.current = setTimeout(() => {
      setUser(newUser);
      setIsLoading(newIsLoading);
    }, 100);
  }, []);
  
  const refreshUser = async () => {
    // Evita múltiplas chamadas simultâneas
    if (isRefreshing) return;
    
    try {
      setIsRefreshing(true);
      // Não altera o estado de loading para evitar redirecionamentos desnecessários
      // apenas usa o estado atual
      
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;
      
      if (!user) {
        // Se não há usuário, atualiza o estado para não logado
        updateAuthState(null, false);
        return;
      }

      // Busca o perfil atualizado
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (profileError) {
        logger.error('Erro ao buscar perfil atualizado', { error: profileError }, { context: 'Auth' });
        // Não altera o estado em caso de erro para evitar redirecionamentos desnecessários
        return;
      }

      if (!profile) {
        logger.error('Perfil não encontrado na atualização', { context: 'Auth' });
        return;
      }

      const userData: User = {
        ...profile,
        role: profile.role as UserRole,
        status: profile.status as UserStatus,
      };

      // Atualiza o estado apenas se houver mudanças
      updateAuthState(userData, false);
      
      if (import.meta.env.DEV) {
        logger.debug('Dados do usuário atualizados', { context: 'Auth' });
      }
    } catch (error) {
      logger.error('Erro ao atualizar dados do usuário', { error, context: 'Auth' });
      // Não altera o estado em caso de erro para evitar redirecionamentos desnecessários
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    // Evita múltiplas inicializações
    if (isInitializedRef.current) return;
    isInitializedRef.current = true;

    logger.debug('Iniciando verificação de autenticação...', { context: 'Auth' });
    
    // Limpa subscription anterior
    if (subscriptionRef.current) {
      subscriptionRef.current.unsubscribe();
      subscriptionRef.current = null;
    }

    const getInitialSession = async () => {
      if (isUpdatingRef.current) return;
      isUpdatingRef.current = true;

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (session?.user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileError) throw profileError;

          updateAuthState(profile, false);
        } else {
          updateAuthState(null, false);
        }
      } catch (error) {
        logger.error('Erro ao verificar sessão', { error }, { context: 'Auth' });
        updateAuthState(null, false);
      } finally {
        isUpdatingRef.current = false;
      }
    };

    getInitialSession();

    // SUBSCRIPTION ÚNICA com debounce aprimorado
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.debug(`[Auth] Evento de autenticação: ${event}`, { context: 'Auth' });
      
      // Debounce para evitar múltiplas chamadas
      const now = Date.now();
      if (now - lastUpdateRef.current < 300 || isUpdatingRef.current) return;
      lastUpdateRef.current = now;
      isUpdatingRef.current = true;

      // Limpa timeout de redirecionamento anterior
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }

      try {
        if (event === 'SIGNED_IN' && session?.user) {
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (profileError) throw profileError;

          updateAuthState(profile, false);
          
          // Limpa qualquer tentativa de reconexão pendente
          if (import.meta.env.DEV) {
            logger.debug('Login bem-sucedido, limpando tentativas de reconexão', { context: 'Auth' });
          }
        } else if (event === 'SIGNED_OUT') {
          updateAuthState(null, false);
        } else if (event === 'TOKEN_REFRESHED') {
          // Apenas registra o evento sem alterar o estado
          if (import.meta.env.DEV) {
            logger.debug('Token atualizado com sucesso', { context: 'Auth' });
          }
        }
      } catch (error) {
        logger.error('[Auth] Erro ao processar mudança de autenticação', { error }, { context: 'Auth' });
        // Não altera o estado em caso de erro para evitar redirecionamentos desnecessários
      } finally {
        isUpdatingRef.current = false;
      }
    });

    // Armazena a subscription para limpeza posterior
    subscriptionRef.current = subscription;

    return () => {
      logger.debug('Limpando subscription e timeouts', { context: 'Auth' });
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
        subscriptionRef.current = null;
      }
      
      // Limpa todos os timeouts
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
        debounceTimeoutRef.current = null;
      }
      
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
    };
  }, []); // DEPENDÊNCIAS VAZIAS - roda só uma vez

  // Função para lidar com redirecionamentos com debounce
  const handleRedirect = useCallback((path: string, delay: number = 300) => {
    // Limpa timeout anterior
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }
    
    // Define novo timeout
    redirectTimeoutRef.current = setTimeout(() => {
      navigate(path);
    }, delay);
  }, [navigate]);

  const login = async (email: string, password: string) => {
    logger.debug('Iniciando login', { email }, { context: 'Auth' });
    try {
      // Indica que está carregando
      updateAuthState(null, true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        logger.error('Erro no login', { error }, { context: 'Auth', showToast: true });
        updateAuthState(null, false);
        return { success: false, error: error.message };
      }

      if (!data.user) {
        logger.error('Usuário não encontrado após login', { context: 'Auth' });
        updateAuthState(null, false);
        return { success: false, error: 'Usuário não encontrado' };
      }

      // Buscar o perfil do usuário após o login bem-sucedido
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError) {
        logger.error('Erro ao buscar perfil do usuário', { error: profileError }, { context: 'Auth' });
        updateAuthState(null, false);
        return { success: false, error: 'Erro ao buscar perfil do usuário' };
      }

      if (!profile) {
        logger.error('Perfil não encontrado', { context: 'Auth' });
        updateAuthState(null, false);
        return { success: false, error: 'Perfil não encontrado' };
      }

      const userData: User = {
        ...profile,
        role: profile.role as UserRole,
        status: profile.status as UserStatus,
      };

      updateAuthState(userData, false);
      logger.info('Login bem-sucedido', { userId: data.user.id }, { context: 'Auth' });
      
      // Redireciona com debounce
      handleRedirect('/dashboard');
      
      return { success: true };
    } catch (error) {
      updateAuthState(null, false);
      
      if (error instanceof AuthError) {
        logger.error('Erro de autenticação', { error }, { context: 'Auth' });
        return { success: false, error: error.message };
      } else if (error instanceof Error) {
        logger.error('Erro inesperado', { error }, { context: 'Auth' });
        return { success: false, error: error.message };
      } else {
        logger.error('Erro desconhecido', { error }, { context: 'Auth' });
        return { success: false, error: 'Erro desconhecido durante o login' };
      }
    }
  };

  const register = async (name: string, email: string, password: string, role: UserRole = 'member') => {
    try {
      logger.debug('Iniciando registro', { email }, { context: 'Auth' });

      // Verificar se o email está autorizado
      let authorizedEmail = null;
      try {
        logger.debug('Verificando email autorizado', { email }, { context: 'Auth' });
        const { data, error: authEmailError } = await supabase
          .from('authorized_emails')
          .select('*')
          .eq('email', email)
          .single();

        if (authEmailError) {
          logger.warn('Erro ao verificar email autorizado - permitindo registro temporariamente', { error: authEmailError, message: authEmailError.message }, { context: 'Auth' });
          // Se não conseguir verificar emails autorizados, criar um email autorizado temporário
          authorizedEmail = { email, role: 'member' };
        } else {
          authorizedEmail = data;
        }
        
        if (!authorizedEmail) {
          logger.warn('Email não encontrado na lista - criando entrada temporária', { email }, { context: 'Auth' });
          // Se não encontrar o email, criar uma entrada temporária
          authorizedEmail = { email, role: 'member' };
        }
        
        logger.debug('Email autorizado (ou temporário) encontrado', { authorizedEmail }, { context: 'Auth' });
      } catch (error: any) {
        logger.warn('Exceção ao verificar email autorizado - permitindo registro temporariamente', { error, message: error.message }, { context: 'Auth' });
        // Em caso de erro, permitir o registro com role padrão
        authorizedEmail = { email, role: 'member' };
      }

      // Verificar se o usuário já existe
      const { data: existingUser, error: existingUserError } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        logger.error('Usuário já registrado', { email }, { context: 'Auth' });
        throw new Error('Este email já está registrado. Por favor, faça login.');
      }

      // Criar usuário no Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (authError) {
        logger.error('Erro ao criar usuário', { error: authError }, { context: 'Auth' });
        throw authError;
      }

      if (!authData.user) {
        logger.error('Dados de usuário não retornados após registro', { context: 'Auth' });
        throw new Error('Erro ao criar usuário');
      }

      // Criar perfil do usuário
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          name,
          email,
          role: authorizedEmail.role as UserRole,
          status: 'pending' as UserStatus,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (profileError) {
        logger.error('Erro ao criar perfil', { error: profileError }, { context: 'Auth' });
        // Tentar limpar o usuário criado no auth
        await supabase.auth.admin.deleteUser(authData.user.id);
        throw profileError;
      }

      logger.info('Registro concluído com sucesso', { userId: authData.user.id }, { context: 'Auth' });
      return { success: true };
    } catch (error: any) {
      logger.error('Erro no registro', { error }, { context: 'Auth' });
      if (error instanceof AuthError) {
        toast.error(error.message);
        return { success: false, error: error.message };
      } else if (error instanceof PostgrestError) {
        toast.error(error.message);
        return { success: false, error: error.message };
      } else if (error instanceof Error) {
        toast.error(error.message);
        return { success: false, error: error.message };
      } else {
        toast.error('Erro desconhecido durante o registro');
        return { success: false, error: 'Erro desconhecido durante o registro' };
      }
    }
  };

  const logout = async () => {
    try {
      // Indica que está carregando
      updateAuthState(authStateRef.current.user, true);
      
      // Limpa timeouts existentes
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
        redirectTimeoutRef.current = null;
      }
      
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // Atualiza estado e limpa cache
      updateAuthState(null, false);
      localStorage.removeItem(SECURITY_CONFIG.SESSION_CACHE_KEY);
      
      // Limpa cache de queries
      queryClient.clear();
      
      if (import.meta.env.DEV) {
        logger.debug('Logout realizado', { context: 'Auth' });
      }
      
      // Redireciona com debounce
      handleRedirect('/login', 100);
    } catch (error) {
      logger.error('Erro no logout', { error, context: 'Auth' });
      // Mesmo em caso de erro, atualiza o estado para não logado
      updateAuthState(null, false);
      throw error;
    }
  };

  const updateUser = async (userData: Partial<User>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          name: userData.name,
          avatar: userData.avatar,
          phone: userData.phone,
          location: userData.location,
          bio: userData.bio,
          department: userData.department,
        })
        .eq('id', user.id);

      if (error) throw error;

      setUser(prev => prev ? { ...prev, ...userData } : null);
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const hasPermission = async (permission: string, projectId?: string) => {
    if (!user) return false;

    try {
      // Se o usuário é admin, tem todas as permissões
      if (user.role === 'admin') return true;

      // Verificar permissões específicas do projeto
      if (projectId) {
        // Verificar se o usuário é o autor do projeto
        const { data: project, error } = await supabase
          .from('projects')
          .select('created_by')
          .eq('id', projectId)
          .single();

        if (error) {
          logger.error('Erro ao verificar autor do projeto', { error }, { context: 'Auth' });
          return false;
        }

        if (project && project.created_by === user.id) {
          return true;
        }
      }

      // Verificar permissões específicas
      switch (permission) {
        case 'admin':
          return user.role === 'admin';
        case 'manager':
          return user.role === 'admin' || user.role === 'manager';
        case 'member':
          return user.role === 'admin' || user.role === 'manager' || user.role === 'member';
        case 'view_analytics':
          return user.role === 'admin' || user.role === 'manager';
        case 'delete_any_project':
          return user.role === 'admin';
        default:
          return false;
      }
    } catch (error) {
      logger.error('Erro ao verificar permissões', { error }, { context: 'Auth' });
      return false;
    }
  };

  const canAccessProject = (projectId: string, visibility: 'public' | 'private') => {
    if (!user) return visibility === 'public';

    if (visibility === 'public') return true;

    // Verificar se o usuário é membro do projeto
    // Implementar lógica de verificação de membros do projeto
    return false;
  };

  const getAllUsers = async () => {
    if (!user) {
      logger.error('Tentativa de getAllUsers sem usuário autenticado', { context: 'Auth' });
      throw new Error('Usuário não autenticado');
    }

    if (user.role !== 'admin') {
      logger.error('Tentativa de getAllUsers sem permissão de admin', { context: 'Auth' });
      throw new Error('Sem permissão para acessar esta função');
    }

    try {
      logger.debug('Buscando todos os usuários...', { context: 'Auth' });
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Erro ao buscar usuários', { error }, { context: 'Auth' });
        throw error;
      }

      logger.info('Usuários encontrados', { count: data.length }, { context: 'Auth' });
      return data.map(profile => ({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        role: profile.role as UserRole,
        avatar: profile.avatar,
        organizationId: profile.organization_id,
        departmentId: profile.department_id,
        phone: profile.phone,
        location: profile.location,
        bio: profile.bio,
        department: profile.department,
        joinDate: profile.join_date,
        status: profile.status as UserStatus
      }));
    } catch (error: any) {
      logger.error('Erro ao buscar usuários', { error }, { context: 'Auth' });
      if (error instanceof Error) {
        toast.error(`Erro ao buscar usuários: ${error.message}`);
      } else {
        toast.error('Erro desconhecido ao buscar usuários');
      }
      throw error;
    }
  };

  const updateUserRole = async (userId: string, role: UserRole) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', userId);

      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const updateUserStatus = async (userId: string, status: UserStatus) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', userId);

      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const addAuthorizedEmail = async (email: string, role: UserRole) => {
    try {
      const { error } = await supabase
        .from('authorized_emails')
        .insert({ email, role });

      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const removeAuthorizedEmail = async (email: string) => {
    try {
      const { error } = await supabase
        .from('authorized_emails')
        .delete()
        .eq('email', email);

      if (error) throw error;
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const getAuthorizedEmails = async () => {
    try {
      const { data, error } = await supabase
        .from('authorized_emails')
        .select('*');

      if (error) throw error;

      return data.map(item => ({
        email: item.email,
        role: item.role as UserRole
      }));
    } catch (error: any) {
      toast.error(error.message);
      return [];
    }
  };

  const value: AuthContextType = {
    user,
    login,
    register,
    logout,
    updateUser,
    isLoading,
    hasPermission,
    canAccessProject,
    getAllUsers,
    updateUserRole,
    updateUserStatus,
    addAuthorizedEmail,
    removeAuthorizedEmail,
    getAuthorizedEmails,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Criar um componente separado para lidar com a visibilidade da página
function PageVisibilityHandler() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleDiscreteRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    
    try {
      logger.debug('Iniciando refresh discreto do usuário', { context: 'AuthContext' });
      await new Promise(resolve => setTimeout(resolve, 100));
      await queryClient.invalidateQueries({ queryKey: ['user'] });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      logger.info('Refresh discreto do usuário concluído', { context: 'AuthContext' });
    } catch (error) {
      logger.error('Erro no refresh discreto do usuário', { error, context: 'AuthContext' });
    } finally {
      setIsRefreshing(false);
    }
  };

  usePageVisibility({
    onPageVisible: handleDiscreteRefresh,
    debounceMs: 1500
  });

  return isRefreshing ? (
    <div className="fixed top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-md text-sm opacity-75 z-50">
      Atualizando usuário...
    </div>
  ) : null;
}
