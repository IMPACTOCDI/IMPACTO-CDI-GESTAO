import React, { useState, useEffect } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AddMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
}

const AddMemberDialog: React.FC<AddMemberDialogProps> = ({ open, onOpenChange, projectId }) => {
  const { addProjectMember } = useProject();
  const [isLoading, setIsLoading] = useState(false);
  const [searchEmail, setSearchEmail] = useState('');
  const [foundUser, setFoundUser] = useState<Profile | null>(null);
  const [role, setRole] = useState('member');

  const handleSearch = async () => {
    if (!searchEmail) {
      toast.error('Digite um email para buscar');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', searchEmail)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          toast.error('Usuário não encontrado');
        } else {
          toast.error('Erro ao buscar usuário: ' + error.message);
        }
        setFoundUser(null);
        return;
      }

      // Verificar se o usuário já é membro do projeto
      const { data: existingMember } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', data.id)
        .single();

      if (existingMember) {
        toast.error('Este usuário já é membro do projeto');
        setFoundUser(null);
        return;
      }

      setFoundUser(data);
    } catch (error: any) {
      toast.error('Erro ao buscar usuário: ' + error.message);
      setFoundUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!foundUser) return;

    setIsLoading(true);
    try {
      await addProjectMember({
        project_id: projectId,
        user_id: foundUser.id,
        role: role
      });

      onOpenChange(false);
      toast.success('Membro adicionado com sucesso!');
      setSearchEmail('');
      setFoundUser(null);
      setRole('member');
    } catch (error: any) {
      toast.error('Erro ao adicionar membro: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Adicionar Membro</DialogTitle>
          <DialogDescription className="sr-only">
            Adicione um novo membro ao projeto usando o email dele.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email do Usuário</Label>
            <div className="flex gap-2">
              <Input
                id="email"
                type="email"
                placeholder="Digite o email do usuário"
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
              />
              <Button 
                type="button" 
                onClick={handleSearch}
                disabled={isLoading || !searchEmail}
              >
                Buscar
              </Button>
            </div>
          </div>

          {foundUser && (
            <>
              <div className="space-y-2">
                <Label>Usuário Encontrado</Label>
                <div className="p-3 border rounded-lg">
                  <p className="font-medium">{foundUser.name}</p>
                  <p className="text-sm text-muted-foreground">{foundUser.email}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="role">Função</Label>
                <Select value={role} onValueChange={setRole}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a função" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Membro</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button 
            type="button" 
            onClick={handleAddMember}
            disabled={isLoading || !foundUser}
          >
            {isLoading ? 'Adicionando...' : 'Adicionar Membro'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AddMemberDialog; 