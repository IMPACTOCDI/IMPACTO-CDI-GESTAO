import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  Settings as SettingsIcon, 
  Bell, 
  Palette, 
  Shield, 
  Moon,
  Volume2,
  Mail,
  Smartphone,
  Download,
  Trash2
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';

const Settings = () => {
  const [notifications, setNotifications] = useState({
    email: true,
    push: false,
    desktop: true,
    taskReminders: true,
    projectUpdates: true,
    teamInvites: true
  });

  const [preferences, setPreferences] = useState({
    theme: 'dark',
    language: 'pt-BR',
    timezone: 'America/Sao_Paulo',
    dateFormat: 'DD/MM/YYYY',
    startOfWeek: 'monday',
    density: 'comfortable'
  });

  const [privacy, setPrivacy] = useState({
    publicProfile: false,
    showOnlineStatus: true,
    allowDirectInvites: true
  });

  const [isSaving, setIsSaving] = useState(false);

  // Load settings from localStorage on component mount
  useEffect(() => {
    const savedNotifications = localStorage.getItem('settings-notifications');
    const savedPreferences = localStorage.getItem('settings-preferences');
    const savedPrivacy = localStorage.getItem('settings-privacy');

    if (savedNotifications) {
      setNotifications(JSON.parse(savedNotifications));
    }
    if (savedPreferences) {
      setPreferences(JSON.parse(savedPreferences));
    }
    if (savedPrivacy) {
      setPrivacy(JSON.parse(savedPrivacy));
    }
  }, []);

  const saveSettings = (type: string, data: any) => {
    localStorage.setItem(`settings-${type}`, JSON.stringify(data));
  };

  const handleNotificationChange = (key: string, value: boolean) => {
    const newNotifications = {
      ...notifications,
      [key]: value
    };
    setNotifications(newNotifications);
    saveSettings('notifications', newNotifications);
    
    toast({
      title: "Configuração atualizada",
      description: "Suas preferências de notificação foram salvas.",
      className: "bg-card border-border text-foreground"
    });
  };

  const handlePreferenceChange = (key: string, value: string) => {
    const newPreferences = {
      ...preferences,
      [key]: value
    };
    setPreferences(newPreferences);
    saveSettings('preferences', newPreferences);
    
    toast({
      title: "Preferência atualizada",
      description: "Suas configurações foram salvas com sucesso.",
      className: "bg-card border-border text-foreground"
    });

    // Apply language change immediately
    if (key === 'language') {
      document.documentElement.lang = value;
    }

    // Apply theme change immediately
    if (key === 'theme') {
      document.documentElement.className = value === 'dark' ? 'dark' : '';
    }
  };

  const handlePrivacyChange = (key: string, value: boolean) => {
    const newPrivacy = {
      ...privacy,
      [key]: value
    };
    setPrivacy(newPrivacy);
    saveSettings('privacy', newPrivacy);
    
    toast({
      title: "Configuração de privacidade atualizada",
      description: "Suas preferências de privacidade foram salvas.",
      className: "bg-card border-border text-foreground"
    });
  };

  const handleExportData = async () => {
    setIsSaving(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Create and download JSON file with user data
      const userData = {
        notifications,
        preferences,
        privacy,
        exportDate: new Date().toISOString()
      };
      
      const dataStr = JSON.stringify(userData, null, 2);
      const dataBlob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(dataBlob);
      
      const link = document.createElement('a');
      link.href = url;
      link.download = `configuracoes-${new Date().getTime()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast({
        title: "Dados exportados",
        description: "Seus dados foram preparados para download.",
        className: "bg-card border-border text-foreground"
      });
    } catch (error) {
      toast({
        title: "Erro na exportação",
        description: "Não foi possível exportar os dados. Tente novamente.",
        variant: "destructive",
        className: "bg-destructive border-destructive text-destructive-foreground"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = () => {
    toast({
      title: "Confirmação necessária",
      description: "Esta ação é irreversível. Entre em contato com o suporte para prosseguir.",
      variant: "destructive",
      className: "bg-destructive border-destructive text-destructive-foreground"
    });
  };

  const resetAllSettings = () => {
    const defaultNotifications = {
      email: true,
      push: false,
      desktop: true,
      taskReminders: true,
      projectUpdates: true,
      teamInvites: true
    };
    
    const defaultPreferences = {
      theme: 'dark',
      language: 'pt-BR',
      timezone: 'America/Sao_Paulo',
      dateFormat: 'DD/MM/YYYY',
      startOfWeek: 'monday',
      density: 'comfortable'
    };
    
    const defaultPrivacy = {
      publicProfile: false,
      showOnlineStatus: true,
      allowDirectInvites: true
    };

    setNotifications(defaultNotifications);
    setPreferences(defaultPreferences);
    setPrivacy(defaultPrivacy);
    
    saveSettings('notifications', defaultNotifications);
    saveSettings('preferences', defaultPreferences);
    saveSettings('privacy', defaultPrivacy);
    
    toast({
      title: "Configurações restauradas",
      description: "Todas as configurações foram restauradas para os valores padrão.",
      className: "bg-card border-border text-foreground"
    });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Configurações</h1>
          <p className="text-muted-foreground mt-1">
            Personalize sua experiência e configure suas preferências
          </p>
        </div>
        <Button
          onClick={resetAllSettings}
          variant="outline"
          className="border-border/50 text-foreground hover:bg-background/50"
        >
          Restaurar Padrões
        </Button>
      </div>

      <Tabs defaultValue="general" className="space-y-6">
        <TabsList className="glass-effect border-border/50">
          <TabsTrigger value="general" className="data-[state=active]:bg-primary/20 text-foreground">
            <SettingsIcon className="h-4 w-4 mr-2" />
            Geral
          </TabsTrigger>
          <TabsTrigger value="notifications" className="data-[state=active]:bg-primary/20 text-foreground">
            <Bell className="h-4 w-4 mr-2" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="appearance" className="data-[state=active]:bg-primary/20 text-foreground">
            <Palette className="h-4 w-4 mr-2" />
            Aparência
          </TabsTrigger>
          <TabsTrigger value="privacy" className="data-[state=active]:bg-primary/20 text-foreground">
            <Shield className="h-4 w-4 mr-2" />
            Privacidade
          </TabsTrigger>
        </TabsList>

        {/* General Settings */}
        <TabsContent value="general" className="space-y-6">
          <Card className="card-dark animate-fade-in">
            <CardHeader>
              <CardTitle className="text-foreground">Configurações Gerais</CardTitle>
              <CardDescription className="text-muted-foreground">
                Configure suas preferências básicas do sistema
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-foreground">Idioma</Label>
                  <Select 
                    value={preferences.language} 
                    onValueChange={(value) => handlePreferenceChange('language', value)}
                  >
                    <SelectTrigger className="bg-background/50 border-border/50 text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass-effect border-border/50 bg-card">
                      <SelectItem value="pt-BR" className="text-foreground">Português (Brasil)</SelectItem>
                      <SelectItem value="en-US" className="text-foreground">English (US)</SelectItem>
                      <SelectItem value="es-ES" className="text-foreground">Español</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Fuso Horário</Label>
                  <Select 
                    value={preferences.timezone} 
                    onValueChange={(value) => handlePreferenceChange('timezone', value)}
                  >
                    <SelectTrigger className="bg-background/50 border-border/50 text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass-effect border-border/50 bg-card">
                      <SelectItem value="America/Sao_Paulo" className="text-foreground">São Paulo (GMT-3)</SelectItem>
                      <SelectItem value="America/New_York" className="text-foreground">New York (GMT-5)</SelectItem>
                      <SelectItem value="Europe/London" className="text-foreground">London (GMT+0)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Formato de Data</Label>
                  <Select 
                    value={preferences.dateFormat} 
                    onValueChange={(value) => handlePreferenceChange('dateFormat', value)}
                  >
                    <SelectTrigger className="bg-background/50 border-border/50 text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass-effect border-border/50 bg-card">
                      <SelectItem value="DD/MM/YYYY" className="text-foreground">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MM/DD/YYYY" className="text-foreground">MM/DD/YYYY</SelectItem>
                      <SelectItem value="YYYY-MM-DD" className="text-foreground">YYYY-MM-DD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Início da Semana</Label>
                  <Select 
                    value={preferences.startOfWeek} 
                    onValueChange={(value) => handlePreferenceChange('startOfWeek', value)}
                  >
                    <SelectTrigger className="bg-background/50 border-border/50 text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass-effect border-border/50 bg-card">
                      <SelectItem value="monday" className="text-foreground">Segunda-feira</SelectItem>
                      <SelectItem value="sunday" className="text-foreground">Domingo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications */}
        <TabsContent value="notifications" className="space-y-6">
          <Card className="card-dark animate-fade-in">
            <CardHeader>
              <CardTitle className="text-foreground">Preferências de Notificação</CardTitle>
              <CardDescription className="text-muted-foreground">
                Configure como e quando você deseja receber notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-background/30 rounded-lg border border-border/50">
                  <div className="flex items-center space-x-3">
                    <Mail className="h-5 w-5 text-primary" />
                    <div>
                      <Label className="text-foreground">Notificações por Email</Label>
                      <p className="text-sm text-muted-foreground">Receber emails sobre atualizações importantes</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifications.email}
                    onCheckedChange={(checked) => handleNotificationChange('email', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-background/30 rounded-lg border border-border/50">
                  <div className="flex items-center space-x-3">
                    <Smartphone className="h-5 w-5 text-primary" />
                    <div>
                      <Label className="text-foreground">Notificações Push</Label>
                      <p className="text-sm text-muted-foreground">Receber notificações push no navegador</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifications.push}
                    onCheckedChange={(checked) => handleNotificationChange('push', checked)}
                  />
                </div>

                <div className="flex items-center justify-between p-4 bg-background/30 rounded-lg border border-border/50">
                  <div className="flex items-center space-x-3">
                    <Volume2 className="h-5 w-5 text-primary" />
                    <div>
                      <Label className="text-foreground">Sons do Sistema</Label>
                      <p className="text-sm text-muted-foreground">Reproduzir sons para notificações</p>
                    </div>
                  </div>
                  <Switch
                    checked={notifications.desktop}
                    onCheckedChange={(checked) => handleNotificationChange('desktop', checked)}
                  />
                </div>

                <Separator className="bg-border/50" />

                <h4 className="text-sm font-medium text-foreground">Tipos de Notificação</h4>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-foreground">Lembretes de Tarefas</Label>
                    <Switch
                      checked={notifications.taskReminders}
                      onCheckedChange={(checked) => handleNotificationChange('taskReminders', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-foreground">Atualizações de Projetos</Label>
                    <Switch
                      checked={notifications.projectUpdates}
                      onCheckedChange={(checked) => handleNotificationChange('projectUpdates', checked)}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label className="text-foreground">Convites de Equipe</Label>
                    <Switch
                      checked={notifications.teamInvites}
                      onCheckedChange={(checked) => handleNotificationChange('teamInvites', checked)}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Appearance */}
        <TabsContent value="appearance" className="space-y-6">
          <Card className="card-dark animate-fade-in">
            <CardHeader>
              <CardTitle className="text-foreground">Aparência</CardTitle>
              <CardDescription className="text-muted-foreground">
                Personalize a aparência da interface do usuário
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-background/30 rounded-lg border border-border/50">
                  <div className="flex items-center space-x-3">
                    <Moon className="h-5 w-5 text-primary" />
                    <div>
                      <Label className="text-foreground">Tema Escuro</Label>
                      <p className="text-sm text-muted-foreground">Interface otimizada para uso noturno</p>
                    </div>
                  </div>
                  <Switch checked={true} disabled />
                </div>

                <div className="space-y-2">
                  <Label className="text-foreground">Densidade da Interface</Label>
                  <Select 
                    value={preferences.density}
                    onValueChange={(value) => handlePreferenceChange('density', value)}
                  >
                    <SelectTrigger className="bg-background/50 border-border/50 text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="glass-effect border-border/50 bg-card">
                      <SelectItem value="compact" className="text-foreground">Compacta</SelectItem>
                      <SelectItem value="comfortable" className="text-foreground">Confortável</SelectItem>
                      <SelectItem value="spacious" className="text-foreground">Espaçosa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Privacy */}
        <TabsContent value="privacy" className="space-y-6">
          <Card className="card-dark animate-fade-in">
            <CardHeader>
              <CardTitle className="text-foreground">Privacidade e Segurança</CardTitle>
              <CardDescription className="text-muted-foreground">
                Configure suas opções de privacidade e segurança
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground">Perfil Público</Label>
                  <Switch 
                    checked={privacy.publicProfile}
                    onCheckedChange={(checked) => handlePrivacyChange('publicProfile', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-foreground">Mostrar Status Online</Label>
                  <Switch 
                    checked={privacy.showOnlineStatus}
                    onCheckedChange={(checked) => handlePrivacyChange('showOnlineStatus', checked)}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-foreground">Permitir Convites Diretos</Label>
                  <Switch 
                    checked={privacy.allowDirectInvites}
                    onCheckedChange={(checked) => handlePrivacyChange('allowDirectInvites', checked)}
                  />
                </div>

                <Separator className="bg-border/50" />

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-foreground">Dados e Privacidade</h4>
                  
                  <Button 
                    variant="outline" 
                    className="w-full justify-start border-border/50 text-foreground hover:bg-background/50"
                    onClick={handleExportData}
                    disabled={isSaving}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isSaving ? "Preparando..." : "Exportar Dados Pessoais"}
                  </Button>
                  
                  <Button 
                    variant="destructive" 
                    className="w-full justify-start"
                    onClick={handleDeleteAccount}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Excluir Conta
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Settings;
