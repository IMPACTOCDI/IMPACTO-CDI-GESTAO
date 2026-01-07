import { useState } from 'react';
import { useProject } from '@/contexts/ProjectContext';
import { logger } from '@/lib/logger';
import { toast } from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/lib/supabase';

interface AddMemberDialogProps {
  projectId: string;
  onOpenChange: (open: boolean) => void;
}

export function AddMemberDialog({ projectId, onOpenChange }: AddMemberDialogProps) {
  const [searchEmail, setSearchEmail] = useState('');
  const [foundUser, setFoundUser] = useState<any>(null);
  const [role, setRole] = useState('member');
  const [isLoading, setIsLoading] = useState(false);
  const { addProjectMember } = useProject();

  const handleSearch = async () => {
    if (!searchEmail) return;

    setIsLoading(true);
    try {
      // Primeiro, buscar o usuário pelo email
      const { data: userData, error: userError } = await supabase
        .from('profiles')
        .select('id, name, email, avatar')
        .eq('email', searchEmail)
        .single();

      if (userError) {
        logger.error('Erro ao buscar usuário', { error: userError, email: searchEmail, context: 'AddMemberDialog' });
        toast.error('Erro ao buscar usuário: ' + userError.message);
        return;
      }

      if (!userData) {
        toast.error('Usuário não encontrado');
        return;
      }

      // Depois, verificar se o usuário já é membro do projeto
      const { data: existingMember, error: memberError } = await supabase
        .from('project_members')
        .select('*')
        .eq('project_id', projectId)
        .eq('user_id', userData.id)
        .maybeSingle();

      if (memberError) {
        logger.error('Erro ao verificar membro existente', { error: memberError, context: 'AddMemberDialog' });
        toast.error('Erro ao verificar membro existente: ' + memberError.message);
        return;
      }

      if (existingMember) {
        toast.error('Usuário já é membro deste projeto');
        return;
      }

      setFoundUser(userData);
    } catch (error: any) {
      logger.error('Erro ao buscar usuário', { error, email: searchEmail, context: 'AddMemberDialog' });
      toast.error('Erro ao buscar usuário: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!foundUser) return;

    setIsLoading(true);
    try {
      const memberData = {
        project_id: projectId,
        user_id: foundUser.id,
        role: role
      };

      logger.debug('Adicionando membro ao projeto', { 
        projectId, 
        userId: foundUser.id,
        role,
        context: 'AddMemberDialog' 
      });
      
      await addProjectMember(memberData);

      onOpenChange(false);
      toast.success('Membro adicionado com sucesso!');
      setSearchEmail('');
      setFoundUser(null);
      setRole('member');
    } catch (error: any) {
      logger.error('Erro ao adicionar membro', { 
        error,
        projectId,
        userId: foundUser?.id,
        context: 'AddMemberDialog' 
      });
      toast.error('Erro ao adicionar membro: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">Adicionar Membro</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Adicionar Membro ao Projeto</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
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
              <Button onClick={handleSearch} disabled={isLoading}>
                Buscar
              </Button>
            </div>
          </div>

          {foundUser && (
            <>
              <div className="space-y-2">
                <Label>Usuário Encontrado</Label>
                <div className="flex items-center gap-2 p-2 border rounded">
                  {foundUser.avatar && (
                    <img
                      src={foundUser.avatar}
                      alt={foundUser.name}
                      className="w-8 h-8 rounded-full"
                    />
                  )}
                  <div>
                    <p className="font-medium">{foundUser.name}</p>
                    <p className="text-sm text-gray-500">{foundUser.email}</p>
                  </div>
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

              <Button
                onClick={handleAddMember}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Adicionando...' : 'Adicionar Membro'}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 