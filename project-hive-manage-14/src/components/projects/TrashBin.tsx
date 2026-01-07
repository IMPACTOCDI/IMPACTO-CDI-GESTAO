import React from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Trash2, RotateCcw, X, Trash } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

const TrashBin = () => {
  const {
    deletedProjects,
    restoreProject,
    permanentlyDeleteProject,
    clearTrash
  } = useProject();

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Ativo';
      case 'completed':
        return 'Concluído';
      case 'on-hold':
        return 'Pausado';
      default:
        return status;
    }
  };

  if (deletedProjects.length === 0) {
    return (
      <div className="text-center py-8">
        <Trash2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium mb-2 text-foreground">Lixeira vazia</h3>
        <p className="text-muted-foreground">Nenhum projeto foi excluído recentemente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Lixeira</h2>
          <p className="text-muted-foreground">Projetos excluídos recentemente</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge>{deletedProjects.length} projetos</Badge>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="flex items-center gap-2">
                <Trash className="h-4 w-4" />
                Limpar Lixeira
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar Lixeira</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta ação não pode ser desfeita. Todos os projetos na lixeira serão permanentemente removidos do sistema.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => clearTrash()} 
                  className="bg-red-600 hover:bg-red-700"
                >
                  Limpar Lixeira
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {deletedProjects.map(project => (
          <Card key={project.id} className="opacity-75">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2 flex-1 min-w-0">
                  <div className={`w-4 h-4 rounded-full ${project.color} opacity-50`}></div>
                  <CardTitle className="text-lg truncate">{project.name}</CardTitle>
                </div>
                <Badge>{getStatusText(project.status)}</Badge>
              </div>
              <CardDescription className="line-clamp-2">
                {project.description}
              </CardDescription>
              <p className="text-xs text-muted-foreground">
                Excluído em: {new Date(project.deleted_at!).toLocaleString('pt-BR')}
              </p>
            </CardHeader>
            <CardContent className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => restoreProject(project.id)} 
                className="flex-1"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Restaurar
              </Button>
              
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" className="flex-1">
                    <X className="mr-2 h-4 w-4" />
                    Excluir Permanentemente
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir Permanentemente</AlertDialogTitle>
                    <AlertDialogDescription>
                      Esta ação não pode ser desfeita. O projeto "{project.name}" será permanentemente removido do sistema.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={() => permanentlyDeleteProject(project.id)} 
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Excluir Permanentemente
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default TrashBin;
