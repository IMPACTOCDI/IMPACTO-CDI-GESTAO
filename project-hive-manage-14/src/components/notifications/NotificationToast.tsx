
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Bell, CheckCircle, AlertCircle, Info, Calendar } from 'lucide-react';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info' | 'warning';
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
}

interface NotificationToastProps {
  notifications: Notification[];
  onMarkAsRead: (id: string) => void;
}

const NotificationToast: React.FC<NotificationToastProps> = ({ 
  notifications, 
  onMarkAsRead 
}) => {
  const [lastNotificationCount, setLastNotificationCount] = useState(0);

  useEffect(() => {
    const unreadNotifications = notifications.filter(n => !n.read);
    
    // Se há novas notificações, mostrar toast
    if (unreadNotifications.length > lastNotificationCount) {
      const newNotifications = unreadNotifications.slice(lastNotificationCount);
      
      newNotifications.forEach(notification => {
        const icon = getNotificationIcon(notification.type);
        
        toast(notification.title, {
          description: notification.message,
          icon,
          action: notification.actionUrl ? {
            label: 'Ver',
            onClick: () => {
              window.location.href = notification.actionUrl!;
              onMarkAsRead(notification.id);
            }
          } : undefined,
          onDismiss: () => onMarkAsRead(notification.id),
          duration: 5000,
        });
      });
    }
    
    setLastNotificationCount(unreadNotifications.length);
  }, [notifications, lastNotificationCount, onMarkAsRead]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'info':
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  return null; // Este componente só gerencia toasts, não renderiza UI
};

export default NotificationToast;
