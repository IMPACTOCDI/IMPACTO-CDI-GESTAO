import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

// Configurações de backup
const BACKUP_CONFIG = {
  retentionDays: 30, // Retenção de 30 dias
  maxBackups: 10, // Máximo de 10 backups
  schedule: '0 0 * * *', // Backup diário à meia-noite
};

// Configurações de monitoramento
const MONITORING_CONFIG = {
  resourceThresholds: {
    cpu: 80, // Alerta quando CPU > 80%
    memory: 85, // Alerta quando memória > 85%
    storage: 90, // Alerta quando armazenamento > 90%
  },
  queryThresholds: {
    slowQueryMs: 1000, // Alerta para queries mais lentas que 1s
    maxConcurrentQueries: 50, // Máximo de queries concorrentes
  },
};

// Configurações de rate limiting
const RATE_LIMIT_CONFIG = {
  maxRequestsPerMinute: 100,
  maxRequestsPerHour: 1000,
  maxRequestsPerDay: 10000,
};

// Função para criar backup
export async function createBackup() {
  const { data, error } = await supabase.rpc('create_backup');
  if (error) throw error;
  return data;
}

// Função para listar backups
export async function listBackups() {
  try {
    logger.debug('Listando backups', { projectId }, { context: 'Backup' });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      logger.error('Usuário não autenticado', { context: 'Backup' });
      throw new Error('Usuário não autenticado');
    }

    logger.info('Usuário autenticado', { session }, { context: 'Backup' });

    // Verificar se o usuário tem permissão de admin
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profileError) {
      logger.error('Erro ao verificar perfil', { error: profileError }, { context: 'Backup' });
      throw new Error('Erro ao verificar perfil do usuário');
    }

    if (profileData?.role !== 'admin') {
      logger.error('Usuário não é admin', { context: 'Backup' });
      throw new Error('Acesso negado: usuário não é admin');
    }

    const { data, error } = await supabase
      .from('backups')
      .select('id, path, created_at, size, status')
      .order('created_at', { ascending: false });

    if (error) {
      logger.error('Erro ao listar backups', { error }, { context: 'Backup', showToast: true });
      throw new Error(error.message);
    }

    logger.info('Backups encontrados', { count: data?.length || 0 }, { context: 'Backup' });
    return data || [];
  } catch (error: any) {
    logger.error('Erro ao listar backups', { error }, { context: 'Backup', showToast: true });
    throw new Error(error.message || 'Erro ao listar backups');
  }
}

// Função para limpar backups antigos
export async function cleanupOldBackups() {
  const { data, error } = await supabase.rpc('cleanup_old_backups');
  if (error) throw error;
  return data;
}

// Função para monitorar recursos
export async function monitorResources() {
  const { data, error } = await supabase.rpc('monitor_resources');
  if (error) throw error;
  return data;
}

// Função para monitorar performance de queries
export async function monitorQueryPerformance() {
  const { data, error } = await supabase.rpc('monitor_query_performance');
  if (error) throw error;
  return data;
}

// Função para verificar rate limiting
export async function checkRateLimit(userId: string) {
  const { data, error } = await supabase.rpc('check_rate_limit', {
    p_user_id: userId
  });
  if (error) throw error;
  return data;
}

// Função para excluir um backup
export async function deleteBackup(id: string) {
  try {
    const { error } = await supabase
      .from('backups')
      .delete()
      .eq('id', id);

    if (error) {
      logger.error('Erro ao excluir backup', { error, backupId: id }, { context: 'Backup', showToast: true });
      throw new Error(error.message);
    }
  } catch (error: any) {
    logger.error('Erro ao excluir backup', { error }, { context: 'Backup', showToast: true });
    throw new Error(error.message || 'Erro ao excluir backup');
  }
}

// Função para baixar um backup
export async function downloadBackup(id: string) {
  try {
    const { data, error } = await supabase
      .from('backups')
      .select('path')
      .eq('id', id)
      .single();

    if (error) {
      logger.error('Erro ao baixar backup', { error }, { context: 'Backup', showToast: true });
      throw new Error(error.message);
    }

    if (!data?.path) {
      throw new Error('Caminho do backup não encontrado');
    }

    // Abrir o link do backup em uma nova aba
    window.open(data.path, '_blank');
  } catch (error: any) {
    logger.error('Erro ao baixar backup', { error }, { context: 'Backup', showToast: true });
    throw new Error(error.message || 'Erro ao baixar backup');
  }
}

// Função para exportar dados em JSON
export async function exportData() {
  try {
    logger.debug('Iniciando exportação de dados', { context: 'Backup' });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Usuário não autenticado');
    }

    // Verificar se o usuário é admin
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profileError || profileData?.role !== 'admin') {
      throw new Error('Acesso negado: usuário não é admin');
    }

    // Coletar dados de todas as tabelas
    const tables = [
      'projects',
      'tasks',
      'team_members',
      'comments',
      'attachments'
    ];

    const exportData: Record<string, any[]> = {};
    
    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*');

      if (error) {
        logger.error(`Erro ao exportar tabela ${table}`, { error }, { context: 'Backup' });
        continue;
      }

      exportData[table] = data || [];
    }

    // Criar arquivo JSON
    const jsonData = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    // Criar link para download
    const link = document.createElement('a');
    link.href = url;
    link.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    logger.info('Backup exportado com sucesso', { context: 'Backup' });
    return true;
  } catch (error: any) {
    logger.error('Erro ao exportar dados', { error }, { context: 'Backup', showToast: true });
    toast.error('Erro ao exportar dados: ' + error.message);
    throw error;
  }
}

// Função para importar dados de um arquivo JSON
export async function importData(file: File) {
  try {
    logger.debug('Iniciando importação de dados', { context: 'Backup' });
    
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      throw new Error('Usuário não autenticado');
    }

    // Verificar se o usuário é admin
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', session.user.id)
      .single();

    if (profileError || profileData?.role !== 'admin') {
      throw new Error('Acesso negado: usuário não é admin');
    }

    // Ler arquivo JSON
    const text = await file.text();
    const importData = JSON.parse(text);

    // Importar dados para cada tabela
    for (const [table, data] of Object.entries(importData)) {
      if (Array.isArray(data) && data.length > 0) {
        const { error } = await supabase
          .from(table)
          .upsert(data, { onConflict: 'id' });

        if (error) {
          logger.error(`Erro ao importar tabela ${table}`, { error }, { context: 'Backup' });
          throw new Error(`Erro ao importar tabela ${table}: ${error.message}`);
        }
      }
    }

    logger.info('Dados importados com sucesso', { context: 'Backup' });
    return true;
  } catch (error: any) {
    logger.error('Erro ao importar dados', { error }, { context: 'Backup', showToast: true });
    toast.error('Erro ao importar dados: ' + error.message);
    throw error;
  }
} 