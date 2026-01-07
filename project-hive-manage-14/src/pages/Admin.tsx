import * as React from 'react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings, Users, Database } from 'lucide-react';
import UserManagement from '../components/admin/UserManagement';
import BackupManager from '../components/admin/BackupManager';
import AdminRoute from '@/components/auth/AdminRoute';

const Admin = () => {
  const [activeTab, setActiveTab] = useState('users');

  return (
    <AdminRoute>
      <div className="min-h-screen bg-background p-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Header */}
          <div className="space-y-1">
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
              <Settings className="h-8 w-8 text-primary" />
              Administração
            </h1>
            <p className="text-muted-foreground">
              Gerencie usuários e configurações do sistema
            </p>
          </div>

          {/* Admin Tabs */}
          <Tabs defaultValue="users" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:w-fit">
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">Usuários</span>
              </TabsTrigger>
              <TabsTrigger value="backup" className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                <span className="hidden sm:inline">Backup</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="users">
              <UserManagement />
            </TabsContent>

            <TabsContent value="backup">
              <BackupManager />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AdminRoute>
  );
};

export default Admin; 