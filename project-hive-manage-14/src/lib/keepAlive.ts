import { supabase, checkSupabaseConnection, reconnectToSupabase, connectionState, CONNECTION_CONFIG, withRetry } from './supabase';
import { logger } from './logger';
import { connectionService } from '../services/ConnectionService';

// Configurações do keep-alive
const PING_INTERVAL = process.env.NODE_ENV === 'production' ? 60000 : 30000; // 1 min em prod, 30s em dev
const HEALTH_CHECK_INTERVAL = 45000; // 45 segundos
const MAX_FAILED_PINGS = 3;
const ADAPTIVE_PING_ENABLED = true;

interface KeepAliveMetrics {
  totalPings: number;
  successfulPings: number;
  failedPings: number;
  averageResponseTime: number;
  lastPingTime: number;
  lastSuccessfulPing: number;
  adaptivePingInterval: number;
}

class KeepAliveService {
  private pingInterval: NodeJS.Timeout | null = null;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private consecutiveFailures = 0;
  private isActive = false;
  private metrics: KeepAliveMetrics;
  private currentPingInterval: number;

  constructor() {
    this.currentPingInterval = PING_INTERVAL;
    this.metrics = {
      totalPings: 0,
      successfulPings: 0,
      failedPings: 0,
      averageResponseTime: 0,
      lastPingTime: 0,
      lastSuccessfulPing: 0,
      adaptivePingInterval: PING_INTERVAL
    };
  }

  start() {
    if (this.isActive) {
      logger.warn('KeepAlive já está ativo', { context: 'KeepAlive' });
      return;
    }

    this.isActive = true;
    logger.info('Iniciando KeepAlive service avançado', { 
      pingInterval: this.currentPingInterval,
      healthCheckInterval: HEALTH_CHECK_INTERVAL,
      adaptivePingEnabled: ADAPTIVE_PING_ENABLED,
      context: 'KeepAlive' 
    });

    this.startPing();
    this.startHealthCheck();
  }

  stop() {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }

    logger.info('KeepAlive service parado', { 
      metrics: this.getMetricsSummary(),
      context: 'KeepAlive' 
    });
  }

  private startPing() {
    const doPing = async () => {
      await this.ping();
      
      // Reagendar com intervalo adaptativo
      if (this.isActive) {
        this.pingInterval = setTimeout(doPing, this.currentPingInterval);
      }
    };

    // Fazer o primeiro ping após um pequeno delay
    this.pingInterval = setTimeout(doPing, 1000);
  }

  private startHealthCheck() {
    this.healthCheckInterval = setInterval(async () => {
      await this.healthCheck();
    }, HEALTH_CHECK_INTERVAL);
  }

  private async ping() {
    const startTime = Date.now();
    this.metrics.totalPings++;
    this.metrics.lastPingTime = startTime;

    try {
      // Usar withRetry para operações mais robustas
      await withRetry(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
        
        try {
          const { error } = await supabase
            .from('profiles')
            .select('id')
            .limit(1)
            .abortSignal(controller.signal);

          clearTimeout(timeoutId);
          
          if (error) {
            throw new Error(`Ping query error: ${error.message}`);
          }
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      }, 2, 1000, false); // 2 tentativas, 1s delay, sem circuit breaker para ping

      // Ping bem-sucedido
      const responseTime = Date.now() - startTime;
      this.metrics.successfulPings++;
      this.metrics.lastSuccessfulPing = Date.now();
      this.updateAverageResponseTime(responseTime);
      
      // Reset contador de falhas consecutivas
      if (this.consecutiveFailures > 0) {
        logger.info('Ping bem-sucedido após falhas', { 
          previousFailures: this.consecutiveFailures,
          responseTime,
          context: 'KeepAlive' 
        });
        this.consecutiveFailures = 0;
      }

      // Ajustar intervalo adaptativo
      this.adjustPingInterval(true, responseTime);

      logger.debug('Ping realizado com sucesso', { 
        responseTime,
        successRate: (this.metrics.successfulPings / this.metrics.totalPings * 100).toFixed(1) + '%',
        context: 'KeepAlive' 
      });
      
    } catch (error) {
      this.consecutiveFailures++;
      this.metrics.failedPings++;
      
      logger.error(`Ping falhou (${this.consecutiveFailures}/${MAX_FAILED_PINGS}):`, error, { 
        connectionQuality: connectionState.connectionQuality,
        context: 'KeepAlive' 
      });

      // Ajustar intervalo adaptativo
      this.adjustPingInterval(false);

      // Se excedeu o limite de falhas, sinalizar problema de conexão
      if (this.consecutiveFailures >= MAX_FAILED_PINGS) {
        await this.handleConnectionLoss();
      }
    }
  }

  private adjustPingInterval(success: boolean, responseTime?: number) {
    if (!ADAPTIVE_PING_ENABLED) return;

    if (success && responseTime) {
      // Conexão boa - pode aumentar o intervalo ligeiramente
      if (responseTime < 1000 && connectionState.connectionQuality === 'good') {
        this.currentPingInterval = Math.min(this.currentPingInterval * 1.1, PING_INTERVAL * 2);
      }
    } else {
      // Falha - diminuir o intervalo para detectar recuperação mais rapidamente
      this.currentPingInterval = Math.max(this.currentPingInterval * 0.7, PING_INTERVAL * 0.5);
    }

    this.metrics.adaptivePingInterval = this.currentPingInterval;
  }

  private updateAverageResponseTime(newTime: number) {
    if (this.metrics.averageResponseTime === 0) {
      this.metrics.averageResponseTime = newTime;
    } else {
      // Média móvel exponencial
      this.metrics.averageResponseTime = 
        (this.metrics.averageResponseTime * 0.8) + (newTime * 0.2);
    }
  }

  private async healthCheck() {
    try {
      // Usar o connectionService para health check mais robusto
      const isConnected = await connectionService.checkConnection();
      
      if (!isConnected) {
        logger.warn('Health check detectou problema de conexão', { 
          connectionQuality: connectionState.connectionQuality,
          consecutiveFailures: this.consecutiveFailures,
          context: 'KeepAlive' 
        });
        
        // Não chamar handleConnectionLoss aqui se já estiver reconectando
        if (!connectionState.isReconnecting) {
          await this.handleConnectionLoss();
        }
      } else {
        logger.debug('Health check OK', { 
          connectionQuality: connectionState.connectionQuality,
          context: 'KeepAlive' 
        });
      }
    } catch (error) {
      logger.error('Erro no health check:', error, { context: 'KeepAlive' });
    }
  }

  private async handleConnectionLoss() {
    try {
      logger.info('Delegando reconexão para ConnectionService', { 
        consecutiveFailures: this.consecutiveFailures,
        connectionQuality: connectionState.connectionQuality,
        context: 'KeepAlive' 
      });

      // Usar o connectionService para reconexão mais robusta
      const success = await connectionService.reconnect();
      
      if (success) {
        this.consecutiveFailures = 0;
        this.currentPingInterval = PING_INTERVAL; // Reset para intervalo normal
        logger.info('Reconexão delegada bem-sucedida', { context: 'KeepAlive' });
      } else {
        logger.error('Falha na reconexão delegada', { context: 'KeepAlive' });
      }
    } catch (error) {
      logger.error('Erro durante delegação de reconexão:', error, { context: 'KeepAlive' });
    }
  }

  // Métodos para obter informações do estado
  getStatus() {
    const now = Date.now();
    return {
      isActive: this.isActive,
      isReconnecting: connectionState.isReconnecting,
      consecutiveFailures: this.consecutiveFailures,
      connectionQuality: connectionState.connectionQuality,
      currentPingInterval: this.currentPingInterval,
      timeSinceLastPing: this.metrics.lastPingTime ? now - this.metrics.lastPingTime : 0,
      timeSinceLastSuccess: this.metrics.lastSuccessfulPing ? now - this.metrics.lastSuccessfulPing : 0,
      metrics: this.getMetricsSummary()
    };
  }

  private getMetricsSummary() {
    return {
      ...this.metrics,
      successRate: this.metrics.totalPings > 0 
        ? (this.metrics.successfulPings / this.metrics.totalPings * 100).toFixed(1) + '%'
        : '100%',
      averageResponseTime: Math.round(this.metrics.averageResponseTime)
    };
  }

  // Forçar um ping manual
  async forcePing() {
    if (!this.isActive) {
      throw new Error('KeepAlive service não está ativo');
    }
    
    logger.info('Executando ping manual', { context: 'KeepAlive' });
    await this.ping();
  }

  // Resetar métricas
  resetMetrics() {
    this.consecutiveFailures = 0;
    this.currentPingInterval = PING_INTERVAL;
    this.metrics = {
      totalPings: 0,
      successfulPings: 0,
      failedPings: 0,
      averageResponseTime: 0,
      lastPingTime: 0,
      lastSuccessfulPing: 0,
      adaptivePingInterval: PING_INTERVAL
    };
    logger.info('Métricas do KeepAlive resetadas', { context: 'KeepAlive' });
  }
}

// Instância singleton
export const keepAliveService = new KeepAliveService();

// Funções de conveniência para compatibilidade
export const startKeepAlive = () => keepAliveService.start();
export const stopKeepAlive = () => keepAliveService.stop();
export const getKeepAliveMetrics = () => keepAliveService.getMetrics();

// Auto-iniciar em produção
if (process.env.NODE_ENV === 'production') {
  // Delay pequeno para permitir inicialização completa
  setTimeout(() => {
    keepAliveService.start();
  }, 2000);
}