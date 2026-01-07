import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { logger } from './logger';

// Configurações para o Realtime
const REALTIME_CONFIG = {
  RECONNECT_ATTEMPTS: 5,
  BASE_DELAY: 1000, // 1 segundo
  MAX_DELAY: 30000, // 30 segundos
  CONNECTION_CHECK_INTERVAL: 30000, // 30 segundos
};

/**
 * Cria um canal Realtime do Supabase com suporte a reconexão
 * @param channelName Nome único para o canal
 * @returns Objeto com o canal, função de reconexão e função de limpeza
 */
export function createRealtimeChannel(channelName: string) {
  let retryCount = 0;
  let retryTimeout: NodeJS.Timeout | null = null;
  
  // Criar o canal
  const channel = supabase.channel(channelName);
  
  /**
   * Função para lidar com reconexão com backoff exponencial
   * @param callback Função a ser chamada após reconexão bem-sucedida
   */
  const handleReconnect = (callback?: () => void) => {
    if (retryCount >= REALTIME_CONFIG.RECONNECT_ATTEMPTS) {
      logger.error(`[Realtime] Máximo de tentativas atingido para o canal ${channelName}`, { context: 'Realtime' });
      return;
    }
    
    // Calcular delay com backoff exponencial
    const delay = Math.min(
      REALTIME_CONFIG.BASE_DELAY * Math.pow(2, retryCount),
      REALTIME_CONFIG.MAX_DELAY
    );
    
    retryCount++;
    
    logger.debug(`[Realtime] Tentativa ${retryCount}/${REALTIME_CONFIG.RECONNECT_ATTEMPTS} em ${delay/1000}s para o canal ${channelName}`, { context: 'Realtime' });
    
    // Limpar timeout anterior se existir
    if (retryTimeout) {
      clearTimeout(retryTimeout);
    }
    
    // Configurar nova tentativa
    retryTimeout = setTimeout(() => {
      if (callback) callback();
    }, delay);
  };
  
  /**
   * Função para limpar recursos do canal
   */
  const cleanup = () => {
    try {
      if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
      }
      
      // Tentar remover o canal
      channel.unsubscribe();
      
      logger.debug(`[Realtime] Canal ${channelName} limpo com sucesso`, { context: 'Realtime' });
    } catch (error) {
      logger.error(`[Realtime] Erro ao limpar canal ${channelName}`, { error, context: 'Realtime' });
    }
  };
  
  return { channel, handleReconnect, cleanup };
}

/**
 * Monitora o estado da conexão com o Supabase Realtime
 * @returns Objeto com funções para verificar estado e limpar recursos
 */
export function monitorConnection() {
  let isOnlineValue = navigator.onLine;
  let checkInterval: NodeJS.Timeout | null = null;
  
  // Iniciar verificação periódica
  checkInterval = setInterval(() => {
    const wasOnline = isOnlineValue;
    isOnlineValue = navigator.onLine;
    
    // Detectar mudanças de estado
    if (wasOnline !== isOnlineValue) {
      if (isOnlineValue) {
        logger.debug('[Realtime] Conexão de rede restaurada', { context: 'Realtime' });
      } else {
        logger.warn('[Realtime] Conexão de rede perdida', { context: 'Realtime' });
      }
    }
  }, REALTIME_CONFIG.CONNECTION_CHECK_INTERVAL);
  
  // Configurar listeners de eventos de rede
  const handleOnline = () => {
    isOnlineValue = true;
    logger.debug('[Realtime] Dispositivo online', { context: 'Realtime' });
  };
  
  const handleOffline = () => {
    isOnlineValue = false;
    logger.warn('[Realtime] Dispositivo offline', { context: 'Realtime' });
  };
  
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  
  return {
    isOnline: () => isOnlineValue,
    cleanup: () => {
      if (checkInterval) {
        clearInterval(checkInterval);
        checkInterval = null;
      }
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      logger.debug('[Realtime] Monitor de conexão limpo', { context: 'Realtime' });
    }
  };
}