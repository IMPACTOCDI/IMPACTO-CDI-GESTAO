import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserPlus } from 'lucide-react';
import { Database } from '@/integrations/supabase/types';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import AddMemberDialog from './AddMemberDialog';
import { supabase } from '@/lib/supabase';

type ProjectMember = Database['public']['Tables']['project_members']['Row'] & {
  profiles: Database['public']['Tables']['profiles']['Row'];
};

interface TeamMembersProps {
  members: ProjectMember[];
  projectId: string;
}

const TeamMembers: React.FC<TeamMembersProps> = ({ members, projectId }) => {
  const { user } = useAuth();
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data, error } = await supabase
        .from('project_members')
        .select(`
          *,
          profiles:user_id (
            id,
            name,
            email,
            avatar
          )
        `)
        .eq('project_id', projectId);

      if (error) {
        console.error('Erro ao buscar membros:', error);
        return;
      }

      setProjectMembers(data || []);
    };

    fetchMembers();
  }, [projectId]);

  // Verificar se o usuário atual é o criador do projeto ou um admin
  const canManageMembers = projectMembers.some(member => 
    member.user_id === user?.id && (member.role === 'admin' || member.role === 'owner')
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center">
            <Users className="mr-2 h-5 w-5" />
            Membros da Equipe
          </CardTitle>
          {canManageMembers && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddMemberOpen(true)}
              className="flex items-center gap-2"
            >
              <UserPlus className="h-4 w-4" />
              Adicionar Membro
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {projectMembers.map((member) => (
              <div key={member.user_id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <Avatar>
                    <AvatarImage src={member.profiles?.avatar} />
                    <AvatarFallback>{member.profiles?.name?.charAt(0) || member.user_id.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="font-medium">{member.profiles?.name || 'Usuário'}</p>
                    <p className="text-sm text-muted-foreground">{member.profiles?.email}</p>
                  </div>
                </div>
                <Badge variant="outline">{member.role || 'Membro'}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <AddMemberDialog
        open={isAddMemberOpen}
        onOpenChange={setIsAddMemberOpen}
        projectId={projectId}
      />
    </>
  );
};

export default TeamMembers;
