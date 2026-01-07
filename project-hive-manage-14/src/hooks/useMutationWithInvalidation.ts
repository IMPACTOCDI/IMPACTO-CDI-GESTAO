import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

interface MutationOptions<TData, TError, TVariables> {
  mutationFn: (variables: TVariables) => Promise<TData>;
  invalidateQueries?: string[][];
  successMessage?: string;
  errorMessage?: string;
  onSuccessCallback?: (data: TData) => void;
  mutationKey?: string;
}

export function useMutationWithInvalidation<TData, TError, TVariables>({
  mutationFn,
  invalidateQueries = [],
  successMessage = 'Operação realizada com sucesso!',
  errorMessage = 'Erro ao realizar operação',
  onSuccessCallback,
  mutationKey = 'mutation'
}: MutationOptions<TData, TError, TVariables>) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn,
    onSuccess: (data) => {
      // Invalidar todas as queries especificadas
      invalidateQueries.forEach(queryKey => {
        queryClient.invalidateQueries({ queryKey });
      });
      
      // Mostrar toast de sucesso
      toast.success(successMessage);
      
      // Callback personalizado se fornecido
      onSuccessCallback?.(data);

      logger.debug('Mutação bem-sucedida', { mutationKey }, { context: 'Mutation' });
      logger.info('Cache atualizado com sucesso', { mutationKey }, { context: 'Mutation' });
    },
    onError: (error) => {
      console.error('Mutation error:', error);
      toast.error(errorMessage);

      logger.debug('Erro na mutação', { error, mutationKey }, { context: 'Mutation' });
      logger.error('Erro ao executar mutação', { error, mutationKey }, { context: 'Mutation', showToast: true });
    }
  });
} 