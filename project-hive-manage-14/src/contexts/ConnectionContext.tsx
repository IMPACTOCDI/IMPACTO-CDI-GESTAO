import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { logger } from '../lib/logger';
import { connectionService } from '../services/ConnectionService';
import { connectionState } from '../lib/supabase';
import { keepAliveService } from '../lib/keepAlive';
import { useQueryClient } from '@tanstack/react-query';

interface ConnectionMetrics {
  totalChecks: number;
  successfulChecks: number;
  failedChecks: number;
  averageResponseTime: number;
  lastSuccessfulCheck: Date | null;
  lastFailedCheck: Date | null;
  uptime: number;
}

interface ConnectionContextType {
  isConnected: boolean;
  lastChecked: Date | null;
  connectionQuality: number;
  isReconnecting: boolean;
  failedAttempts: number;
  circuitBreakerOpen: boolean;
  metrics: ConnectionMetrics;
  checkConnection: () => Promise<boolean>;
  reconnect: () => Promise<boolean>;
  forceReconnect: () => Promise<boolean>;
  resetMetrics: () => void;
}

const ConnectionContext = createContext<ConnectionContextType>({
  isConnected: true,
  lastChecked: null,
  connectionQuality: 100,
  isReconnecting: false,
  failedAttempts: 0,
  circuitBreakerOpen: false,
  metrics: {
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
    averageResponseTime: 0,
    lastSuccessfulCheck: null,
    lastFailedCheck: null,
    uptime: 0
  },
  checkConnection: async () => true,
  reconnect: async () => true,
  forceReconnect: async () => true,
  resetMetrics: () => {},
});

export const useConnection = () => useContext(ConnectionContext);

interface ConnectionProviderProps {
  children: ReactNode;
  checkInterval?: number; // Intervalo em ms para verificar a conexão
  enableAutoReconnect?: boolean; // Habilitar reconexão automática
  maxReconnectAttempts?: number; // Máximo de tentativas de reconexão
}

export const ConnectionProvider: React.FC<ConnectionProviderProps> = ({
  children,
  checkInterval = 30000, // Padrão: verificar a cada 30 segundos
  enableAutoReconnect = true,
  maxReconnectAttempts = 5,
}) => {
  const [isConnected, setIsConnected] = useState<boolean>(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [connectionQuality, setConnectionQuality] = useState<number>(100);
  const [isReconnecting, setIsReconnecting] = useState<boolean>(false);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
  const [circuitBreakerOpen, setCircuitBreakerOpen] = useState<boolean>(false);
  const [metrics, setMetrics] = useState<ConnectionMetrics>({
    totalChecks: 0,
    successfulChecks: 0,
    failedChecks: 0,
    averageResponseTime: 0,
    lastSuccessfulCheck: null,
    lastFailedCheck: null,
    uptime: 0
  });

  const queryClient = useQueryClient();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const connectionChangeListenersRef = useRef<Set<() => void>>(new Set());
  const startTimeRef = useRef<Date>(new Date());

  // Configurar o queryClient no connectionService
  useEffect(() => {
    if (queryClient) {
      connectionService.setQueryClient(queryClient);
    }
  }, [queryClient]);

  // Função para converter qualidade de string para número
  const convertQualityToNumber = (quality: 'good' | 'poor' | 'bad'): number => {
    switch (quality) {
      case 'good': return 100;
      case 'poor': return 50;
      case 'bad': return 0;
      default: return 0;
    }
  };

  // Sincronizar estado com o connectionState global
  const syncConnectionState = useCallback(() => {
    const newQuality = convertQualityToNumber(connectionState.connectionQuality);
    const newFailedAttempts = connectionState.failureCount;
    const newCircuitBreakerOpen = connectionState.circuitBreaker.isOpen();
    const newIsReconnecting = connectionService.isReconnecting();

    setConnectionQuality(newQuality);
    setFailedAttempts(newFailedAttempts);
    setCircuitBreakerOpen(newCircuitBreakerOpen);
    setIsReconnecting(newIsReconnecting);

    // Notificar listeners sobre mudanças de conexão
    connectionChangeListenersRef.current.forEach(listener => {
      try {
        listener();
      } catch (error) {
        logger.error('Erro ao executar listener de mudança de conexão:', error, {
          context: 'ConnectionContext'
        });
      }
    });
  }, []);

  // Atualizar métricas
  const updateMetrics = useCallback((success: boolean, responseTime?: number) => {
    setMetrics(prev => {
      const now = new Date();
      const newMetrics = {
        ...prev,
        totalChecks: prev.totalChecks + 1,
        successfulChecks: success ? prev.successfulChecks + 1 : prev.successfulChecks,
        failedChecks: success ? prev.failedChecks : prev.failedChecks + 1,
        lastSuccessfulCheck: success ? now : prev.lastSuccessfulCheck,
        lastFailedCheck: success ? prev.lastFailedCheck : now,
        uptime: ((now.getTime() - startTimeRef.current.getTime()) / 1000) / 60 // em minutos
      };

      // Calcular tempo médio de resposta
      if (responseTime && success && newMetrics.successfulChecks > 0) {
        if (newMetrics.successfulChecks === 1) {
          // Primeira medição bem-sucedida
          newMetrics.averageResponseTime = responseTime;
        } else {
          // Calcular média ponderada
          const totalResponseTime = (prev.averageResponseTime * (newMetrics.successfulChecks - 1)) + responseTime;
          newMetrics.averageResponseTime = totalResponseTime / newMetrics.successfulChecks;
        }
      }

      return newMetrics;
    });
  }, []);

  // Função para verificar a conexão
  const checkConnection = async (): Promise<boolean> => {
    // Evitar verificações simultâneas
    if (isChecking) {
      return isConnected;
    }

    setIsChecking(true);
    const startTime = Date.now();

    try {
      const connected = await connectionService.checkConnection();
      const responseTime = Date.now() - startTime;
      
      setIsConnected(connected);
      setLastChecked(new Date());
      updateMetrics(connected, responseTime);
      syncConnectionState();

      if (connected) {
        logger.debug('Verificação de conexão bem-sucedida', {
          responseTime: `${responseTime}ms`,
          context: 'ConnectionContext'
        });
      } else {
        logger.warn('Verificação de conexão falhou', {
          responseTime: `${responseTime}ms`,
          context: 'ConnectionContext'
        });

        // Tentar reconexão automática se habilitada
        if (enableAutoReconnect && failedAttempts < maxReconnectAttempts) {
          setTimeout(() => {
            reconnect();
          }, 2000); // Aguardar 2 segundos antes de tentar reconectar
        }
      }

      return connected;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro ao verificar conexão:', error, {
        responseTime: `${responseTime}ms`,
        context: 'ConnectionContext'
      });
      
      setIsConnected(false);
      setLastChecked(new Date());
      updateMetrics(false, responseTime);
      syncConnectionState();
      
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  // Função para reconectar
  const reconnect = async (): Promise<boolean> => {
    if (isReconnecting) {
      logger.debug('Reconexão já em andamento', { context: 'ConnectionContext' });
      return false;
    }

    setIsReconnecting(true);
    const startTime = Date.now();

    try {
      logger.info('Iniciando processo de reconexão', {
        attempt: failedAttempts + 1,
        maxAttempts: maxReconnectAttempts,
        context: 'ConnectionContext'
      });

      const reconnected = await connectionService.reconnect();
      const responseTime = Date.now() - startTime;
      
      setIsConnected(reconnected);
      setLastChecked(new Date());
      updateMetrics(reconnected, responseTime);
      syncConnectionState();

      if (reconnected) {
        logger.info('Reconexão bem-sucedida', {
          responseTime: `${responseTime}ms`,
          context: 'ConnectionContext'
        });
        
        // Forçar um ping para garantir estabilidade
        await keepAliveService.forcePing();
      } else {
        logger.error('Falha na reconexão', {
          responseTime: `${responseTime}ms`,
          attempt: failedAttempts + 1,
          context: 'ConnectionContext'
        });
      }

      return reconnected;
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      logger.error('Erro durante reconexão:', error, {
        responseTime: `${responseTime}ms`,
        context: 'ConnectionContext'
      });
      
      setIsConnected(false);
      updateMetrics(false, responseTime);
      syncConnectionState();
      
      return false;
    } finally {
      setIsReconnecting(false);
    }
  };

  // Função para forçar reconexão (ignora circuit breaker)
  const forceReconnect = async (): Promise<boolean> => {
    logger.info('Forçando reconexão (ignorando circuit breaker)', {
      context: 'ConnectionContext'
    });

    // Resetar circuit breaker temporariamente
    connectionState.circuitBreaker.reset();
    
    return await reconnect();
  };

  // Função para resetar métricas
  const resetMetrics = useCallback(() => {
    setMetrics({
      totalChecks: 0,
      successfulChecks: 0,
      failedChecks: 0,
      averageResponseTime: 0,
      lastSuccessfulCheck: null,
      lastFailedCheck: null,
      uptime: 0
    });
    startTimeRef.current = new Date();
    
    logger.info('Métricas de conexão resetadas', {
      context: 'ConnectionContext'
    });
  }, []);

  // Adicionar listener para mudanças de conexão
  const addConnectionChangeListener = useCallback((listener: () => void) => {
    connectionChangeListenersRef.current.add(listener);
    return () => {
      connectionChangeListenersRef.current.delete(listener);
    };
  }, []);

  // Verificar conexão periodicamente
  useEffect(() => {
    // Verificar imediatamente ao montar o componente
    checkConnection();

    // Configurar verificação periódica
    if (checkInterval > 0) {
      intervalRef.current = setInterval(checkConnection, checkInterval);
    }

    // Limpar intervalo ao desmontar
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [checkInterval]);

  // Expor funções para o connectionService
  useEffect(() => {
    connectionService.addConnectionChangeListener = addConnectionChangeListener;
    connectionService.removeConnectionChangeListener = (listener: () => void) => {
      connectionChangeListenersRef.current.delete(listener);
    };
  }, [addConnectionChangeListener]);

  const value = {
    isConnected,
    lastChecked,
    connectionQuality,
    isReconnecting,
    failedAttempts,
    circuitBreakerOpen,
    metrics,
    checkConnection,
    reconnect,
    forceReconnect,
    resetMetrics,
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
};

// Hook para usar o contexto de conexão com verificações de segurança
export const useConnectionWithSafety = () => {
  const context = useConnection();
  
  if (!context) {
    throw new Error('useConnection deve ser usado dentro de um ConnectionProvider');
  }
  
  return context;
};

// Hook para monitorar a qualidade da conexão
export const useConnectionQuality = () => {
  const { connectionQuality, metrics, isConnected } = useConnection();
  
  const getQualityStatus = useCallback(() => {
    if (!isConnected) return 'disconnected';
    if (connectionQuality >= 80) return 'excellent';
    if (connectionQuality >= 60) return 'good';
    if (connectionQuality >= 40) return 'fair';
    return 'poor';
  }, [connectionQuality, isConnected]);
  
  const getQualityColor = useCallback(() => {
    const status = getQualityStatus();
    switch (status) {
      case 'excellent': return 'green';
      case 'good': return 'blue';
      case 'fair': return 'yellow';
      case 'poor': return 'orange';
      case 'disconnected': return 'red';
      default: return 'gray';
    }
  }, [getQualityStatus]);
  
  return {
    quality: connectionQuality,
    status: getQualityStatus(),
    color: getQualityColor(),
    metrics,
    isConnected
  };
};