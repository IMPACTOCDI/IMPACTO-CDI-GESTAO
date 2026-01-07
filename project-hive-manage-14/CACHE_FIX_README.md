# Correção do Problema de Cache no Render

Este documento descreve as modificações implementadas para resolver o problema onde os dados não apareciam ao retornar à página da aplicação no ambiente de produção (Render), exigindo uma atualização manual, e o erro de "Tempo limite excedido ao carregar o projeto" durante o carregamento infinito.

## Problema Identificado

O problema ocorria devido a uma combinação de fatores:
1. Cache agressivo do navegador em ambiente de produção
2. Configurações do React Query não otimizadas para produção
3. Falta de detecção adequada quando a página era restaurada do cache do navegador (bfcache)
4. Configurações de build que não preveniam adequadamente o cache de assets
5. Falta de mecanismo robusto para reconexão com o Supabase após períodos de inatividade
6. Ausência de tratamento adequado para erros de conexão e timeout

## Soluções Implementadas

### 1. Serviço de Conexão Dedicado

**Arquivo:** `src/services/ConnectionService.ts`

- Criado um serviço centralizado para gerenciar a conexão com o Supabase
- Implementado mecanismo de retry com backoff exponencial para reconexão
- Adicionado sistema de listeners para notificar sobre reconexões bem-sucedidas
- Centralizada a lógica de invalidação e refetch de queries após reconexão
- Implementado tratamento de erros de conexão com feedback visual

### 2. Melhorias no Hook `usePageVisibility`

**Arquivo:** `src/hooks/usePageVisibility.ts`

- Adicionados parâmetros `onPageVisible` e `onPageHidden` para callbacks personalizados
- Integração com o ConnectionService para reconexão ao Supabase
- Adicionada opção `forceRefreshOnVisible` que é ativada automaticamente em produção
- Implementado controle de tempo para detectar quando a página ficou oculta por mais de 30 segundos
- Adicionado mecanismo de invalidação e refetch automático de queries quando a página volta a ficar visível
- Melhorada a detecção de estado inicial da página

### 3. Configurações do React Query Otimizadas

**Arquivo:** `src/lib/queryClient.ts`

- `staleTime` definido como 0 em produção para forçar sempre o refetch
- `gcTime` reduzido para 10 segundos em produção
- `refetchOnWindowFocus` configurado como 'always' em produção
- `refetchInterval` reduzido para 5 segundos em produção
- `refetchIntervalInBackground` ativado apenas em produção
- Adicionados callbacks `onError` para melhor logging de erros

### 4. Detecção de Cache do Navegador (bfcache)

**Arquivo:** `src/main.tsx`

- Adicionado listener para o evento `pageshow` em produção
- Detecção automática quando a página é restaurada do cache do navegador
- Reconexão ao Supabase antes de invalidar e refetchar queries
- Disparo de evento customizado `app-cache-restored` para notificar componentes
- Importação dinâmica de dependências para evitar problemas de inicialização

### 5. Configurações de Build Anti-Cache

**Arquivo:** `vite.config.ts`

- Adicionado timestamp dinâmico aos nomes dos arquivos em produção
- Configuração `optimizeDeps.force` ativada em produção
- Exclusão do `@supabase/supabase-js` da otimização de dependências
- Definição de variáveis `__APP_VERSION__`, `__BUILD_TIME__` e `__CACHE_BUSTER__` com timestamp
- Configurações experimentais para URLs relativas

### 6. Meta Tags e Script Anti-Cache

**Arquivo:** `index.html`

- Reforçadas meta tags para prevenir cache do navegador:
  - `Cache-Control: no-cache, no-store, must-revalidate`
  - `Pragma: no-cache`
  - `Expires: 0`
  - `turbo-cache-control: no-cache`
  - `turbo-visit-control: reload`
- Adicionado script para detectar problemas de cache e forçar atualização
- Implementada detecção de quanto tempo se passou desde a última visita

### 7. Melhorias no PageVisibilityHandler

**Arquivo:** `src/components/PageVisibilityHandler.tsx`

- Integração com o ConnectionService para gerenciar reconexão
- Adicionados listeners para eventos `app-cache-restored` e `online`
- Implementado mecanismo de retry com backoff exponencial
- Adicionada interface para exibir erros e permitir retry manual
- Ativada a opção `forceRefreshOnVisible: true` para garantir refresh
- Exibição de indicador visual durante o processo de atualização

### 8. Melhorias no App.tsx

**Arquivo:** `src/App.tsx`

- Adicionado listener para o evento `online` para reconexão quando a rede é restaurada
- Implementado mecanismo de retry para reconexão ao Supabase
- Adicionada interface para exibir erros e permitir retry manual

## Como as Soluções Resolvem o Problema

### Problema de Cache e Atualização de Dados

1. **Detecção Robusta**: O hook `usePageVisibility` e os listeners de eventos agora detectam de forma mais precisa quando o usuário retorna à página

2. **Reconexão Inteligente**: O `ConnectionService` tenta reconectar ao Supabase antes de atualizar os dados, garantindo que a conexão esteja ativa

3. **Retry com Backoff**: Implementado mecanismo de retry com backoff exponencial para lidar com problemas temporários de conexão

4. **Prevenção de Cache**: As configurações de build e meta tags previnem que versões antigas da aplicação sejam servidas do cache

5. **Detecção de bfcache**: O listener `pageshow` detecta quando a página é restaurada do cache do navegador e força a reconexão e atualização dos dados

6. **Configurações Agressivas**: Em produção, o React Query usa configurações mais agressivas para garantir que os dados estejam sempre atualizados

7. **Listeners de Rede**: Adicionados listeners para o evento `online` para reconectar automaticamente quando a conexão de rede é restaurada

### Problema de "Tempo limite excedido ao carregar o projeto"

1. **Verificação de Conexão**: O `ConnectionService` verifica se a conexão com o Supabase está ativa antes de tentar carregar dados

2. **Retry Automático**: Implementado mecanismo de retry que tenta reconectar várias vezes com intervalos crescentes

3. **Feedback Visual**: Adicionada interface para exibir erros de conexão e permitir retry manual

4. **Tratamento de Erros**: Melhorado o tratamento de erros para identificar problemas de timeout e conexão

5. **Otimização de Dependências**: Exclusão do `@supabase/supabase-js` da otimização de dependências para evitar problemas de inicialização

## Comportamento Esperado

Após essas modificações:

- **Desenvolvimento**: Comportamento normal, sem mudanças significativas
- **Produção**: 
  - Dados sempre atualizados ao retornar à página
  - Reconexão automática ao Supabase quando necessário
  - Retry automático em caso de falha de conexão
  - Refresh automático a cada 5 segundos
  - Detecção e correção automática de problemas de cache
  - Indicador visual durante o processo de atualização
  - Mensagens de erro claras com opção de retry manual
  - Sem mais erros de "Tempo limite excedido ao carregar o projeto"

## Monitoramento

Para monitorar se as correções estão funcionando:

1. Verifique os logs do console em produção
2. Observe o indicador de atualização quando retornar à página
3. Confirme que os dados são atualizados automaticamente sem necessidade de refresh manual
4. Verifique se não ocorrem mais erros de "Tempo limite excedido ao carregar o projeto"
5. Teste cenários de perda de conexão e restauração para verificar o comportamento de retry

## Próximos Passos

1. Fazer o deploy das alterações no Render
2. Testar o comportamento em produção
3. Monitorar logs e performance
4. Implementar monitoramento de erros para identificar problemas de conexão
5. Considerar a implementação de um sistema de cache offline para melhorar a experiência em cenários de conexão instável
6. Ajustar configurações se necessário baseado no comportamento observado