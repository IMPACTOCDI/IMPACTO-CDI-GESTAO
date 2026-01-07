import { useState, useEffect } from 'react';
import { useCreateContact, useUpdateContact, useLinkContactToProject, useUnlinkContactFromProject, type ContactInsert } from '@/hooks/useContactMutations';
import { useProject } from '@/contexts/ProjectContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import type { Contact } from '@/hooks/useContactQueries';

interface ContactDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
}

const ContactDialog = ({ open, onOpenChange, contact }: ContactDialogProps) => {
  const createContact = useCreateContact();
  const updateContact = useUpdateContact();
  const linkContactToProject = useLinkContactToProject();
  const unlinkContactFromProject = useUnlinkContactFromProject();
  const { projects } = useProject();
  
  const [formData, setFormData] = useState<ContactInsert & { selectedProjects: string[]; projectRole: string }>({
    name: '',
    email: '',
    phone: '',
    company: '',
    position: '',
    notes: '',
    selectedProjects: [],
    projectRole: '',
  });

  const [isLoading, setIsLoading] = useState(false);

  // Resetar formulário quando o diálogo abrir/fechar ou contato mudar
  useEffect(() => {
    if (open) {
      if (contact) {
        const projectIds = contact.projects?.map(p => p.project_id) || [];
        if (process.env.NODE_ENV === 'development') {
          console.log('Carregando contato para edição:', {
            contactId: contact.id,
            contactName: contact.name,
            projects: contact.projects,
            projectIds,
          });
        }
        setFormData({
          name: contact.name || '',
          email: contact.email || '',
          phone: contact.phone || '',
          company: contact.company || '',
          position: contact.position || '',
          notes: contact.notes || '',
          selectedProjects: projectIds,
          projectRole: '',
        });
      } else {
        setFormData({
          name: '',
          email: '',
          phone: '',
          company: '',
          position: '',
          notes: '',
          selectedProjects: [],
          projectRole: '',
        });
      }
    }
  }, [open, contact]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { selectedProjects, projectRole, ...contactData } = formData;
      
      let contactId: string;

      if (contact) {
        // Atualizar contato existente
        const updated = await updateContact.mutateAsync({
          id: contact.id,
          ...contactData,
        });
        contactId = updated.id;
      } else {
        // Criar novo contato
        const created = await createContact.mutateAsync(contactData);
        contactId = created.id;
      }

      // Gerenciar vinculação de projetos
      if (contact) {
        // Edição: comparar projetos existentes com selecionados
        const existingProjectIds = contact.projects?.map(p => p.project_id) || [];
        
        if (process.env.NODE_ENV === 'development') {
          console.log('Gerenciando vinculações de projetos:', {
            contactId,
            existingProjectIds,
            selectedProjects,
          });
        }
        
        // Projetos que foram removidos (estavam vinculados mas não estão mais selecionados)
        const projectsToRemove = existingProjectIds.filter(id => !selectedProjects.includes(id));
        
        // Projetos que foram adicionados (não estavam vinculados mas agora estão selecionados)
        const projectsToAdd = selectedProjects.filter(id => !existingProjectIds.includes(id));
        
        // Remover projetos desvinculados
        if (projectsToRemove.length > 0) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Removendo projetos:', projectsToRemove);
          }
          await Promise.all(
            projectsToRemove.map(projectId =>
              unlinkContactFromProject.mutateAsync({
                projectId,
                contactId,
              }).catch((error: any) => {
                console.error('Erro ao desvincular projeto:', error);
                throw error; // Lançar erro para que o usuário saiba
              })
            )
          );
        }
        
        // Adicionar novos projetos vinculados
        if (projectsToAdd.length > 0) {
          if (process.env.NODE_ENV === 'development') {
            console.log('Adicionando projetos:', projectsToAdd);
          }
          await Promise.all(
            projectsToAdd.map(projectId =>
              linkContactToProject.mutateAsync({
                project_id: projectId,
                contact_id: contactId,
                role: projectRole || null,
                notes: null,
              }).catch((error: any) => {
                // Ignorar erro se já estiver vinculado (constraint unique)
                if (error.code !== '23505') {
                  console.error('Erro ao vincular projeto:', error);
                  throw error;
                }
              })
            )
          );
        }
      } else {
        // Criação: apenas adicionar projetos selecionados
        if (selectedProjects.length > 0) {
          await Promise.all(
            selectedProjects.map(projectId =>
              linkContactToProject.mutateAsync({
                project_id: projectId,
                contact_id: contactId,
                role: projectRole || null,
                notes: null,
              }).catch((error: any) => {
                // Ignorar erro se já estiver vinculado (constraint unique)
                if (error.code !== '23505') {
                  console.error('Erro ao vincular projeto:', error);
                  throw error;
                }
              })
            )
          );
        }
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Erro ao salvar contato:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleProjectToggle = (projectId: string) => {
    setFormData(prev => ({
      ...prev,
      selectedProjects: prev.selectedProjects.includes(projectId)
        ? prev.selectedProjects.filter(id => id !== projectId)
        : [...prev.selectedProjects, projectId],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{contact ? 'Editar Contato' : 'Criar Novo Contato'}</DialogTitle>
          <DialogDescription className="sr-only">
            {contact ? 'Edite as informações do contato.' : 'Preencha os campos para criar um novo contato.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Digite o nome do contato"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="email@exemplo.com"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(00) 00000-0000"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="company">Empresa</Label>
              <Input
                id="company"
                name="company"
                value={formData.company || ''}
                onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                placeholder="Nome da empresa"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Cargo</Label>
            <Input
              id="position"
              name="position"
              value={formData.position || ''}
              onChange={(e) => setFormData({ ...formData, position: e.target.value })}
              placeholder="Cargo do contato"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              name="notes"
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Adicione observações sobre o contato"
              rows={3}
            />
          </div>

          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label>Vincular a Projetos</Label>
              <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                {projects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum projeto disponível</p>
                ) : (
                  projects.map((project) => (
                    <div key={project.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`project-${project.id}`}
                        checked={formData.selectedProjects.includes(project.id)}
                        onCheckedChange={() => handleProjectToggle(project.id)}
                      />
                      <Label
                        htmlFor={`project-${project.id}`}
                        className="text-sm font-normal cursor-pointer flex-1"
                      >
                        {project.name}
                      </Label>
                    </div>
                  ))
                )}
              </div>
            </div>

            {formData.selectedProjects.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="projectRole">Função nos Projetos (opcional)</Label>
                <Input
                  id="projectRole"
                  name="projectRole"
                  value={formData.projectRole}
                  onChange={(e) => setFormData({ ...formData, projectRole: e.target.value })}
                  placeholder="Ex: Cliente, Fornecedor, Parceiro..."
                />
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : contact ? 'Atualizar' : 'Criar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ContactDialog;

