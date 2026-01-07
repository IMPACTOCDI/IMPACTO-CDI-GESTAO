import { useEffect, useState, useCallback, useRef } from 'react';
import { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import { createRealtimeChannel, monitorConnection } from '@/lib/supabase-config';
import { logger } from '@/lib/logger';

interface SubscriptionOptions {
  event?: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  schema?: string;
  table: string;
  filter?: string;
  callback: (payload: RealtimePostgresChangesPayload<any>) => void;
}

interface SubscriptionState {
  loading: boolean;
  error: Error | null;
  status: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR' | 'TIMED_OUT' | 'CLOSED';
}

export const useSupabaseRealtime = (channelName: string, options: SubscriptionOptions) => {
  const [state, setState] = useState<SubscriptionState>({
    loading: true,
    error: null,
    status: 'CLOSED'
  });

  const subscriptionRef = useRef<ReturnType<typeof createRealtimeChannel> | null>(null);
  const connectionMonitor = useRef<ReturnType<typeof monitorConnection> | null>(null);
  const isMounted = useRef(true);

  const setupSubscription = useCallback(() => {
    if (!isMounted.current) return;

    try {
      logger.debug(`[useSupabaseRealtime] Configurando assinatura para ${channelName}`);

      // Limpa subscription anterior se existir
      if (subscriptionRef.current) {
        subscriptionRef.current.cleanup();
      }

      // Cria nova subscription
      const { channel, handleReconnect, cleanup } = createRealtimeChannel(channelName);
      subscriptionRef.current = { channel, handleReconnect, cleanup };

      // Configura monitor de conexão
      if (!connectionMonitor.current) {
        connectionMonitor.current = monitorConnection();
      }

      // Configura handlers de eventos
      channel
        .on('postgres_changes', {
          event: options.event || '*',
          schema: options.schema || 'public',
          table: options.table,
          filter: options.filter
        }, (payload) => {
          if (!isMounted.current) return;
          logger.debug(`[useSupabaseRealtime] Evento recebido em ${channelName}:`, payload);
          options.callback(payload);
        })
        .subscribe((status) => {
          if (!isMounted.current) return;

          logger.debug(`[useSupabaseRealtime] Status da assinatura ${channelName}:`, status);

          setState(prev => ({
            ...prev,
            loading: status === 'SUBSCRIBED' ? false : true,
            error: status === 'CHANNEL_ERROR' ? new Error('Erro na conexão do canal') : null,
            status
          }));

          // Trata reconexão
          if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            if (connectionMonitor.current?.isOnline()) {
              handleReconnect(() => {
                if (isMounted.current) {
                  setupSubscription();
                }
              });
            }
          }
        });

    } catch (error) {
      logger.error(`[useSupabaseRealtime] Erro ao configurar assinatura ${channelName}:`, error);
      setState(prev => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error : new Error('Erro desconhecido'),
        status: 'CHANNEL_ERROR'
      }));
    }
  }, [channelName, options]);

  // Setup inicial
  useEffect(() => {
    setupSubscription();

    return () => {
      isMounted.current = false;
      if (subscriptionRef.current) {
        logger.debug(`[useSupabaseRealtime] Limpando assinatura ${channelName}`);
        subscriptionRef.current.cleanup();
      }
      if (connectionMonitor.current) {
        connectionMonitor.current.cleanup();
      }
    };
  }, [setupSubscription]);

  // Reconexão automática quando online
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && connectionMonitor.current?.isOnline()) {
        logger.debug(`[useSupabaseRealtime] Reconectando ${channelName} após retorno da aba`);
        setupSubscription();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [setupSubscription]);

  return {
    ...state,
    reconnect: setupSubscription
  };
}; 