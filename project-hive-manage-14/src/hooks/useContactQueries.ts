import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

export type Contact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  position: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  projects?: ProjectContact[];
};

export type ProjectContact = {
  id: string;
  project_id: string;
  contact_id: string;
  role: string | null;
  notes: string | null;
  created_at: string;
  project?: {
    id: string;
    name: string;
  };
};

// Hook para buscar todos os contatos do usuário
export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: async () => {
      const { data: contacts, error: contactsError } = await supabase
        .from('contacts')
        .select('*')
        .is('deleted_at', null)
        .order('created_at', { ascending: false });

      if (contactsError) throw contactsError;

      // Buscar projetos vinculados para cada contato
      const contactsWithProjects = await Promise.all(
        (contacts || []).map(async (contact) => {
          const { data: projectContacts, error: projectError } = await supabase
            .from('project_contacts')
            .select(`
              *,
              projects (id, name)
            `)
            .eq('contact_id', contact.id);

          if (projectError) {
            console.error('Erro ao buscar projetos do contato:', projectError);
            return { ...contact, projects: [] };
          }

          // Garantir que os projetos estejam no formato correto
          // O Supabase retorna projects como objeto único na relação foreign key
          const formattedProjects = (projectContacts || []).map((pc: any) => {
            // Debug: verificar estrutura retornada
            if (process.env.NODE_ENV === 'development') {
              console.log('ProjectContact structure:', pc);
            }
            
            // Se projects vier como array (caso raro), pegar o primeiro
            // Caso contrário, usar diretamente como objeto
            let project = null;
            
            if (pc.projects) {
              if (Array.isArray(pc.projects)) {
                project = pc.projects.length > 0 ? pc.projects[0] : null;
              } else {
                project = pc.projects;
              }
            }
            
            return {
              ...pc,
              project: project,
            };
          });

          return {
            ...contact,
            projects: formattedProjects,
          } as Contact;
        })
      );

      return contactsWithProjects;
    },
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

// Hook para buscar contatos de um projeto específico
export function useProjectContacts(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-contacts', projectId],
    queryFn: async () => {
      if (!projectId) return [];

      const { data, error } = await supabase
        .from('project_contacts')
        .select(`
          *,
          contacts (*),
          projects (id, name)
        `)
        .eq('project_id', projectId);

      if (error) throw error;
      return data as (ProjectContact & { contacts: Contact; projects: { id: string; name: string } })[];
    },
    enabled: !!projectId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

// Hook para buscar um contato específico com seus projetos
export function useContact(contactId: string | undefined) {
  return useQuery({
    queryKey: ['contact', contactId],
    queryFn: async () => {
      if (!contactId) return null;

      const { data: contact, error: contactError } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .is('deleted_at', null)
        .single();

      if (contactError) throw contactError;

      const { data: projectContacts, error: projectError } = await supabase
        .from('project_contacts')
        .select(`
          *,
          projects (id, name)
        `)
        .eq('contact_id', contactId);

      if (projectError) throw projectError;

      return {
        ...contact,
        projects: projectContacts,
      } as Contact & { projects: ProjectContact[] };
    },
    enabled: !!contactId,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });
}

