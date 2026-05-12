import { useState, useCallback, useEffect } from 'react';
import * as customerService from '../../../services/customerService';
import { BotUser } from '../../../services/customerService';

export const useCustomers = (shopId?: string) => {
  const [customers, setCustomers] = useState<BotUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCustomers = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const data = await customerService.getBotUsers(shopId);
      setCustomers(data);
    } catch(err: any) {
      setError(err?.message || 'Failed to fetch customers');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const updateCustomer = async (userId: string, data: Partial<Omit<BotUser, 'id'>>) => {
    if (!shopId) return;
    await customerService.updateBotUser(shopId, userId, data);
    fetchCustomers();
  };

  const finalizeOrder = async (userId: string) => {
    if (!shopId) return;
    await customerService.finalizeBotOrder(shopId, userId);
    fetchCustomers();
  };

  return {
    customers,
    loading,
    error,
    refresh: fetchCustomers,
    updateCustomer,
    finalizeOrder
  };
};
