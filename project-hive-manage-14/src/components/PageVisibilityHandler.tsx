import { useState, useRef, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { usePageVisibility } from '@/hooks/usePageVisibility';
import { logger } from '@/lib/logger';
import { reconnectSupabase } from '@/lib/supabase';

export function PageVisibilityHandler() {
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Referências para controle de debounce e concorrência
  const refreshTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const lastRefreshAttemptRef = useRef(0);
  const REFRESH_COOLDOWN = 3000; // 3 segundos entre tentativas
  const isRefreshingRef = useRef(false);

  const handleDiscreteRefresh = async () => {
    const now = Date.now();
    
    // Cancelar qualquer timeout pendente para evitar múltiplas chamadas
    if (refreshTimeoutRef.current) {
      clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
    
    // Verificar se já está em processo de refresh
    if (isRefreshing || isRefreshingRef.current) {
      logger.debug('Refresh já em andamento, ignorando chamada', { context: 'PageVisibility' });
      return;
    }
    
    // Verificar cooldown entre tentativas
    if (now - lastRefreshAttemptRef.current < REFRESH_COOLDOWN) {
      logger.debug('Tentativa de refresh muito frequente, aplicando debounce', { context: 'PageVisibility' });
      
      // Agendar uma nova tentativa após o cooldown
      refreshTimeoutRef.current = setTimeout(() => {
        handleDiscreteRefresh();
      }, REFRESH_COOLDOWN - (now - lastRefreshAttemptRef.current));
      
      return;
    }
    
    // Atualizar estado e referências
    setIsRefreshing(true);
    isRefreshingRef.current = true;
    lastRefreshAttemptRef.current = now;
    setErrorMessage(null);
    
    try {
      logger.debug('Iniciando refresh discreto', { context: 'PageVisibility' });
      
      // Tentar reconectar ao Supabase primeiro
      const reconnected = await reconnectSupabase();
      
      if (!reconnected && retryCountRef.current < maxRetries) {
        // Se falhou na reconexão, tentar novamente
        retryCountRef.current++;
        logger.warn(`Falha na reconexão, tentativa ${retryCountRef.current} de ${maxRetries}`, { context: 'PageVisibility' });
        
        // Esperar um pouco antes de tentar novamente (backoff exponencial)
        const retryDelay = 1000 * retryCountRef.current;
        logger.debug(`Agendando nova tentativa em ${retryDelay}ms`, { context: 'PageVisibility' });
        
        setIsRefreshing(false);
        isRefreshingRef.current = false;
        
        refreshTimeoutRef.current = setTimeout(() => {
          handleDiscreteRefresh();
        }, retryDelay);
        
        return;
      } else if (!reconnected) {
        // Se excedeu o número máximo de tentativas
        throw new Error('Não foi possível reconectar ao servidor. Tempo limite excedido.');
      }
      
      // Resetar contador de tentativas após reconexão bem-sucedida
      retryCountRef.current = 0;
      
      // Invalidar todas as queries ativas
      await queryClient.invalidateQueries();
      
      // Forçar refetch de queries importantes
      await queryClient.refetchQueries({ type: 'active' });
      
      logger.info('Refresh discreto concluído com sucesso', { context: 'PageVisibility' });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro ao atualizar dados';
      logger.error('Erro no refresh discreto', { error, context: 'PageVisibility' });
      setErrorMessage(errorMsg);
    } finally {
      setIsRefreshing(false);
      isRefreshingRef.current = false;
    }
  };

  usePageVisibility({
    forceRefreshOnVisible: true,
    debounceMs: 1500,
    reconnectOnVisible: true,
    onPageVisible: handleDiscreteRefresh
  });
  
  // Adicionar listener para o evento app-cache-restored
  useEffect(() => {
    const handleCacheRestored = () => {
      logger.info('Evento app-cache-restored detectado, atualizando dados', { context: 'PageVisibility' });
      handleDiscreteRefresh();
    };
    
    window.addEventListener('app-cache-restored', handleCacheRestored);
    
    return () => {
      window.removeEventListener('app-cache-restored', handleCacheRestored);
    };
  }, []);
  
  // Adicionar listener para o evento online
  useEffect(() => {
    const handleOnline = () => {
      logger.info('Conexão de rede restaurada, atualizando dados', { context: 'PageVisibility' });
      handleDiscreteRefresh();
    };
    
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  return (
    <>
      {isRefreshing && (
        <div className="fixed top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-md text-sm opacity-75 z-50">
          Atualizando dados...
        </div>
      )}
      {errorMessage && (
        <div className="fixed top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-md text-sm opacity-75 z-50">
          {errorMessage}
          <button 
            className="ml-2 underline" 
            onClick={() => {
              setErrorMessage(null);
              retryCountRef.current = 0;
              handleDiscreteRefresh();
            }}
          >
            Tentar novamente
          </button>
        </div>
      )}
    </>  
  );
}