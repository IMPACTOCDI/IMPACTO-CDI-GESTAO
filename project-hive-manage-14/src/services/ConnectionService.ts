import { supabase, checkSupabaseConnection, reconnectToSupabase, connectionState, CONNECTION_CONFIG } from '../lib/supabase';
import { logger } from '../lib/logger';
import { QueryClient } from '@tanstack/react-query';

interface ConnectionMetrics {
  totalReconnects: number;
  successfulReconnects: number;
  failedReconnects: number;
  averageReconnectTime: number;
  lastReconnectTime: number;
  connectionUptime: number;
  startTime: number;
}

class ConnectionService {
  private static instance: ConnectionService;
  private queryClient: QueryClient | null = null;
  private metrics: ConnectionMetrics;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private connectionStartTime: number;

  private constructor() {
    this.connectionStartTime = Date.now();
    this.metrics = {
      totalReconnects: 0,
      successfulReconnects: 0,
      failedReconnects: 0,
      averageReconnectTime: 0,
      lastReconnectTime: 0,
      connectionUptime: 0,
      startTime: this.connectionStartTime
    };
    
    this.startHealthCheck();
  }

  static getInstance(): ConnectionService {
    if (!ConnectionService.instance) {
      ConnectionService.instance = new ConnectionService();
    }
    return ConnectionService.instance;
  }

  setQueryClient(queryClient: QueryClient) {
    this.queryClient = queryClient;
    logger.info('QueryClient configurado no ConnectionService', { context: 'ConnectionService' });
  }

  async checkConnection(): Promise<boolean> {
    try {
      const isConnected = await checkSupabaseConnection();
      this.updateConnectionUptime();
      return isConnected;
    } catch (error) {
      logger.error('Erro ao verificar conexão:', error, { context: 'ConnectionService' });
      return false;
    }
  }

  async reconnect(): Promise<boolean> {
    const startTime = Date.now();
    this.metrics.totalReconnects++;
    
    try {
      logger.info('Iniciando processo de reconexão avançado', {
        attempt: this.metrics.totalReconnects,
        connectionQuality: connectionState.connectionQuality,
        context: 'ConnectionService'
      });

      const success = await reconnectToSupabase();
      const reconnectTime = Date.now() - startTime;
      
      if (success) {
        this.metrics.successfulReconnects++;
        this.metrics.lastReconnectTime = reconnectTime;
        this.updateAverageReconnectTime(reconnectTime);
        
        logger.info('Reconexão bem-sucedida', {
          reconnectTime,
          totalAttempts: this.metrics.totalReconnects,
          successRate: (this.metrics.successfulReconnects / this.metrics.totalReconnects * 100).toFixed(2) + '%',
          context: 'ConnectionService'
        });
        
        // Invalidar e refetch queries ativas de forma inteligente
        await this.refreshQueries();
        
        return true;
      } else {
        this.metrics.failedReconnects++;
        logger.error('Falha na reconexão', {
          reconnectTime,
          failureRate: (this.metrics.failedReconnects / this.metrics.totalReconnects * 100).toFixed(2) + '%',
          context: 'ConnectionService'
        });
        return false;
      }
    } catch (error) {
      this.metrics.failedReconnects++;
      logger.error('Erro durante reconexão:', error, { context: 'ConnectionService' });
      return false;
    }
  }

  private async refreshQueries(): Promise<void> {
    if (!this.queryClient) {
      logger.warn('QueryClient não configurado, pulando refresh de queries', {
        context: 'ConnectionService'
      });
      return;
    }

    try {
      // Invalidar queries relacionadas a dados críticos primeiro
      const criticalQueries = ['profiles', 'projects', 'auth'];
      
      for (const queryKey of criticalQueries) {
        await this.queryClient.invalidateQueries({ 
          queryKey: [queryKey],
          exact: false 
        });
      }
      
      // Refetch apenas queries ativas e stale
      await this.queryClient.refetchQueries({ 
        type: 'active',
        stale: true 
      });
      
      logger.info('Queries críticas atualizadas após reconexão', {
        queriesInvalidated: criticalQueries,
        context: 'ConnectionService'
      });
    } catch (error) {
      logger.error('Erro ao atualizar queries:', error, { context: 'ConnectionService' });
    }
  }

  private startHealthCheck(): void {
    // Health check a cada 30 segundos
    this.healthCheckInterval = setInterval(async () => {
      try {
        const isConnected = await this.checkConnection();
        
        if (!isConnected && connectionState.connectionQuality !== 'bad') {
          logger.warn('Health check detectou problema de conexão', {
            connectionQuality: connectionState.connectionQuality,
            context: 'ConnectionService'
          });
          
          // Tentar reconexão automática se não estiver já reconectando
          if (!connectionState.isReconnecting) {
            this.reconnect();
          }
        }
      } catch (error) {
        logger.error('Erro no health check:', error, { context: 'ConnectionService' });
      }
    }, 30000);
  }

  private updateAverageReconnectTime(newTime: number): void {
    if (this.metrics.averageReconnectTime === 0) {
      this.metrics.averageReconnectTime = newTime;
    } else {
      // Média móvel simples
      this.metrics.averageReconnectTime = 
        (this.metrics.averageReconnectTime + newTime) / 2;
    }
  }

  private updateConnectionUptime(): void {
    this.metrics.connectionUptime = Date.now() - this.connectionStartTime;
  }

  // Método para verificar se está reconectando
  isReconnecting(): boolean {
    return connectionState.isReconnecting;
  }

  // Método para obter status detalhado da conexão
  getConnectionStatus() {
    this.updateConnectionUptime();
    
    return {
      isReconnecting: connectionState.isReconnecting,
      connectionQuality: connectionState.connectionQuality,
      isCircuitOpen: connectionState.isCircuitOpen,
      failureCount: connectionState.failureCount,
      metrics: {
        ...this.metrics,
        successRate: this.metrics.totalReconnects > 0 
          ? (this.metrics.successfulReconnects / this.metrics.totalReconnects * 100).toFixed(2) + '%'
          : '100%',
        uptimeHours: (this.metrics.connectionUptime / (1000 * 60 * 60)).toFixed(2)
      }
    };
  }

  // Método para resetar métricas
  resetMetrics(): void {
    this.connectionStartTime = Date.now();
    this.metrics = {
      totalReconnects: 0,
      successfulReconnects: 0,
      failedReconnects: 0,
      averageReconnectTime: 0,
      lastReconnectTime: 0,
      connectionUptime: 0,
      startTime: this.connectionStartTime
    };
    logger.info('Métricas de conexão resetadas', { context: 'ConnectionService' });
  }

  // Método para parar health check (cleanup)
  destroy(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    logger.info('ConnectionService destruído', { context: 'ConnectionService' });
  }
}

export const connectionService = ConnectionService.getInstance();