import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { logger } from '@/lib/logger';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve ser usado dentro de um AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

// Cache de sessão em memória
let sessionCache: {
  user: User | null;
  lastUpdated: number;
} | null = null;

// Tempo de expiração do cache (5 minutos)
const CACHE_EXPIRATION = 5 * 60 * 1000;

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Função para verificar se o cache está válido
  const isCacheValid = useCallback(() => {
    if (!sessionCache) return false;
    return Date.now() - sessionCache.lastUpdated < CACHE_EXPIRATION;
  }, []);

  // Função para atualizar o cache
  const updateCache = useCallback((newUser: User | null) => {
    sessionCache = {
      user: newUser,
      lastUpdated: Date.now()
    };
  }, []);

  // Função para carregar o usuário do cache ou do Supabase
  const loadUser = useCallback(async () => {
    try {
      // Verificar cache primeiro
      if (isCacheValid() && sessionCache?.user) {
        setUser(sessionCache.user);
        setIsLoading(false);
        return;
      }

      // Se não houver cache válido, buscar do Supabase
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        logger.error('Erro ao obter sessão:', error);
        throw error;
      }

      if (session?.user) {
        setUser(session.user);
        updateCache(session.user);
      } else {
        setUser(null);
        updateCache(null);
      }
    } catch (error) {
      logger.error('Erro ao carregar usuário:', error);
      setUser(null);
      updateCache(null);
    } finally {
      setIsLoading(false);
    }
  }, [isCacheValid, updateCache]);

  // Carregar usuário inicial
  useEffect(() => {
    loadUser();

    // Configurar listener para mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      logger.debug('Mudança de estado de autenticação:', event);
      
      if (session?.user) {
        setUser(session.user);
        updateCache(session.user);
      } else {
        setUser(null);
        updateCache(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadUser, updateCache]);

  // Função de login otimizada
  const login = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        logger.error('Erro no login:', error);
        return { success: false, error: error.message };
      }

      if (data.user) {
        setUser(data.user);
        updateCache(data.user);
        return { success: true };
      }

      return { success: false, error: 'Usuário não encontrado' };
    } catch (error) {
      logger.error('Erro no login:', error);
      return { success: false, error: 'Erro ao fazer login' };
    }
  };

  // Função de logout otimizada
  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUser(null);
      updateCache(null);
    } catch (error) {
      logger.error('Erro ao fazer logout:', error);
      throw error;
    }
  };

  // Função para atualizar dados do usuário
  const refreshUser = async () => {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      
      if (error) throw error;
      
      if (user) {
        setUser(user);
        updateCache(user);
      } else {
        setUser(null);
        updateCache(null);
      }
    } catch (error) {
      logger.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};
