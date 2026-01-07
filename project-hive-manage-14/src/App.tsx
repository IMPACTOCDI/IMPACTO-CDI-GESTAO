import { useState, useEffect, useRef } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ProjectProvider } from './contexts/ProjectContext';
import { Toaster } from './components/ui/toaster';
import AppRoutes from './routes';
import { useQueryClient } from '@tanstack/react-query';
import { logger } from './lib/logger';
import { queryClient } from './lib/queryClient';
import { TooltipProvider } from './components/ui/tooltip';
import { PageVisibilityHandler } from './components/PageVisibilityHandler';
import { reconnectSupabase } from './lib/supabase';
import { startKeepAlive, stopKeepAlive } from './lib/keepAlive';

function App() {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  // Função para fazer refresh discreto dos dados
  const handleDiscreteRefresh = async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    setConnectionError(null);
    
    try {
      logger.debug('Iniciando refresh discreto', { context: 'App' });
      
      // Tentar reconectar ao Supabase primeiro
      const reconnected = await reconnectSupabase();
      
      if (!reconnected && retryCountRef.current < maxRetries) {
        // Se falhou na reconexão, tentar novamente
        retryCountRef.current++;
        logger.warn(`Falha na reconexão, tentativa ${retryCountRef.current} de ${maxRetries}`, { context: 'App' });
        
        // Esperar um pouco antes de tentar novamente (backoff exponencial)
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCountRef.current));
        setIsRefreshing(false);
        handleDiscreteRefresh();
        return;
      } else if (!reconnected) {
        // Se excedeu o número máximo de tentativas
        throw new Error('Não foi possível reconectar ao servidor. Tempo limite excedido.');
      }
      
      // Resetar contador de tentativas após reconexão bem-sucedida
      retryCountRef.current = 0;
      
      // Invalidar todas as queries
      queryClient.invalidateQueries();
      
      // Forçar refetch de queries ativas
      queryClient.refetchQueries({ type: 'active' });
      
      // Disparar evento customizado para notificar outros componentes
      window.dispatchEvent(new CustomEvent('app-refresh', { detail: { source: 'app' } }));
      
      logger.info('Refresh discreto concluído', { context: 'App' });
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Erro ao atualizar dados';
      logger.error('Erro no refresh discreto', { error, context: 'App' });
      setConnectionError(errorMsg);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Listener para o evento online
  useEffect(() => {
    const handleOnline = () => {
      logger.info('Conexão de rede restaurada, atualizando dados', { context: 'App' });
      handleDiscreteRefresh();
    };
    
    window.addEventListener('online', handleOnline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  // Listener para evento customizado de refresh
  useEffect(() => {
    const handleAppRefresh = () => {
      logger.debug('Evento de refresh disparado', { context: 'App' });
    };

    window.addEventListener('app-refresh', handleAppRefresh);
    return () => window.removeEventListener('app-refresh', handleAppRefresh);
  }, []);

  useEffect(() => {
    // Iniciar o keep-alive quando o componente montar
    startKeepAlive();

    // Parar o keep-alive quando o componente desmontar
    return () => {
      stopKeepAlive();
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <ProjectProvider>
            <PageVisibilityHandler />
            {isRefreshing && (
              <div className="fixed top-4 right-4 bg-blue-500 text-white px-3 py-1 rounded-md text-sm opacity-75 z-50">
                Atualizando...
              </div>
            )}
            {connectionError && (
              <div className="fixed top-4 right-4 bg-red-500 text-white px-3 py-1 rounded-md text-sm opacity-75 z-50">
                {connectionError}
                <button 
                  className="ml-2 underline" 
                  onClick={() => {
                    setConnectionError(null);
                    retryCountRef.current = 0;
                    handleDiscreteRefresh();
                  }}
                >
                  Tentar novamente
                </button>
              </div>
            )}
            <AppRoutes />
            <Toaster />
          </ProjectProvider>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
