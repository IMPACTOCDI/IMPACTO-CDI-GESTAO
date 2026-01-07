import * as React from 'react';
import { useState, useEffect } from 'react';
import { useProject } from '../../contexts/ProjectContext';
import { useAuth } from '../../contexts/SupabaseAuthContext';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Bell, Calendar, AlertTriangle, MessageSquare } from 'lucide-react';

interface Notification {
  id: string;
  type: 'due_soon' | 'overdue' | 'new_comment' | 'task_assigned';
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  taskId?: string;
  projectId?: string;
}

const NotificationCenter = () => {
  const { projects } = useProject();
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Generate notifications for overdue and due soon tasks
    const generateNotifications = () => {
      const newNotifications: Notification[] = [];
      const now = new Date();
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      projects.forEach(project => {
        (project.tasks ?? []).forEach(task => {
          // Verificar se a tarefa está atribuída ao usuário atual
          if (task.assigned_to === user.id && task.status !== 'done') {
            // Se a tarefa não tem data de entrega, não gerar notificação
            if (!task.due_date) return;

            const dueDate = new Date(task.due_date);
            
            if (dueDate < now) {
              // Overdue
              newNotifications.push({
                id: `overdue-${task.id}`,
                type: 'overdue',
                title: 'Tarefa Atrasada',
                message: `"${task.title}" está atrasada`,
                createdAt: new Date().toISOString(),
                read: false,
                taskId: task.id,
                projectId: project.id
              });
            } else if (dueDate <= tomorrow) {
              // Due soon
              newNotifications.push({
                id: `due-soon-${task.id}`,
                type: 'due_soon',
                title: 'Prazo Próximo',
                message: `"${task.title}" vence em breve`,
                createdAt: new Date().toISOString(),
                read: false,
                taskId: task.id,
                projectId: project.id
              });
            }
          }
        });
      });

      setNotifications(newNotifications);
    };

    generateNotifications();
  }, [projects, user]);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAsRead = (notificationId: string) => {
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'due_soon':
        return <Calendar className="h-4 w-4 text-blue-500" />;
      case 'overdue':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'new_comment':
        return <MessageSquare className="h-4 w-4 text-green-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b p-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">Notificações</h3>
            {unreadCount > 0 && (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={markAllAsRead}
              >
                Marcar todas como lidas
              </Button>
            )}
          </div>
        </div>
        
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>Nenhuma notificação</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <div
                key={notification.id}
                className={`p-4 border-b hover:bg-gray-50 cursor-pointer ${
                  !notification.read ? 'bg-blue-50' : ''
                }`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex items-start space-x-3">
                  {getIcon(notification.type)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{notification.title}</p>
                    <p className="text-sm text-gray-600">{notification.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(notification.createdAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;
