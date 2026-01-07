import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, Users, Calendar, MoreVertical, Trash2, Eye, EyeOff, Settings, Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import ProjectDialog from './ProjectDialog';
import TrashBin from './TrashBin';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { supabase } from '@/lib/supabase';
import { Database } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

type Project = {
  id: string;
  name: string;
  description: string | null;
  status: 'active' | 'completed' | 'on-hold';
  visibility: 'public' | 'private';
  color: string;
  start_date: string | null;
  end_date: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  members?: Database['public']['Tables']['project_members']['Row'][];
  tasks?: Task[];
  creator?: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
    role: string;
    status: string;
  };
};

type Task = Database['public']['Tables']['tasks']['Row'] & {
  status: string;
  priority: string;
  due_date: string | null;
  assigned_to: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

const Projects = () => {
  const {
    projects,
    deleteProject,
    deletedProjects
  } = useProject();
  const {
    user,
    hasPermission
  } = useAuth();
  const location = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(location.state?.openProjectDialog === true);
  
  // Estado para filtros
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  
  // Limpar o state após usar para evitar problemas em navegações futuras
  useEffect(() => {
    if (location.state?.openProjectDialog) {
      // Limpar o state para evitar que o diálogo abra novamente em navegações futuras
      // Usamos setTimeout para garantir que o diálogo seja aberto antes de limpar o state
      setTimeout(() => {
        window.history.replaceState({}, document.title);
      }, 100);
    }
  }, [location.state]);
  const [authors, setAuthors] = useState<Record<string, { name: string }>>({});
  const [canDeleteMap, setCanDeleteMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const fetchAuthors = async () => {
      if (!projects.length) return;
      
      const authorIds = [...new Set(projects.map(project => project.created_by))];
      if (authorIds.length === 0) return;

      const { data, error } = await supabase
        .from('profiles')
        .select('id, name')
        .in('id', authorIds);

      if (error) return;

      const authorsMap = data.reduce((acc, profile) => {
        acc[profile.id] = profile;
        return acc;
      }, {});
      setAuthors(authorsMap);
    };

    fetchAuthors();
  }, [projects]);

  useEffect(() => {
    const checkDeletePermissions = async () => {
      const permissions: Record<string, boolean> = {};
      for (const project of projects) {
        permissions[project.id] = await hasPermission('delete_any_project') || project.created_by === user?.id;
      }
      setCanDeleteMap(permissions);
    };

    if (user) {
      checkDeletePermissions();
    }
  }, [projects, user, hasPermission]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'completed':
        return 'bg-blue-500';
      case 'on_hold':
        return 'bg-yellow-500';
      case 'cancelled':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getProgress = (project: Project) => {
    if (!project.tasks || project.tasks.length === 0) return 0;
    const completedTasks = project.tasks.filter(task => task.status === 'completed').length;
    return Math.round((completedTasks / project.tasks.length) * 100);
  };

  // Funções para gerenciar filtros
  const toggleProjectSelection = (projectId: string) => {
    setSelectedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    );
  };

  const selectAllProjects = () => {
    setSelectedProjects(projects.map(p => p.id));
  };

  const clearAllProjects = () => {
    setSelectedProjects([]);
  };

  const clearFilters = () => {
    setSelectedProjects([]);
    setSearchTerm('');
  };

  // Aplicar filtros
  const filteredProjects = projects.filter(project => {
    // Filtro por projetos selecionados
    if (selectedProjects.length > 0 && !selectedProjects.includes(project.id)) {
      return false;
    }

    // Filtro por termo de busca
    if (searchTerm) {
      return project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
             (project.description && project.description.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    return true;
  });

  return <div className="space-y-4 md:space-y-6 px-4 md:px-6 lg:px-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
        <div className="text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-bold text-slate-50">Projetos</h1>
          <p className="text-sm md:text-base text-slate-50">
            Gerencie todos os seus projetos
            {user?.role === 'admin' && ' (Visualização Administrativa)'}
          </p>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <Button 
            variant="outline" 
            onClick={() => setShowFilters(!showFilters)}
            className="w-full md:w-auto"
          >
            <Filter className="mr-2 h-4 w-4" />
            Filtros
            {selectedProjects.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {selectedProjects.length}
              </Badge>
            )}
          </Button>
          {user && <Button onClick={() => setIsDialogOpen(true)} className="bg-gradient-to-r from-custom-blue-600 to-white hover:from-custom-blue-700 hover:to-gray-100 text-white w-full md:w-auto">
              <Plus className="mr-2 h-4 w-4" />
              Novo Projeto
            </Button>}
        </div>
      </div>

      {/* Painel de Filtros */}
      <Collapsible open={showFilters} onOpenChange={setShowFilters}>
        <CollapsibleContent className="space-y-4">
          <Card className="bg-slate-800/50 border-slate-700">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg text-slate-50">Filtros de Projetos</CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-slate-400 hover:text-slate-200"
                >
                  <X className="h-4 w-4 mr-1" />
                  Limpar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Busca por texto */}
              <div className="space-y-2">
                <Label htmlFor="search" className="text-slate-200">Buscar projetos</Label>
                <Input
                  id="search"
                  placeholder="Digite o nome ou descrição do projeto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-700 border-slate-600 text-slate-100 placeholder:text-slate-400"
                />
              </div>

              {/* Seleção de projetos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-slate-200">Selecionar projetos específicos</Label>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={selectAllProjects}
                      className="text-xs"
                    >
                      Todos
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={clearAllProjects}
                      className="text-xs"
                    >
                      Nenhum
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                  {projects.map(project => (
                    <div key={project.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`project-${project.id}`}
                        checked={selectedProjects.includes(project.id)}
                        onCheckedChange={() => toggleProjectSelection(project.id)}
                        className="border-slate-600"
                      />
                      <Label 
                        htmlFor={`project-${project.id}`}
                        className="text-sm text-slate-200 cursor-pointer flex-1 truncate"
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded-full ${project.color || 'bg-gray-400'}`}></div>
                          {project.name}
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resumo dos filtros */}
              {(selectedProjects.length > 0 || searchTerm) && (
                <div className="pt-3 border-t border-slate-600">
                  <div className="text-sm text-slate-300">
                    <strong>Filtros ativos:</strong>
                    {selectedProjects.length > 0 && (
                      <span className="ml-2">
                        {selectedProjects.length} projeto(s) selecionado(s)
                      </span>
                    )}
                    {searchTerm && (
                      <span className="ml-2">
                        Busca: "{searchTerm}"
                      </span>
                    )}
                    <span className="ml-2 text-slate-400">
                      ({filteredProjects.length} de {projects.length} projetos)
                    </span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="active">
            Projetos Ativos ({filteredProjects.length})
            {filteredProjects.length !== projects.length && (
              <span className="ml-1 text-xs text-muted-foreground">
                (filtrados de {projects.length})
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="trash" className="flex items-center">
            <Trash2 className="mr-2 h-4 w-4" />
            Lixeira ({deletedProjects.length})
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="active" className="space-y-4">
          {filteredProjects.length === 0 ? (
            <Card className="text-center py-8">
              <CardContent>
                <div className="text-muted-foreground">
                  {projects.length === 0 ? (
                    <>
                      <p className="text-lg mb-2">Nenhum projeto encontrado</p>
                      <p className="text-sm">Crie seu primeiro projeto para começar!</p>
                    </>
                  ) : (
                    <>
                      <p className="text-lg mb-2">Nenhum projeto corresponde aos filtros</p>
                      <p className="text-sm">Tente ajustar os filtros ou limpar a busca</p>
                      <Button 
                        variant="outline" 
                        onClick={clearFilters}
                        className="mt-4"
                      >
                        Limpar Filtros
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
              {filteredProjects.map(project => {
            return <Card key={project.id} className="hover:shadow-lg transition-shadow group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <div className={`w-4 h-4 rounded-full ${project.color || 'bg-gray-400 opacity-50'}`}></div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base md:text-lg truncate">{project.name}</CardTitle>
                          <div className="flex items-center space-x-2 mt-1">
                            <Badge variant="outline" className="text-xs">
                              {project.visibility === 'public' ? <><Eye className="mr-1 h-3 w-3" /> Público</> : <><EyeOff className="mr-1 h-3 w-3" /> Privado</>}
                            </Badge>
                            {user?.role === 'admin' && <span className="text-xs text-gray-500">
                                por {authors[project.created_by]?.name || 'Usuário'}
                              </span>}
                          </div>
                        </div>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Settings className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link to={`/projects/${project.id}`}>Ver Detalhes</Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link to={`/projects/${project.id}/kanban`}>Abrir Kanban</Link>
                          </DropdownMenuItem>
                          {canDeleteMap[project.id] && (
                            <DropdownMenuItem onClick={() => deleteProject(project.id)} className="text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" />
                              Mover para Lixeira
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <CardDescription className="line-clamp-2 text-sm">
                      {project.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="secondary" className={getStatusColor(project.status)}>
                            {project.status}
                          </Badge>
                          <Badge variant="outline">
                            {project.visibility}
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center text-gray-500">
                        <Users className="mr-1 h-4 w-4" />
                        {(project.members?.length ?? 0)}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-50">Progresso</span>
                        <span className="font-medium">{getProgress(project)}%</span>
                      </div>
                      <Progress value={getProgress(project)} className="h-2" />
                      <div className="text-xs text-gray-500 bg-transparent">
                        {(project.tasks?.filter(t => t.status === 'completed').length ?? 0)} de {(project.tasks?.length ?? 0)} tarefas concluídas
                      </div>
                    </div>

                    {project.end_date && (
                      <div className="flex items-center text-sm text-gray-500">
                        <Calendar className="mr-1 h-4 w-4" />
                        <span className="truncate">Prazo: {new Date(project.end_date).toLocaleDateString('pt-BR')}</span>
                      </div>
                    )}

                    <div className="flex flex-col md:flex-row space-y-2 md:space-y-0 md:space-x-2 pt-2">
                      <Button asChild variant="outline" size="sm" className="flex-1">
                        <Link to={`/projects/${project.id}`}>Ver Detalhes</Link>
                      </Button>
                      <Button asChild size="sm" className="flex-1 bg-gradient-to-r from-custom-blue-600 to-white text-white hover:from-custom-blue-700 hover:to-gray-100">
                        <Link to={`/projects/${project.id}/kanban`}>Kanban</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>;
              })}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="trash">
          <TrashBin />
        </TabsContent>
      </Tabs>

      <ProjectDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
    </div>;
};
export default Projects;
