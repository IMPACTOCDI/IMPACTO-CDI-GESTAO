import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from '../lib/logger';
import { connectionService } from '../services/ConnectionService';
import { keepAliveService } from '../lib/keepAlive';

interface UsePageVisibilityOptions {
  forceRefreshOnVisible?: boolean;
  debounceMs?: number;
  reconnectOnVisible?: boolean;
  onPageVisible?: () => void;
  onPageHidden?: () => void;
}

export function usePageVisibility(options: UsePageVisibilityOptions = {}) {
  const {
    forceRefreshOnVisible = import.meta.env.PROD, // Por padrão, forçar refresh em produção
    debounceMs = 1500, // Debounce para evitar múltiplos refreshes
    reconnectOnVisible = true, // Por padrão, reconectar ao Supabase quando a página ficar visível
    onPageVisible, // Callback quando a página fica visível
    onPageHidden, // Callback quando a página fica oculta
  } = options;

  const [isVisible, setIsVisible] = useState(!document.hidden);
  const [wasHidden, setWasHidden] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const hiddenTimeRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);
  const wasHiddenRef = useRef<boolean>(false);
  const lastVisibilityChangeRef = useRef(Date.now());
  const queryClient = useQueryClient();
  
  // Configurar o queryClient no connectionService
  useEffect(() => {
    if (queryClient) {
      connectionService.setQueryClient(queryClient);
    }
  }, [queryClient]);

  useEffect(() => {
    const handleVisibilityChange = async () => {
      const isNowVisible = !document.hidden;
      const now = Date.now();
      const timeSinceLastChange = now - lastVisibilityChangeRef.current;
      
      // Atualizar estado e referência
      setIsVisible(isNowVisible);
      lastVisibilityChangeRef.current = now;

      if (isNowVisible) {
        // Limpar timeout anterior se existir
        if (timeoutRef.current !== null) {
          window.clearTimeout(timeoutRef.current);
          timeoutRef.current = null;
        }
        
        if (reconnectTimeoutRef.current !== null) {
          window.clearTimeout(reconnectTimeoutRef.current);
          reconnectTimeoutRef.current = null;
        }
        
        // Chamar callback onPageVisible se existir
        if (onPageVisible) {
          onPageVisible();
        }

        // Verificar se a página esteve oculta
        if (hiddenTimeRef.current !== null) {
          const hiddenDuration = Date.now() - hiddenTimeRef.current;
          const needsHardRefresh = hiddenDuration > 30000; // 30 segundos
          setWasHidden(true);
          hiddenTimeRef.current = null;

          // Se forceRefreshOnVisible ou se esteve oculta por muito tempo
          if (forceRefreshOnVisible || needsHardRefresh) {
            // Usar timeout para evitar múltiplos refreshes
            timeoutRef.current = window.setTimeout(async () => {
              logger.debug('Forçando refresh após página ficar visível', {
                forceRefreshOnVisible,
                needsHardRefresh,
                hiddenDuration,
                inactiveTime: Math.round(timeSinceLastChange / 1000) + 's',
                context: 'PageVisibility'
              });
              
              // Tentar reconectar primeiro se a opção estiver ativada
              if (reconnectOnVisible && !isReconnecting) {
                setIsReconnecting(true);
                
                try {
                  logger.debug('Verificando conexão após retorno à página', { context: 'PageVisibility' });
                  
                  // Verificar conexão usando o serviço robusto
                  const isConnected = await connectionService.checkConnection();
                  
                  if (!isConnected) {
                    logger.warn('Conexão perdida, iniciando processo de reconexão', { context: 'PageVisibility' });
                    
                    // Usar o connectionService para reconexão robusta
                    const reconnected = await connectionService.reconnect();
                    
                    if (!reconnected) {
                      logger.warn('Falha na reconexão, tentando novamente em 2s', { context: 'PageVisibility' });
                      
                      // Se falhou, tentar novamente após um tempo
                      if (reconnectTimeoutRef.current === null) {
                        reconnectTimeoutRef.current = window.setTimeout(async () => {
                          try {
                            const retryReconnect = await connectionService.reconnect();
                            if (!retryReconnect) {
                              logger.error('Falha persistente na reconexão', { context: 'PageVisibility' });
                              
                              // Tentar recarregar a página como último recurso após falhas persistentes
                              if (timeSinceLastChange > 300000) { // 5 minutos
                                logger.warn('Inatividade prolongada, recarregando página', {
                                  context: 'PageVisibility'
                                });
                                window.location.reload();
                              }
                            } else {
                              logger.info('Reconexão bem-sucedida na segunda tentativa', { context: 'PageVisibility' });
                              // Forçar um ping para garantir que a conexão está estável
                              await keepAliveService.forcePing();
                              // Invalidar todas as queries após reconexão bem-sucedida
                              queryClient.invalidateQueries();
                              queryClient.refetchQueries({ type: 'active' });
                            }
                          } catch (retryError) {
                            logger.error('Erro na segunda tentativa de reconexão', { error: retryError, context: 'PageVisibility' });
                          } finally {
                            reconnectTimeoutRef.current = null;
                            setIsReconnecting(false);
                          }
                        }, 2000);
                      }
                      return;
                    } else {
                      logger.info('Reconexão bem-sucedida', { context: 'PageVisibility' });
                    }
                  } else {
                    logger.info('Conexão verificada e OK após retorno à página', {
                      context: 'PageVisibility'
                    });
                    
                    // Mesmo com conexão OK, invalidar queries críticas para garantir dados atualizados
                    if (timeSinceLastChange > 60000) { // 1 minuto
                      const criticalQueries = ['profiles', 'projects', 'auth'];
                      
                      for (const queryKey of criticalQueries) {
                        queryClient.invalidateQueries({ 
                          queryKey: [queryKey],
                          exact: false 
                        });
                      }
                      
                      logger.info('Queries críticas invalidadas após inatividade', {
                        inactiveTime: Math.round(timeSinceLastChange / 1000) + 's',
                        context: 'PageVisibility'
                      });
                    }
                  }
                } catch (error) {
                  logger.error('Erro ao verificar conexão', { error, context: 'PageVisibility' });
                } finally {
                  // Só definir como false se não houver uma tentativa de reconexão agendada
                  if (reconnectTimeoutRef.current === null) {
                    setIsReconnecting(false);
                  }
                }
              }
              
              // Invalidar todas as queries
              queryClient.invalidateQueries();
              
              // Forçar refetch de queries ativas
              queryClient.refetchQueries({ type: 'active' });
              
              timeoutRef.current = null;
            }, debounceMs);
          }
        }
      } else {
        // Página ficou oculta, registrar o tempo
        hiddenTimeRef.current = Date.now();
        
        // Chamar callback onPageHidden se existir
        if (onPageHidden) {
          onPageHidden();
        }
      }
    };

    // Eventos para detectar quando usuário sai/volta da página
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('blur', () => {
      wasHiddenRef.current = true;
      hiddenTimeRef.current = Date.now();
      onPageHidden?.();
    });

    // Verificar se a página já está oculta quando o componente é montado
    if (document.hidden) {
      wasHiddenRef.current = true;
      hiddenTimeRef.current = Date.now();
    }

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleVisibilityChange);
      window.removeEventListener('blur', handleVisibilityChange);
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [onPageVisible, onPageHidden, debounceMs, forceRefreshOnVisible, queryClient]);

  return { isVisible, wasHidden, isReconnecting };
}