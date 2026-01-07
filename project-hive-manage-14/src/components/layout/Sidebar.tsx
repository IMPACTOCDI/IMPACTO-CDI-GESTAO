import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Home, FolderOpen, Calendar, Menu, X, BarChart3, Settings, CheckSquare, ListChecks, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger, DrawerClose } from '@/components/ui/drawer';

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const location = useLocation();
  const { hasPermission } = useAuth();
  const [permissions, setPermissions] = useState({
    viewAnalytics: false,
    isAdmin: false
  });

  useEffect(() => {
    const checkPermissions = async () => {
      const [canViewAnalytics, isAdmin] = await Promise.all([
        hasPermission('view_analytics'),
        hasPermission('admin')
      ]);
      setPermissions({
        viewAnalytics: canViewAnalytics,
        isAdmin
      });
    };
    checkPermissions();
  }, [hasPermission]);

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home },
    { name: 'Projetos', href: '/projects', icon: FolderOpen },
    { name: 'Tarefas', href: '/tasks', icon: Calendar },
    { name: 'Checklists', href: '/checklists', icon: ListChecks },
    { name: 'Contatos', href: '/contacts', icon: Users },
    { name: 'Calendário', href: '/calendar', icon: Calendar },
    ...(permissions.viewAnalytics ? [{ name: 'Analytics', href: '/analytics', icon: BarChart3 }] : []),
    ...(permissions.isAdmin ? [{ name: 'Administração', href: '/admin', icon: Settings }] : [])
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-2">
          {navigation.map((item) => (
            <Link
              key={item.name}
              to={item.href}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground',
                location.pathname === item.href ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
              )}
            >
              <item.icon className="h-4 w-4" />
              {item.name}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
};

const Sidebar = () => {
  const isMobile = useIsMobile();
  const [open, setOpen] = React.useState(false);

  if (isMobile) {
    return (
      <>
        <Button 
          variant="outline" 
          size="icon" 
          className={cn(
            "fixed top-4 left-4 z-[100] glass-effect shadow-lg hover:bg-accent/50 rounded-full w-10 h-10 flex items-center justify-center border-primary/50 transition-all duration-200",
            open && "rotate-90 scale-110"
          )}
          onClick={() => setOpen(true)}
        >
          <Menu className="h-5 w-5 transition-transform duration-200" />
        </Button>
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="h-[90vh] bg-background border-border/50">
            <DrawerHeader className="text-left border-b border-border/50">
              <div className="flex items-center justify-between">
                <DrawerTitle className="text-2xl font-bold gradient-primary bg-clip-text text-transparent">
                  Menu
                </DrawerTitle>
                <DrawerClose asChild>
                  <Button variant="ghost" size="sm" className="hover:bg-accent/50">
                    <X className="h-5 w-5" />
                  </Button>
                </DrawerClose>
              </div>
            </DrawerHeader>
            <div className="flex-1 overflow-y-auto py-2">
              <SidebarContent onNavigate={() => setOpen(false)} />
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <div className="hidden md:flex md:w-64 md:flex-col">
      <div className="flex flex-col flex-grow pt-6 pb-4 overflow-y-auto glass-effect border-r border-border/50">
        <div className="flex-grow flex flex-col">
          <SidebarContent />
        </div>
        
        <div className="px-4 py-4 border-t border-border/50 mt-auto">
          <p className="text-xs text-muted-foreground text-center">Imi Gestão Profissional v1.0</p>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
