import { useState, useEffect } from 'react';
import { Notification } from '../components/notifications/NotificationToast';
import { logger } from '@/lib/logger';

export const useNotifications = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);

  // Carregar notificações do localStorage na inicialização
  useEffect(() => {
    const stored = localStorage.getItem('notifications');
    if (stored) {
      try {
        const parsed = JSON.parse(stored).map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }));
        setNotifications(parsed);
        logger.info('Notificações carregadas com sucesso', { userId: 'unknown', count: parsed.length }, { context: 'Notifications' });
      } catch (error) {
        logger.error('Erro ao carregar notificações', { error, userId: 'unknown' }, { context: 'Notifications', showToast: true });
      }
    }
  }, []);

  // Salvar notificações no localStorage sempre que mudarem
  useEffect(() => {
    localStorage.setItem('notifications', JSON.stringify(notifications));
  }, [notifications]);

  const addNotification = (notification: Omit<Notification, 'id' | 'timestamp' | 'read'>) => {
    const newNotification: Notification = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      read: false
    };

    setNotifications(prev => [newNotification, ...prev]);
    return newNotification.id;
  };

  const markAsRead = (id: string) => {
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === id 
          ? { ...notification, read: true }
          : notification
      )
    );
    logger.debug('Marcando notificação como lida', { notificationId: id }, { context: 'Notifications' });
    logger.info('Notificação marcada como lida', { notificationId: id }, { context: 'Notifications' });
  };

  const markAllAsRead = () => {
    setNotifications(prev => 
      prev.map(notification => ({ ...notification, read: true }))
    );
    logger.debug('Marcando todas as notificações como lidas', { userId: 'unknown' }, { context: 'Notifications' });
    logger.info('Todas as notificações marcadas como lidas', { userId: 'unknown' }, { context: 'Notifications' });
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    logger.debug('Excluindo notificação', { notificationId: id }, { context: 'Notifications' });
    logger.info('Notificação excluída com sucesso', { notificationId: id }, { context: 'Notifications' });
  };

  const clearAll = () => {
    setNotifications([]);
  };

  const getUnreadCount = () => {
    return notifications.filter(n => !n.read).length;
  };

  // Funções de conveniência para tipos específicos
  const addSuccess = (title: string, message: string, actionUrl?: string) => {
    return addNotification({ title, message, type: 'success', actionUrl });
  };

  const addError = (title: string, message: string, actionUrl?: string) => {
    return addNotification({ title, message, type: 'error', actionUrl });
  };

  const addInfo = (title: string, message: string, actionUrl?: string) => {
    return addNotification({ title, message, type: 'info', actionUrl });
  };

  const addWarning = (title: string, message: string, actionUrl?: string) => {
    return addNotification({ title, message, type: 'warning', actionUrl });
  };

  return {
    notifications,
    addNotification,
    addSuccess,
    addError,
    addInfo,
    addWarning,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    getUnreadCount
  };
};
