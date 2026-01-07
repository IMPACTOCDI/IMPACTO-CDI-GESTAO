import React from 'react';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldAlert } from 'lucide-react';

interface AdminRouteProps {
  children: React.ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { user, hasPermission } = useAuth();
  const [isAuthorized, setIsAuthorized] = React.useState<boolean | null>(null);

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
    } else {
      setIsAuthorized(false);
    }
  }, [user, hasPermission]);

  if (isAuthorized === null) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-muted-foreground animate-spin" />
          <h2 className="text-xl font-semibold mb-2">Verificando permissões...</h2>
          <p className="text-muted-foreground">
            Por favor, aguarde enquanto verificamos suas permissões.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!isAuthorized) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <ShieldAlert className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-2">Acesso Negado</h2>
          <p className="text-muted-foreground">
            Você não tem permissão para acessar esta área.
          </p>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
};

export default AdminRoute; 