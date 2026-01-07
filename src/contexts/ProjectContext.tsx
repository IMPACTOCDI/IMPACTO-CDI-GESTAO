import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { Database } from '@/types/supabase';
import { logger } from '@/lib/logger';
import { toast } from 'react-hot-toast';

const addProjectMember = async (member: Database['public']['Tables']['project_members']['Insert']) => {
  logger.debug('Adicionando membro ao projeto', { member, context: 'ProjectContext' });
  try {
    // Primeiro, inserir o membro
    const { data: memberData, error: insertError } = await supabase
      .from('project_members')
      .insert({
        project_id: member.project_id,
        user_id: member.user_id,
        role: member.role
      })
      .select('*')
      .single();

    if (insertError) {
      logger.error('Erro ao inserir membro', { 
        error: insertError, 
        projectId: member.project_id,
        userId: member.user_id,
        context: 'ProjectContext' 
      });
      throw insertError;
    }

    // Depois, buscar o perfil
    const { data: profileData, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', member.user_id)
      .single();

    if (profileError) {
      logger.error('Erro ao buscar perfil', { 
        error: profileError, 
        userId: member.user_id,
        context: 'ProjectContext' 
      });
      throw profileError;
    }

    // Combinar os dados
    const result = {
      ...memberData,
      profiles: profileData
    };

    logger.info('Membro adicionado com sucesso', { 
      projectId: member.project_id,
      userId: member.user_id,
      context: 'ProjectContext' 
    });
    toast.success('Membro adicionado com sucesso!');
    return result;
  } catch (error: any) {
    logger.error('Erro ao adicionar membro', { 
      error: error.message, 
      projectId: member.project_id,
      userId: member.user_id,
      context: 'ProjectContext' 
    });
    toast.error('Erro ao adicionar membro: ' + error.message);
    throw error;
  }
}; 