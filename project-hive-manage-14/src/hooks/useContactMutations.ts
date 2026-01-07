import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';
import type { Contact, ProjectContact } from './useContactQueries';

export type ContactInsert = {
  name: string;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  position?: string | null;
  notes?: string | null;
};

export type ContactUpdate = Partial<ContactInsert>;

export type ProjectContactInsert = {
  project_id: string;
  contact_id: string;
  role?: string | null;
  notes?: string | null;
};

// Hook para criar contato
export function useCreateContact() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (contactData: ContactInsert) => {
      const { data, error } = await supabase
        .from('contacts')
        .insert([{
          ...contactData,
          created_by: user?.id || null,
        }])
        .select()
        .single();

      if (error) throw error;
      return data as Contact;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      toast.success('Contato criado com sucesso!');
      logger.info('Contato criado com sucesso', {}, { context: 'ContactMutations' });
    },
    onError: (error) => {
      toast.error('Erro ao criar contato. Tente novamente.');
      logger.error('Erro ao criar contato', { error }, { context: 'ContactMutations', showToast: true });
    },
  });
}

// Hook para atualizar contato
export function useUpdateContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...contactData }: ContactUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('contacts')
        .update(contactData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Contact;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['contact', data.id] });
      toast.success('Contato atualizado com sucesso!');
      logger.info('Contato atualizado com sucesso', { contactId: data.id }, { context: 'ContactMutations' });
    },
    onError: (error) => {
      toast.error('Erro ao atualizar contato. Tente novamente.');
      logger.error('Erro ao atualizar contato', { error }, { context: 'ContactMutations', showToast: true });
    },
  });
}

// Hook para deletar contato
export function useDeleteContact() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (contactId: string) => {
      const { error } = await supabase
        .from('contacts')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', contactId);

      if (error) throw error;
      return contactId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['project-contacts'] });
      toast.success('Contato deletado com sucesso!');
      logger.info('Contato deletado com sucesso', {}, { context: 'ContactMutations' });
    },
    onError: (error) => {
      toast.error('Erro ao deletar contato. Tente novamente.');
      logger.error('Erro ao deletar contato', { error }, { context: 'ContactMutations', showToast: true });
    },
  });
}

// Hook para vincular contato a projeto
export function useLinkContactToProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ProjectContactInsert) => {
      const { data: result, error } = await supabase
        .from('project_contacts')
        .insert([data])
        .select()
        .single();

      if (error) throw error;
      return result as ProjectContact;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['project-contacts', data.project_id] });
      queryClient.invalidateQueries({ queryKey: ['contact', data.contact_id] });
      toast.success('Contato vinculado ao projeto com sucesso!');
      logger.info('Contato vinculado ao projeto', { projectId: data.project_id, contactId: data.contact_id }, { context: 'ContactMutations' });
    },
    onError: (error) => {
      toast.error('Erro ao vincular contato ao projeto. Tente novamente.');
      logger.error('Erro ao vincular contato ao projeto', { error }, { context: 'ContactMutations', showToast: true });
    },
  });
}

// Hook para desvincular contato de projeto
export function useUnlinkContactFromProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, contactId }: { projectId: string; contactId: string }) => {
      const { error } = await supabase
        .from('project_contacts')
        .delete()
        .eq('project_id', projectId)
        .eq('contact_id', contactId);

      if (error) throw error;
      return { projectId, contactId };
    },
    onSuccess: ({ projectId, contactId }) => {
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['project-contacts', projectId] });
      queryClient.invalidateQueries({ queryKey: ['contact', contactId] });
      toast.success('Contato desvinculado do projeto com sucesso!');
      logger.info('Contato desvinculado do projeto', { projectId, contactId }, { context: 'ContactMutations' });
    },
    onError: (error) => {
      toast.error('Erro ao desvincular contato do projeto. Tente novamente.');
      logger.error('Erro ao desvincular contato do projeto', { error }, { context: 'ContactMutations', showToast: true });
    },
  });
}


