import { useState, useEffect } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];
type ProjectInsert = Database['public']['Tables']['projects']['Insert'];

interface ProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProjectDialog = ({ open, onOpenChange }: ProjectDialogProps) => {
  const { createProject } = useProject();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [userProfile, setUserProfile] = useState<Profile | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'active' as const,
    visibility: 'public' as 'public' | 'private',
    color: 'bg-custom-blue-500',
    start_date: new Date().toISOString().split('T')[0],
    end_date: ''
  });

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

  // Buscar perfil do usuário
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();

        if (error) {
          console.error('Erro ao buscar perfil:', error);
          return;
        }

        setUserProfile(data);
      }
    };

    fetchUserProfile();
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!user || !userProfile) {
        toast.error('Usuário não autenticado ou perfil não encontrado');
        return;
      }

      // O tipo ProjectInsert não inclui start_date, mas o banco exige. Por isso, usamos 'any' aqui.
      const projectData: any = {
        name: formData.name,
        description: formData.description,
        created_by: user.id,
        status: formData.status,
        visibility: formData.visibility,
        color: formData.color,
        start_date: formData.start_date,
        end_date: formData.end_date || null
      };

      console.log('[ProjectDialog] Usuário autenticado:', user);
      console.log('[ProjectDialog] Dados do projeto a criar:', projectData);
      await createProject(projectData);
      
      onOpenChange(false);
      toast.success('Projeto criado com sucesso!');
    } catch (error) {
      console.error('[ProjectDialog] Erro ao criar projeto:', error);
      toast.error('Erro ao criar projeto. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Criar Novo Projeto</DialogTitle>
          <DialogDescription className="sr-only">
            Preencha os campos para criar um novo projeto.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Projeto</Label>
            <Input
              id="name"
              name="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Descreva o projeto"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={formData.status}
              onValueChange={(value) => setFormData({ ...formData, status: value as 'active' | 'completed' | 'on_hold' | 'cancelled' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="completed">Concluído</SelectItem>
                <SelectItem value="on_hold">Em Espera</SelectItem>
                <SelectItem value="cancelled">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="color">Cor do Projeto</Label>
            <div className="grid grid-cols-4 gap-2">
              {colors.map((color) => (
                <button
                  key={color}
                  type="button"
                  className={`w-8 h-8 rounded-full ${color} ${
                    formData.color === color ? 'ring-2 ring-offset-2 ring-gray-400' : ''
                  }`}
                  onClick={() => setFormData({ ...formData, color })}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Data de Início</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end_date">Data de Fim (Opcional)</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="visibility">Visibilidade</Label>
            <Select
              value={formData.visibility}
              onValueChange={(value) => setFormData({ ...formData, visibility: value as 'public' | 'private' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a visibilidade" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="public">Público</SelectItem>
                <SelectItem value="private">Privado</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Criando...' : 'Criar Projeto'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectDialog;
