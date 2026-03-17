import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { subscribeToOrders, subscribeToBotUsers, subscribeToItems } from '../services/firebaseService';
import { useTranslation } from 'react-i18next';

export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'order' | 'system' | 'alert';
  read: boolean;
  timestamp: Date;
  link?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  addNotification: (notification: Omit<Notification, 'id' | 'read' | 'timestamp'>) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user } = useAuth();
  const { t } = useTranslation();
  const [socket, setSocket] = useState<Socket | null>(null);
  const isInitialLoad = useRef(true);
  const lastOrderIds = useRef<Set<string>>(new Set());
  const lastBotUserIds = useRef<Set<string>>(new Set());
  const lastLowStockIds = useRef<Set<string>>(new Set());
  const LOW_STOCK_THRESHOLD = 5;

  useEffect(() => {
    try {
      const newSocket = io();
      setSocket(newSocket);

      return () => {
        newSocket.close();
      };
    } catch (error) {
      console.error('Socket.io connection failed:', error);
    }
  }, []);

  useEffect(() => {
    if (user?.shopId) {
      const unsubscribe = subscribeToOrders(user.shopId, (orders) => {
        if (isInitialLoad.current) {
          orders.forEach(o => lastOrderIds.current.add(o.id));
          return;
        }

        orders.forEach(order => {
          if (!lastOrderIds.current.has(order.id)) {
            lastOrderIds.current.add(order.id);
            addNotification({
              title: t('common.new_order_noti'),
              message: t('common.new_order_msg', { orderId: order.id.slice(-6).toUpperCase(), customerName: order.customerName }),
              type: 'order',
              link: `/vendor/${user.shopId}/orders`
            });
          }
        });
      });

      return () => unsubscribe();
    }
  }, [user?.shopId, t]);

  useEffect(() => {
    if (user?.shopId) {
      const unsubscribe = subscribeToBotUsers((botUsers) => {
        const shopBotUsers = botUsers.filter(u => (u as any).shopId === user.shopId || u.id.startsWith(user.shopId));
        
        if (isInitialLoad.current) {
          shopBotUsers.forEach(u => lastBotUserIds.current.add(u.id));
          isInitialLoad.current = false; // Mark initial load as complete after first bot users fetch
          return;
        }

        shopBotUsers.forEach(botUser => {
          if (!lastBotUserIds.current.has(botUser.id) && botUser.order_state === 'COLLECTING') {
            lastBotUserIds.current.add(botUser.id);
            addNotification({
              title: t('common.customer_interaction_noti'),
              message: t('common.customer_interaction_msg', { name: botUser.name || 'Anonymous' }),
              type: 'system',
              link: `/vendor/${user.shopId}/orders`
            });
          }
        });
      });

      return () => unsubscribe();
    }
  }, [user?.shopId, t]);

  useEffect(() => {
    if (user?.shopId) {
      const unsubscribe = subscribeToItems(user.shopId, (items) => {
        if (isInitialLoad.current) {
          items.forEach(item => {
            if (item.item_type === 'product' && item.stock_type === 'count' && (item.stock_quantity || 0) <= LOW_STOCK_THRESHOLD) {
              lastLowStockIds.current.add(item.id);
            }
          });
          return;
        }

        items.forEach(item => {
          const isLow = item.item_type === 'product' && item.stock_type === 'count' && (item.stock_quantity || 0) <= LOW_STOCK_THRESHOLD;
          
          if (isLow && !lastLowStockIds.current.has(item.id)) {
            lastLowStockIds.current.add(item.id);
            addNotification({
              title: t('common.low_stock_noti'),
              message: t('common.low_stock_msg', { itemName: item.name, stock: item.stock_quantity || 0 }),
              type: 'alert',
              link: `/vendor/${user.shopId}/inventory`
            });
          } else if (!isLow && lastLowStockIds.current.has(item.id)) {
            // Remove from tracking if stock is replenished
            lastLowStockIds.current.delete(item.id);
          }
        });
      });

      return () => unsubscribe();
    }
  }, [user?.shopId, t]);

  useEffect(() => {
    if (socket && user) {
      const room = user.role === 'ADMIN' ? 'admin_notifications' : `shop_${user.shopId}_notifications`;
      socket.emit('join_room', room);

      socket.on('new_notification', (data: Omit<Notification, 'id' | 'read' | 'timestamp'>) => {
        addNotification(data);
      });

      return () => {
        socket.off('new_notification');
      };
    }
  }, [socket, user]);

  const addNotification = useCallback((data: Omit<Notification, 'id' | 'read' | 'timestamp'>) => {
    const newNotification: Notification = {
      ...data,
      id: Math.random().toString(36).substring(7),
      read: false,
      timestamp: new Date()
    };
    setNotifications(prev => [newNotification, ...prev]);
  }, []);

  const markAsRead = (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
  };

  const markAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      addNotification, 
      markAsRead, 
      markAllAsRead, 
      removeNotification 
    }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};
