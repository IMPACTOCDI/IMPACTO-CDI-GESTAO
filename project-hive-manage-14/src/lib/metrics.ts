import { logger } from './logger';

interface ChannelMetrics {
  name: string;
  state: string;
  lastStateChange: number;
  reconnectAttempts: number;
  lastError?: string;
  messagesReceived: number;
  messagesProcessed: number;
  errors: number;
}

interface DatabaseMetrics {
  queries: number;
  errors: number;
  averageResponseTime: number;
  lastError?: string;
}

class Metrics {
  private static instance: Metrics;
  private channels: Map<string, ChannelMetrics>;
  private database: DatabaseMetrics;
  private readonly MAX_RECONNECT_ATTEMPTS = 5;

  private constructor() {
    this.channels = new Map();
    this.database = {
      queries: 0,
      errors: 0,
      averageResponseTime: 0
    };
  }

  public static getInstance(): Metrics {
    if (!Metrics.instance) {
      Metrics.instance = new Metrics();
    }
    return Metrics.instance;
  }

  public trackChannel(name: string, state: string, error?: string): void {
    const now = Date.now();
    const channel = this.channels.get(name) || {
      name,
      state,
      lastStateChange: now,
      reconnectAttempts: 0,
      messagesReceived: 0,
      messagesProcessed: 0,
      errors: 0
    };

    if (channel.state !== state) {
      channel.state = state;
      channel.lastStateChange = now;
      
      if (state === 'CLOSED' || state === 'CHANNEL_ERROR') {
        channel.reconnectAttempts++;
        channel.errors++;
        channel.lastError = error;
        
        if (channel.reconnectAttempts >= this.MAX_RECONNECT_ATTEMPTS) {
          logger.error(`[Metrics] Canal ${name} atingiu limite de tentativas de reconexão`, {
            attempts: channel.reconnectAttempts,
            lastError: error
          });
        }
      }
    }

    this.channels.set(name, channel);
    this.logMetrics();
  }

  public trackMessage(name: string, processed: boolean = true): void {
    const channel = this.channels.get(name);
    if (channel) {
      channel.messagesReceived++;
      if (processed) {
        channel.messagesProcessed++;
      }
      this.channels.set(name, channel);
    }
  }

  public trackDatabaseQuery(responseTime: number, error?: string): void {
    this.database.queries++;
    if (error) {
      this.database.errors++;
      this.database.lastError = error;
    }
    
    // Atualizar tempo médio de resposta
    this.database.averageResponseTime = 
      (this.database.averageResponseTime * (this.database.queries - 1) + responseTime) / 
      this.database.queries;
  }

  public getChannelMetrics(name: string): ChannelMetrics | undefined {
    return this.channels.get(name);
  }

  public getAllChannelMetrics(): ChannelMetrics[] {
    return Array.from(this.channels.values());
  }

  public getDatabaseMetrics(): DatabaseMetrics {
    return { ...this.database };
  }

  private logMetrics(): void {
    logger.debug('[Metrics] Estado atual:', {
      channels: this.getAllChannelMetrics(),
      database: this.getDatabaseMetrics()
    });
  }

  public reset(): void {
    this.channels.clear();
    this.database = {
      queries: 0,
      errors: 0,
      averageResponseTime: 0
    };
    logger.debug('[Metrics] Métricas resetadas');
  }
}

export const metrics = Metrics.getInstance(); 