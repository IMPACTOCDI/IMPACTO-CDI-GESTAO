import { QueryClient } from '@tanstack/react-query';
import { logger } from './logger';

// Configurações otimizadas para o React Query
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Reduzir staleTime para forçar refetch mais frequente
      staleTime: import.meta.env.PROD ? 0 : 1000 * 60 * 5, // 0 em produção, 5 minutos em dev
      // Reduzir gcTime para limpar cache mais rápido
      gcTime: import.meta.env.PROD ? 1000 * 10 : 1000 * 60 * 60, // 10 segundos em produção, 1 hora em dev
      retry: 3,
      // Sempre refetch ao focar a janela em produção
      refetchOnWindowFocus: import.meta.env.PROD ? 'always' : false,
      refetchOnReconnect: true,
      refetchOnMount: true,
      // Refetch mais frequente em produção
      refetchInterval: import.meta.env.PROD ? 1000 * 5 : false, // 5 segundos em produção, desativado em dev
      refetchIntervalInBackground: import.meta.env.PROD ? true : false,
      networkMode: 'online',
      suspense: false,
      useErrorBoundary: false,
      retryOnMount: true,
      // Callback para log de erros
      onError: (error) => {
        logger.error('Erro na query do React Query', { error, context: 'ReactQuery' });
      },
    },
    mutations: {
      retry: 2,
      networkMode: 'online',
      useErrorBoundary: false,
      // Callback para log de erros
      onError: (error) => {
        logger.error('Erro na mutation do React Query', { error, context: 'ReactQuery' });
      },
    },
  },
});

// O queryClient já está sendo exportado na linha 5