import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/SupabaseAuthContext';
import { useEffect, useState } from 'react';
import Login from '@/components/auth/Login';
import Register from '@/components/auth/Register';
import Dashboard from '@/components/dashboard/Dashboard';
import Projects from '@/components/projects/Projects';
import ProjectDetail from '@/components/projects/ProjectDetail';
import KanbanBoard from '@/components/kanban/KanbanBoard';
import Calendar from '@/components/calendar/Calendar';
import Profile from '@/components/profile/Profile';
import Settings from '@/components/settings/Settings';
import Analytics from '@/pages/Analytics';
import Admin from '@/pages/Admin';
import NotFound from '@/pages/NotFound';
import Tasks from '@/pages/Tasks';
import Checklists from '@/pages/Checklists';
import Contacts from '@/pages/Contacts';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import TaskDetailPage from '@/pages/TaskDetail';
import { logger } from '@/lib/logger';

const AppRoutes = () => {
  const { user, isLoading } = useAuth();
  const location = useLocation();
  const [renderState, setRenderState] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [redirectCount, setRedirectCount] = useState(0);
  
  // Efeito para controlar o estado de renderização com debounce
  useEffect(() => {
    // Limita o número de redirecionamentos para evitar loops infinitos
    if (redirectCount > 5) {
      logger.error('Detectado possível loop de redirecionamento', { context: 'Routes' });
      // Força um estado para quebrar o loop
      setRenderState(user ? 'authenticated' : 'unauthenticated');
      return;
    }
    
    let timeoutId: NodeJS.Timeout;
    
    if (isLoading) {
      setRenderState('loading');
    } else {
      // Pequeno delay para evitar redirecionamentos prematuros
      timeoutId = setTimeout(() => {
        setRenderState(user ? 'authenticated' : 'unauthenticated');
        if (user && (location.pathname === '/login' || location.pathname === '/register')) {
          setRedirectCount(prev => prev + 1);
        } else if (!user && location.pathname !== '/login' && location.pathname !== '/register') {
          setRedirectCount(prev => prev + 1);
        }
      }, 100);
    }
    
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user, isLoading, location.pathname, redirectCount]);

  if (renderState === 'loading') {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (renderState === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-background">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex w-full">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <Navbar />
        <main className="flex-1 overflow-auto bg-background">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/projects/:id/kanban" element={<KanbanBoard />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/checklists" element={<Checklists />} />
            <Route path="/contacts" element={<Contacts />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/tasks/:taskId" element={<TaskDetailPage />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
};

export default AppRoutes;