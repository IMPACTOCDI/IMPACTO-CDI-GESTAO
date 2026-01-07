import * as React from 'react';
import { useState } from 'react';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { useProject } from '@/contexts/ProjectContext';
import { useUserTasks } from '@/hooks/useTaskQueries';
import { useUpdateTask } from '@/hooks/useTaskMutations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Camera, Save, User, Mail, Phone, MapPin, Calendar, Shield, Eye, EyeOff, CheckSquare, Clock, AlertTriangle } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import AvatarEditor from './AvatarEditor';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const { projects = [] } = useProject();
  const [isEditing, setIsEditing] = useState(false);
  const [showAvatarEditor, setShowAvatarEditor] = useState(false);
  
  // Buscar tarefas do usuário
  const projectIds = projects.map(p => p.id);
  const { data: userTasks = [], isLoading: tasksLoading } = useUserTasks(projectIds, true); // true = apenas tarefas atribuídas ao usuário
  const updateTask = useUpdateTask();
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    location: user?.location || '',
    bio: user?.bio || '',
    department: user?.department || '',
    joinDate: user?.joinDate || '2024-01-15'
  });

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleSave = async () => {
    setIsUpdatingProfile(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      updateUser({
        ...user,
        ...formData
      });

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
        className: "bg-card border-border text-foreground"
      });
      setIsEditing(false);
    } catch (error) {
      toast({
        title: "Erro ao atualizar",
        description: "Não foi possível salvar as alterações. Tente novamente.",
        variant: "destructive",
        className: "bg-destructive border-destructive text-destructive-foreground"
      });
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast({
        title: "Senhas não coincidem",
        description: "A nova senha e a confirmação devem ser iguais.",
        variant: "destructive",
        className: "bg-destructive border-destructive text-destructive-foreground"
      });
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast({
        title: "Senha muito curta",
        description: "A nova senha deve ter pelo menos 6 caracteres.",
        variant: "destructive",
        className: "bg-destructive border-destructive text-destructive-foreground"
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      toast({
        title: "Senha alterada",
        description: "Sua senha foi alterada com sucesso.",
        className: "bg-card border-border text-foreground"
      });
      
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
    } catch (error) {
      toast({
        title: "Erro ao alterar senha",
        description: "Não foi possível alterar a senha. Verifique a senha atual.",
        variant: "destructive",
        className: "bg-destructive border-destructive text-destructive-foreground"
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handlePasswordInputChange = (field: string, value: string) => {
    setPasswordData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const handleTaskToggle = async (taskId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'done' ? 'in_progress' : 'done';
      
      await updateTask.mutateAsync({
        id: taskId,
        updates: { status: newStatus }
      });

      toast({
        title: newStatus === 'done' ? "Tarefa concluída" : "Tarefa reaberta",
        description: newStatus === 'done' ? "A tarefa foi marcada como concluída." : "A tarefa foi reaberta.",
        className: "bg-card border-border text-foreground"
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar tarefa",
        description: "Não foi possível atualizar o status da tarefa.",
        variant: "destructive",
        className: "bg-destructive border-destructive text-destructive-foreground"
      });
    }
  };

  const getTaskStats = () => {
    const total = userTasks.length;
    const completed = userTasks.filter(task => task.status === 'done').length;
    const overdue = userTasks.filter(task => 
      task.due_date && 
      new Date(task.due_date) < new Date() && 
      task.status !== 'done'
    ).length;
    
    return { total, completed, overdue, pending: total - completed };
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-300 border-green-500/30';
      default: return 'bg-muted/20 text-muted-foreground border-muted/30';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'done': return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'in_progress': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'todo': return 'bg-gray-500/20 text-gray-300 border-gray-500/30';
      default: return 'bg-muted/20 text-muted-foreground border-muted/30';
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-500/20 text-red-300 border-red-500/30';
      case 'manager': return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'member': return 'bg-green-500/20 text-green-300 border-green-500/30';
      default: return 'bg-muted/20 text-muted-foreground border-muted/30';
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Perfil</h1>
          <p className="text-muted-foreground mt-1">
            Gerencie suas informações pessoais e preferências
          </p>
        </div>
        <Button
          onClick={() => setIsEditing(!isEditing)}
          variant={isEditing ? "outline" : "default"}
          className="glass-effect hover-lift"
          disabled={isUpdatingProfile}
        >
          {isEditing ? "Cancelar" : "Editar Perfil"}
        </Button>
      </div>

      <Tabs defaultValue="personal" className="space-y-6">
        <TabsList className="glass-effect border-border/50">
          <TabsTrigger value="personal" className="data-[state=active]:bg-primary/20 text-foreground">
            <User className="h-4 w-4 mr-2" />
            Informações Pessoais
          </TabsTrigger>
          <TabsTrigger value="tasks" className="data-[state=active]:bg-primary/20 text-foreground">
            <CheckSquare className="h-4 w-4 mr-2" />
            Minhas Tarefas
          </TabsTrigger>
          <TabsTrigger value="security" className="data-[state=active]:bg-primary/20 text-foreground">
            <Shield className="h-4 w-4 mr-2" />
            Segurança
          </TabsTrigger>
        </TabsList>

        <TabsContent value="personal" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Avatar and Basic Info */}
            <Card className="card-dark animate-fade-in">
              <CardHeader className="text-center">
                <div className="relative mx-auto">
                  <Avatar className="h-24 w-24 mx-auto border-4 border-primary/20">
                    <AvatarImage src={user?.avatar} alt={user?.name} />
                    <AvatarFallback className="gradient-primary text-white text-2xl font-bold">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    size="sm"
                    className="absolute bottom-0 right-0 rounded-full h-8 w-8 p-0"
                    onClick={() => setShowAvatarEditor(true)}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold text-foreground">{formData.name}</h3>
                  <Badge className={`${getRoleBadgeColor(user?.role || '')} border`}>
                    {user?.role?.toUpperCase()}
                  </Badge>
                  <p className="text-sm text-muted-foreground flex items-center justify-center">
                    <Calendar className="h-4 w-4 mr-1" />
                    Membro desde {formData.joinDate}
                  </p>
                </div>
              </CardHeader>
            </Card>

            {/* Personal Information Form */}
            <Card className="lg:col-span-2 card-dark animate-fade-in">
              <CardHeader>
                <CardTitle className="text-foreground">Informações Pessoais</CardTitle>
                <CardDescription className="text-muted-foreground">
                  Atualize suas informações de contato e dados pessoais
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-foreground">Nome Completo</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        disabled={!isEditing}
                        className="pl-10 bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        disabled={!isEditing}
                        className="pl-10 bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-foreground">Telefone</Label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        name="phone"
                        value={formData.phone}
                        onChange={(e) => handleInputChange('phone', e.target.value)}
                        disabled={!isEditing}
                        placeholder="(11) 99999-9999"
                        className="pl-10 bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="location" className="text-foreground">Localização</Label>
                    <div className="relative">
                      <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="location"
                        name="location"
                        value={formData.location}
                        onChange={(e) => handleInputChange('location', e.target.value)}
                        disabled={!isEditing}
                        placeholder="São Paulo, SP"
                        className="pl-10 bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground"
                      />
                    </div>
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="department" className="text-foreground">Departamento</Label>
                    <Input
                      id="department"
                      value={formData.department}
                      onChange={(e) => handleInputChange('department', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Desenvolvimento, Marketing, etc."
                      className="bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground"
                    />
                  </div>

                  <div className="md:col-span-2 space-y-2">
                    <Label htmlFor="bio" className="text-foreground">Biografia</Label>
                    <textarea
                      id="bio"
                      value={formData.bio}
                      onChange={(e) => handleInputChange('bio', e.target.value)}
                      disabled={!isEditing}
                      placeholder="Conte um pouco sobre você..."
                      rows={3}
                      className="w-full px-3 py-2 bg-background/50 border border-border/50 rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                    />
                  </div>
                </div>

                {isEditing && (
                  <div className="flex justify-end pt-4">
                    <Button
                      onClick={handleSave}
                      className="gradient-primary hover-lift"
                      disabled={isUpdatingProfile}
                    >
                      <Save className="h-4 w-4 mr-2" />
                      {isUpdatingProfile ? "Salvando..." : "Salvar Alterações"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tasks" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 mb-6">
            {/* Estatísticas das Tarefas */}
            <Card className="card-dark animate-fade-in">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total</p>
                    <p className="text-2xl font-bold text-foreground">{getTaskStats().total}</p>
                  </div>
                  <CheckSquare className="h-8 w-8 text-primary" />
                </div>
              </CardContent>
            </Card>

            <Card className="card-dark animate-fade-in">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Concluídas</p>
                    <p className="text-2xl font-bold text-green-400">{getTaskStats().completed}</p>
                  </div>
                  <CheckSquare className="h-8 w-8 text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="card-dark animate-fade-in">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Pendentes</p>
                    <p className="text-2xl font-bold text-blue-400">{getTaskStats().pending}</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card className="card-dark animate-fade-in">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Atrasadas</p>
                    <p className="text-2xl font-bold text-red-400">{getTaskStats().overdue}</p>
                  </div>
                  <AlertTriangle className="h-8 w-8 text-red-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Lista de Tarefas como Checklist */}
          <Card className="card-dark animate-fade-in">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <CheckSquare className="h-5 w-5" />
                Checklist de Tarefas
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Gerencie suas tarefas atribuídas de forma rápida e eficiente
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {tasksLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : userTasks.length === 0 ? (
                <div className="text-center py-8">
                  <CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">Nenhuma tarefa atribuída a você</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {userTasks.map((task) => {
                    const isOverdue = task.due_date && new Date(task.due_date) < new Date() && task.status !== 'done';
                    
                    return (
                      <div
                        key={task.id}
                        className={`flex items-start gap-3 p-4 rounded-lg border transition-all hover:bg-muted/5 ${
                          task.status === 'done' ? 'bg-green-500/5 border-green-500/20' : 
                          isOverdue ? 'bg-red-500/5 border-red-500/20' : 
                          'bg-background/50 border-border/50'
                        }`}
                      >
                        <Checkbox
                          checked={task.status === 'done'}
                          onCheckedChange={() => handleTaskToggle(task.id, task.status)}
                          className="mt-1"
                        />
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <h4 className={`font-medium ${
                              task.status === 'done' ? 'line-through text-muted-foreground' : 'text-foreground'
                            }`}>
                              {task.title}
                            </h4>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {isOverdue && (
                                <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Atrasada
                                </Badge>
                              )}
                              <Badge className={`${getPriorityColor(task.priority)} text-xs`}>
                                {task.priority === 'high' ? 'Alta' : 
                                 task.priority === 'medium' ? 'Média' : 'Baixa'}
                              </Badge>
                              <Badge className={`${getStatusColor(task.status)} text-xs`}>
                                {task.status === 'done' ? 'Concluída' : 
                                 task.status === 'in_progress' ? 'Em Progresso' : 'A Fazer'}
                              </Badge>
                            </div>
                          </div>
                          
                          {task.description && (
                            <p className={`text-sm ${
                              task.status === 'done' ? 'text-muted-foreground' : 'text-muted-foreground'
                            }`}>
                              {task.description}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {task.projects?.name && (
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-primary rounded-full"></span>
                                {task.projects.name}
                              </span>
                            )}
                            {task.due_date && (
                              <span className={`flex items-center gap-1 ${
                                isOverdue ? 'text-red-400' : ''
                              }`}>
                                <Calendar className="h-3 w-3" />
                                {new Date(task.due_date).toLocaleDateString('pt-BR')}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="space-y-6">
          <Card className="card-dark animate-fade-in">
            <CardHeader>
              <CardTitle className="text-foreground">Segurança da Conta</CardTitle>
              <CardDescription className="text-muted-foreground">
                Gerencie sua senha e configurações de segurança
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="current-password" className="text-foreground">Senha Atual</Label>
                  <div className="relative">
                    <Input
                      id="current-password"
                      type={showPasswords.current ? "text" : "password"}
                      placeholder="Digite sua senha atual"
                      value={passwordData.currentPassword}
                      onChange={(e) => handlePasswordInputChange('currentPassword', e.target.value)}
                      className="bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => togglePasswordVisibility('current')}
                    >
                      {showPasswords.current ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-foreground">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showPasswords.new ? "text" : "password"}
                      placeholder="Digite sua nova senha"
                      value={passwordData.newPassword}
                      onChange={(e) => handlePasswordInputChange('newPassword', e.target.value)}
                      className="bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => togglePasswordVisibility('new')}
                    >
                      {showPasswords.new ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirm-password" className="text-foreground">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showPasswords.confirm ? "text" : "password"}
                      placeholder="Confirme sua nova senha"
                      value={passwordData.confirmPassword}
                      onChange={(e) => handlePasswordInputChange('confirmPassword', e.target.value)}
                      className="bg-background/50 border-border/50 text-foreground placeholder:text-muted-foreground pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                      onClick={() => togglePasswordVisibility('confirm')}
                    >
                      {showPasswords.confirm ? (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button 
                  className="gradient-primary hover-lift"
                  onClick={handlePasswordChange}
                  disabled={isChangingPassword || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                >
                  {isChangingPassword ? "Alterando..." : "Alterar Senha"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AvatarEditor 
        isOpen={showAvatarEditor}
        onClose={() => setShowAvatarEditor(false)}
      />
    </div>
  );
};

export default Profile;
