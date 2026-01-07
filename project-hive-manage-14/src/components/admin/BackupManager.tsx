import React, { useState } from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Database, Download, Upload } from 'lucide-react';
import { exportData, importData } from '@/lib/supabase-backup';
import { toast } from 'sonner';

const BackupManager = () => {
  const { user, hasPermission } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  React.useEffect(() => {
    const checkPermission = async () => {
      try {
        const hasAdminPermission = await hasPermission('admin');
        setIsAuthorized(hasAdminPermission);
      } catch (error) {
        console.error('Erro ao verificar permissões:', error);
        setIsAuthorized(false);
      }
    };

    if (user) {
      checkPermission();
    }
  }, [user, hasPermission]);

  const handleExport = async () => {
    try {
      setIsLoading(true);
      await exportData();
    } catch (error: any) {
      console.error('Erro ao exportar dados:', error);
      toast.error('Erro ao exportar dados: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setIsLoading(true);
      await importData(file);
    } catch (error: any) {
      console.error('Erro ao importar dados:', error);
      toast.error('Erro ao importar dados: ' + error.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!isAuthorized) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Database className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta área.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-5 w-5" />
            Gerenciamento de Backup
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={handleExport}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Exportar Dados
            </Button>

            <div className="relative">
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={isLoading}
                className="hidden"
                id="import-file"
              />
              <Button
                as="label"
                htmlFor="import-file"
                disabled={isLoading}
                className="flex items-center gap-2 cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                Importar Dados
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupManager; 