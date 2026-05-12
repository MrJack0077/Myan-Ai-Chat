import { useState, useCallback, useEffect } from 'react';
import * as orderService from '../../../services/orderService';
import { Order, OrderStatus, PaymentStatus } from '../../../types';

export const useOrders = (shopId?: string, subscribe: boolean = false) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const data = await orderService.getOrders(shopId);
      setOrders(data);
    } catch(err: any) {
      setError(err?.message || 'Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    if (!shopId) return;
    if (subscribe) {
      setLoading(true);
      const unsubscribe = orderService.subscribeToOrders(shopId, (newOrders) => {
        setOrders(newOrders);
        setLoading(false);
      });
      return () => unsubscribe();
    } else {
      fetchOrders();
    }
  }, [shopId, subscribe, fetchOrders]);

  const updateStatus = async (orderId: string, status: OrderStatus) => {
    if (!shopId) return;
    await orderService.updateOrderStatus(shopId, orderId, status);
    if (!subscribe) fetchOrders();
  };

  const updatePaymentStatus = async (orderId: string, status: PaymentStatus) => {
    if (!shopId) return;
    await orderService.updateOrderPaymentStatus(shopId, orderId, status);
    if (!subscribe) fetchOrders();
  };

  return {
    orders,
    loading,
    error,
    refresh: fetchOrders,
    updateStatus,
    updatePaymentStatus
  };
};
