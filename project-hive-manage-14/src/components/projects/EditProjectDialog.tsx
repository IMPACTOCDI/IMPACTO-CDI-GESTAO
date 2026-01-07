import * as React from 'react';
import { useState, useEffect } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { Database } from '@/integrations/supabase/types';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

type Project = Database['public']['Tables']['projects']['Row'] & {
  status: 'active' | 'completed' | 'on-hold';
  visibility: 'public' | 'private';
  color: string;
  start_date: string | null;
  end_date: string | null;
};

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project;
}

const EditProjectDialog: React.FC<EditProjectDialogProps> = ({ 
  open, 
  onOpenChange, 
  project 
}) => {
  const { updateProject } = useProject();
  const [isLoading, setIsLoading] = useState(false);
  
  const validStatus = (status: string) => ['active', 'completed', 'on-hold'].includes(status) ? status as 'active' | 'completed' | 'on-hold' : 'active';
  const validVisibility = (visibility: string) => ['public', 'private'].includes(visibility) ? visibility as 'public' | 'private' : 'public';

  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    status: 'active' | 'completed' | 'on-hold';
    visibility: 'public' | 'private';
    start_date: string;
    end_date: string;
    color: string;
  }>({
    name: project.name,
    description: project.description || '',
    status: validStatus(project.status),
    visibility: validVisibility(project.visibility),
    start_date: project.start_date || '',
    end_date: project.end_date || '',
    color: project.color || 'bg-custom-blue-500'
  });

  // Função para verificar se há dados não salvos
  const hasUnsavedData = () => {
    return (
      formData.name !== project.name ||
      formData.description !== (project.description || '') ||
      formData.status !== validStatus(project.status) ||
      formData.visibility !== validVisibility(project.visibility) ||
      formData.start_date !== (project.start_date || '') ||
      formData.end_date !== (project.end_date || '') ||
      formData.color !== (project.color || 'bg-custom-blue-500')
    );
  };

  // Função para lidar com o fechamento do diálogo
  const handleDialogClose = (shouldClose: boolean) => {
    if (!shouldClose) return;
    
    if (hasUnsavedData()) {
      const shouldKeepData = window.confirm(
        'Você tem alterações não salvas. Deseja manter essas alterações ou descartá-las?\n\nOK = Manter alterações\nCancelar = Descartar alterações'
      );
      
      if (!shouldKeepData) {
        // Restaurar dados originais
        setFormData({
          name: project.name,
          description: project.description || '',
          status: validStatus(project.status),
          visibility: validVisibility(project.visibility),
          start_date: project.start_date || '',
          end_date: project.end_date || '',
          color: project.color || 'bg-custom-blue-500'
        });
      }
    }
    
    onOpenChange(false);
  };

  const colors = [
    'bg-custom-blue-500',
    'bg-green-500',
    'bg-blue-500',
    'bg-red-500',
    'bg-yellow-500',
    'bg-pink-500',
    'bg-indigo-500',
    'bg-orange-500'
  ];

  useEffect(() => {
    if (project && open) {
      logger.debug('Setting form data with project', { project, context: 'EditProjectDialog' });
      setFormData({
        name: project.name,
        description: project.description,
        status: validStatus(project.status),
        visibility: validVisibility(project.visibility),
        start_date: project.start_date || '',
        end_date: project.end_date || '',
        color: project.color || 'bg-custom-blue-500'
      });
    }
  }, [project, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    try {
      logger.debug('Updating project', { formData, projectId: project.id, context: 'EditProjectDialog' });
      
      const updateData = {
        name: formData.name,
        description: formData.description,
        status: formData.status,
        visibility: formData.visibility,
        color: formData.color
      };
      
      // Adicionar datas apenas se não estiverem vazias
      if (formData.start_date.trim() !== '') {
        updateData.start_date = formData.start_date;
      }
      
      if (formData.end_date.trim() !== '') {
        updateData.end_date = formData.end_date;
      }
      
      // Remover campos vazios
      const cleanUpdateData = Object.fromEntries(
        Object.entries(updateData).filter(([key, value]) => {
          return value !== null && value !== '';
        })
      );
      
      logger.debug('Clean update data', { cleanUpdateData, context: 'EditProjectDialog' });
      updateProject(project.id, cleanUpdateData);
      
      logger.info('Project updated successfully', { projectId: project.id, context: 'EditProjectDialog' });
      toast.success('Projeto atualizado com sucesso!');
      onOpenChange(false);
    } catch (error) {
      logger.error('Erro ao atualizar projeto', { error, context: 'EditProjectDialog' });
      toast.error('Erro ao atualizar projeto');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog 
      open={open} 
      onOpenChange={(open) => {
        if (!open) {
          handleDialogClose(true);
        } else {
          onOpenChange(open);
        }
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Editar Projeto</DialogTitle>
          <DialogDescription className="sr-only">
            Atualize as informações do seu projeto.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Projeto</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Digite o nome do projeto"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descreva o objetivo do projeto"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select value={formData.status} onValueChange={(value: any) => setFormData(prev => ({ ...prev, status: value }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="on-hold">Pausado</SelectItem>
                    <SelectItem value="completed">Concluído</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Cor do Projeto</Label>
                <div className="flex flex-wrap gap-2">
                  {colors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`w-8 h-8 rounded-full ${color} ${
                        formData.color === color ? 'ring-2 ring-foreground' : ''
                      }`}
                      onClick={() => setFormData(prev => ({ ...prev, color }))}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Data de Início</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="end_date">Data de Fim (Opcional)</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, end_date: e.target.value }))}
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="visibility"
                checked={formData.visibility === 'public'}
                onCheckedChange={(checked) => 
                  setFormData(prev => ({ ...prev, visibility: checked ? 'public' : 'private' }))
                }
              />
              <Label htmlFor="visibility">Projeto Público</Label>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Salvando...' : 'Salvar Alterações'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditProjectDialog;
