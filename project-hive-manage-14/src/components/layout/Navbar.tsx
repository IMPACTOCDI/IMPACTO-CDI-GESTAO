import React from 'react';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { LogOut, Settings, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import NotificationCenter from '../notifications/NotificationCenter';
import ConnectionStatus from '../ConnectionStatus';
import { Database } from '@/integrations/supabase/types';

type Profile = Database['public']['Tables']['profiles']['Row'];

const Navbar = () => {
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const navigate = useNavigate();

  const handleProfileClick = () => {
    navigate('/profile');
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  return (
    <nav className="glass-effect border-b border-border/50 px-4 md:px-6 py-4 sticky top-0 z-40">
      <div className="flex items-center justify-between">
        <div className={cn("flex items-center space-x-4", isMobile && "ml-12")}>
          <div className="flex items-center space-x-3">
            <img 
              src="/logo-impacto/logo.png" 
              alt="IMPACTO Consultoria e Desenvolvimento Institucional" 
              className="h-14 md:h-16 w-auto object-contain" 
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>
          {user && (
            <div className="hidden md:flex items-center space-x-2 text-sm text-muted-foreground">
              <span>•</span>
              <span className="capitalize">{user.role}</span>
            </div>
          )}
        </div>

        <div className="flex items-center space-x-4">
          <ConnectionStatus />
          <NotificationCenter />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user?.avatar_url || undefined} alt={user?.full_name || 'Avatar'} />
                  <AvatarFallback>{user?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{user?.full_name}</p>
                  <p className="text-xs leading-none text-muted-foreground">{user?.email}</p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleProfileClick}>
                <User className="mr-2 h-4 w-4" />
                <span>Perfil</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSettingsClick}>
                <Settings className="mr-2 h-4 w-4" />
                <span>Configurações</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sair</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
