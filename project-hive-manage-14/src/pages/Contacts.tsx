import { useState } from 'react';
import { useContacts } from '@/hooks/useContactQueries';
import { useDeleteContact, useUnlinkContactFromProject } from '@/hooks/useContactMutations';
import { useProject } from '@/contexts/ProjectContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Plus, Search, Edit, Trash2, Building2, Mail, Phone, User, Download, ChevronDown, Filter, X } from 'lucide-react';
import ContactDialog from '@/components/contacts/ContactDialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { supabase } from '@/lib/supabase';

export default function Contacts() {
  const { data: contacts = [], isLoading, error } = useContacts();
  const { projects } = useProject();
  const deleteContact = useDeleteContact();
  const unlinkContact = useUnlinkContactFromProject();
  
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [contactToDelete, setContactToDelete] = useState<string | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const filteredContacts = contacts.filter(contact => {
    // Filtro por termo de busca
    const matchesSearch = 
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.company?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Filtro por projetos selecionados
    if (selectedProjects.length > 0) {
      const contactProjectIds = contact.projects?.map(p => p.project_id) || [];
      const hasSelectedProject = selectedProjects.some(projectId => 
        contactProjectIds.includes(projectId)
      );
      return hasSelectedProject;
    }

    return true;
  });

  const handleProjectFilterToggle = (projectId: string) => {
    setSelectedProjects(prev =>
      prev.includes(projectId)
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const clearFilters = () => {
    setSelectedProjects([]);
    setSearchTerm('');
  };

  const handleEdit = (contact: any) => {
    setSelectedContact(contact);
    setIsDialogOpen(true);
  };

  const handleCreate = () => {
    setSelectedContact(null);
    setIsDialogOpen(true);
  };

  const handleDelete = (contactId: string) => {
    setContactToDelete(contactId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!contactToDelete) return;

    try {
      await deleteContact.mutateAsync(contactToDelete);
      setDeleteDialogOpen(false);
      setContactToDelete(null);
    } catch (error) {
      console.error('Erro ao deletar contato:', error);
    }
  };

  const handleUnlinkProject = async (projectId: string, contactId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await unlinkContact.mutateAsync({ projectId, contactId });
    } catch (error) {
      console.error('Erro ao desvincular projeto:', error);
    }
  };

  const exportAllContacts = () => {
    try {
      const contactsData = [
        ['Relatório de Contatos'],
        ['Data de geração:', new Date().toLocaleString('pt-BR')],
        ['Total de contatos:', contacts.length],
        [''],
        ['Nome', 'Email', 'Telefone', 'Empresa', 'Cargo', 'Projetos Vinculados', 'Função nos Projetos', 'Observações', 'Data de Criação']
      ];

      contacts.forEach(contact => {
        const projectNames = contact.projects?.map(p => p.project?.name || 'Projeto').join(', ') || 'Nenhum';
        const projectRoles = contact.projects?.map(p => p.role || '').filter(Boolean).join(', ') || '';

        contactsData.push([
          contact.name || '',
          contact.email || '',
          contact.phone || '',
          contact.company || '',
          contact.position || '',
          projectNames,
          projectRoles,
          contact.notes || '',
          contact.created_at ? new Date(contact.created_at).toLocaleDateString('pt-BR') : ''
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(contactsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Contatos');

      // Ajustar largura das colunas
      const wscols = [
        { wch: 30 }, // Nome
        { wch: 35 }, // Email
        { wch: 20 }, // Telefone
        { wch: 25 }, // Empresa
        { wch: 20 }, // Cargo
        { wch: 40 }, // Projetos Vinculados
        { wch: 25 }, // Função nos Projetos
        { wch: 50 }, // Observações
        { wch: 18 }  // Data de Criação
      ];
      ws['!cols'] = wscols;

      const fileName = `Contatos_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Contatos exportados com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar contatos:', error);
      toast.error('Erro ao exportar contatos');
    }
  };

  const exportContactsByProject = async (projectId: string) => {
    try {
      const project = projects.find(p => p.id === projectId);
      if (!project) {
        toast.error('Projeto não encontrado');
        return;
      }

      // Buscar contatos do projeto
      const { data: projectContactsData, error: projectError } = await supabase
        .from('project_contacts')
        .select(`
          *,
          contacts (*),
          projects (id, name)
        `)
        .eq('project_id', projectId);

      if (projectError) throw projectError;

      const contactsData = [
        [`Contatos do Projeto: ${project.name}`],
        ['Data de geração:', new Date().toLocaleString('pt-BR')],
        ['Total de contatos:', projectContactsData?.length || 0],
        [''],
        ['Nome', 'Email', 'Telefone', 'Empresa', 'Cargo', 'Função no Projeto', 'Observações', 'Data de Criação']
      ];

      projectContactsData?.forEach((pc: any) => {
        const contact = pc.contacts;
        if (contact) {
          contactsData.push([
            contact.name || '',
            contact.email || '',
            contact.phone || '',
            contact.company || '',
            contact.position || '',
            pc.role || '',
            contact.notes || '',
            contact.created_at ? new Date(contact.created_at).toLocaleDateString('pt-BR') : ''
          ]);
        }
      });

      const ws = XLSX.utils.aoa_to_sheet(contactsData);
      const wb = XLSX.utils.book_new();
      
      // Nome da aba (limitado a 31 caracteres)
      const cleanProjectName = project.name
        .replace(/[:\\\/\?\*\[\]]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      
      const sheetName = cleanProjectName.length > 31 
        ? cleanProjectName.substring(0, 28) + '...' 
        : cleanProjectName || 'Projeto';

      XLSX.utils.book_append_sheet(wb, ws, sheetName);

      // Ajustar largura das colunas
      const wscols = [
        { wch: 30 }, // Nome
        { wch: 35 }, // Email
        { wch: 20 }, // Telefone
        { wch: 25 }, // Empresa
        { wch: 20 }, // Cargo
        { wch: 25 }, // Função no Projeto
        { wch: 50 }, // Observações
        { wch: 18 }  // Data de Criação
      ];
      ws['!cols'] = wscols;

      const fileName = `Contatos_${cleanProjectName}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      toast.success('Contatos do projeto exportados com sucesso!');
    } catch (error) {
      console.error('Erro ao exportar contatos do projeto:', error);
      toast.error('Erro ao exportar contatos do projeto');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="text-center py-8">
          <p className="text-red-500">Erro ao carregar contatos. Tente novamente.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Contatos</h1>
          <p className="text-muted-foreground">
            Gerencie seus contatos e vincule-os a projetos
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Exportar
                <ChevronDown className="h-4 w-4 ml-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={exportAllContacts}>
                Exportar Todos os Contatos
              </DropdownMenuItem>
              {projects.length > 0 && (
                <>
                  <div className="h-px bg-border my-1" />
                  <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                    Exportar por Projeto
                  </div>
                  {projects.map((project) => (
                    <DropdownMenuItem
                      key={project.id}
                      onClick={() => exportContactsByProject(project.id)}
                    >
                      {project.name}
                    </DropdownMenuItem>
                  ))}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Contato
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar contatos..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="mr-2 h-4 w-4" />
          Filtros
          {selectedProjects.length > 0 && (
            <Badge variant="secondary" className="ml-2">
              {selectedProjects.length}
            </Badge>
          )}
        </Button>
        {(selectedProjects.length > 0 || searchTerm) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
          >
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      {/* Painel de Filtros */}
      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent>
          <Card className="p-4">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold mb-3 block">Filtrar por Projetos</Label>
                <div className="space-y-2 max-h-[200px] overflow-y-auto border rounded-md p-3">
                  {projects.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum projeto disponível</p>
                  ) : (
                    projects.map((project) => (
                      <div key={project.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`filter-project-${project.id}`}
                          checked={selectedProjects.includes(project.id)}
                          onCheckedChange={() => handleProjectFilterToggle(project.id)}
                        />
                        <Label
                          htmlFor={`filter-project-${project.id}`}
                          className="text-sm font-normal cursor-pointer flex-1"
                        >
                          {project.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {filteredContacts.map((contact) => (
          <Card key={contact.id} className="hover:bg-accent/50 transition-colors">
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <User className="h-5 w-5" />
                    {contact.name}
                  </CardTitle>
                  {contact.position && (
                    <p className="text-sm text-muted-foreground mt-1">{contact.position}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(contact)}
                    className="h-8 w-8 p-0"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(contact.id)}
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                {contact.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{contact.email}</span>
                  </div>
                )}
                {contact.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{contact.phone}</span>
                  </div>
                )}
                {contact.company && (
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-muted-foreground">{contact.company}</span>
                  </div>
                )}
              </div>

              {contact.projects && contact.projects.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs font-medium text-muted-foreground mb-2">Projetos:</p>
                  <div className="flex flex-wrap gap-1">
                    {contact.projects.map((projectContact) => (
                      <Link
                        key={projectContact.id}
                        to={`/projects/${projectContact.project_id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Badge
                          variant="secondary"
                          className="cursor-pointer hover:bg-secondary/80"
                        >
                          {projectContact.project?.name || 'Projeto'}
                        </Badge>
                      </Link>
                    ))}
                  </div>
                </div>
              )}

              {contact.notes && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground line-clamp-2">{contact.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {filteredContacts.length === 0 && (
          <div className="col-span-full text-center py-8">
            <p className="text-muted-foreground">
              {searchTerm || selectedProjects.length > 0 
                ? 'Nenhum contato encontrado com os filtros aplicados.' 
                : 'Nenhum contato cadastrado.'}
            </p>
          </div>
        )}
      </div>

      <ContactDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setSelectedContact(null);
          }
        }}
        contact={selectedContact}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este contato? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

