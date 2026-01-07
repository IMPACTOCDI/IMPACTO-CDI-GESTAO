import React, { useState, useEffect } from 'react';
import { useAuth, UserRole } from '../../contexts/SupabaseAuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Users, UserPlus, Shield, AlertTriangle, CheckCircle, XCircle, Trash2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { logger } from '@/lib/logger';

const UserManagement = () => {
  const { user, getAllUsers, updateUserRole, updateUserStatus, addAuthorizedEmail, removeAuthorizedEmail, getAuthorizedEmails } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('member');
  const [showAddForm, setShowAddForm] = useState(false);
  const [authorizedEmails, setAuthorizedEmails] = useState<{ email: string; role: UserRole }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<any[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      if (!user || user.role !== 'admin') {
        setIsLoading(false);
        setIsLoadingUsers(false);
        return;
      }

      try {
        logger.debug('Carregando dados...', { context: 'UserManagement' });
        const [emails, allUsers] = await Promise.all([
          getAuthorizedEmails(),
          getAllUsers()
        ]);
        logger.debug('Dados carregados com sucesso', { context: 'UserManagement' });
        setAuthorizedEmails(emails);
        setUsers(allUsers);
      } catch (error: any) {
        logger.error('Erro ao carregar dados', { error, context: 'UserManagement' });
        if (error.message === 'Usuário não autenticado') {
          toast.error('Sua sessão expirou. Por favor, faça login novamente.');
        } else if (error.message === 'Sem permissão para acessar esta função') {
          toast.error('Você não tem permissão para acessar esta função.');
        } else {
          toast.error('Erro ao carregar dados. Por favor, tente novamente.');
        }
      } finally {
        setIsLoading(false);
        setIsLoadingUsers(false);
      }
    };

    loadData();
  }, [getAuthorizedEmails, getAllUsers, user]);

  const handleAddAuthorizedEmail = async () => {
    if (newEmail && newEmail.includes('@')) {
      try {
        await addAuthorizedEmail(newEmail, newRole);
        const emails = await getAuthorizedEmails();
        setAuthorizedEmails(emails);
        setNewEmail('');
        setNewRole('member');
        setShowAddForm(false);
        toast.success('E-mail autorizado com sucesso');
      } catch (error) {
        toast.error('Erro ao autorizar e-mail');
      }
    } else {
      toast.error('Por favor, insira um e-mail válido.');
    }
  };

  const handleRemoveAuthorizedEmail = async (email: string) => {
    if (email === user?.email) {
      toast.error('Você não pode remover seu próprio e-mail.');
      return;
    }
    try {
      await removeAuthorizedEmail(email);
      const emails = await getAuthorizedEmails();
      setAuthorizedEmails(emails);
      toast.success('E-mail removido com sucesso');
    } catch (error) {
      toast.error('Erro ao remover e-mail');
    }
  };

  const getRoleColor = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'manager': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'member': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'personal': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'pending': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'suspended': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return <CheckCircle className="h-3 w-3" />;
      case 'pending': return <AlertTriangle className="h-3 w-3" />;
      case 'suspended': return <XCircle className="h-3 w-3" />;
      default: return null;
    }
  };

  const getRoleLabel = (role: UserRole) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'manager': return 'Gerente';
      case 'member': return 'Membro';
      case 'personal': return 'Pessoal';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="h-6 w-6 text-primary" />
          <h2 className="text-2xl font-bold text-foreground">Gestão de Usuários</h2>
        </div>
        <Button
          onClick={() => setShowAddForm(!showAddForm)}
          className="gradient-primary hover:opacity-90"
        >
          <UserPlus className="mr-2 h-4 w-4" />
          Autorizar E-mail
        </Button>
      </div>

      {showAddForm && (
        <Card className="card-dark">
          <CardHeader>
            <CardTitle className="flex items-center text-foreground">
              <UserPlus className="mr-2 h-5 w-5" />
              Autorizar Novo E-mail
            </CardTitle>
            <CardDescription>
              Adicione um e-mail à lista de usuários autorizados
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">E-mail</label>
              <Input
                type="email"
                placeholder="usuario@empresa.com"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                className="bg-background/50 border-border/50"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Nível de Acesso</label>
              <Select value={newRole} onValueChange={(value) => setNewRole(value as UserRole)}>
                <SelectTrigger className="bg-background/50 border-border/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Administrador</SelectItem>
                  <SelectItem value="manager">Gerente</SelectItem>
                  <SelectItem value="member">Membro</SelectItem>
                  <SelectItem value="personal">Pessoal</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex space-x-2">
              <Button onClick={handleAddAuthorizedEmail} className="gradient-primary hover:opacity-90">
                Autorizar
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* E-mails Autorizados */}
      <Card className="card-dark">
        <CardHeader>
          <CardTitle className="flex items-center text-foreground">
            <Mail className="mr-2 h-5 w-5" />
            E-mails Autorizados
          </CardTitle>
          <CardDescription>
            Lista de e-mails que podem se registrar no sistema
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Carregando...</p>
            </div>
          ) : authorizedEmails.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <Mail className="h-6 w-6 mx-auto mb-2" />
              <p>Nenhum e-mail autorizado</p>
            </div>
          ) : (
            <div className="space-y-3">
              {authorizedEmails.map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 border border-border rounded-lg bg-accent/20 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium text-foreground">{item.email}</p>
                      <Badge className={getRoleColor(item.role)}>
                        {getRoleLabel(item.role)}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleRemoveAuthorizedEmail(item.email)}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                    disabled={item.email === user.email}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Usuários Cadastrados */}
      <Card className="card-dark">
        <CardHeader>
          <CardTitle className="text-foreground">Usuários Cadastrados</CardTitle>
          <CardDescription>
            Gerencie níveis de acesso e status dos usuários registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingUsers ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
              <p className="text-muted-foreground mt-2">Carregando usuários...</p>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto mb-2" />
              <p>Nenhum usuário cadastrado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((userItem) => (
                <div
                  key={userItem.id}
                  className="flex items-center justify-between p-4 border border-border rounded-lg bg-accent/20 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
                      <span className="text-primary font-medium">
                        {userItem.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-foreground">{userItem.name}</h4>
                      <p className="text-xs text-muted-foreground">{userItem.email}</p>
                      <p className="text-xs text-muted-foreground">
                        Cadastrado em: {userItem.joinDate}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Badge className={getRoleColor(userItem.role)}>
                      <Shield className="mr-1 h-3 w-3" />
                      {getRoleLabel(userItem.role)}
                    </Badge>
                    
                    <Badge className={getStatusColor(userItem.status)}>
                      {getStatusIcon(userItem.status)}
                      <span className="ml-1">
                        {userItem.status === 'active' ? 'Ativo' : 
                         userItem.status === 'pending' ? 'Pendente' : 'Suspenso'}
                      </span>
                    </Badge>

                    <div className="flex space-x-2">
                      <Select
                        value={userItem.role}
                        onValueChange={(value) => {
                          updateUserRole(userItem.id, value as UserRole);
                        }}
                        disabled={userItem.id === user.id}
                      >
                        <SelectTrigger className="w-32 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="personal">Personal</SelectItem>
                        </SelectContent>
                      </Select>

                      <Select
                        value={userItem.status}
                        onValueChange={(value) => {
                          updateUserStatus(userItem.id, value as any);
                        }}
                        disabled={userItem.id === user.id}
                      >
                        <SelectTrigger className="w-28 h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Ativo</SelectItem>
                          <SelectItem value="pending">Pendente</SelectItem>
                          <SelectItem value="suspended">Suspenso</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default UserManagement;
