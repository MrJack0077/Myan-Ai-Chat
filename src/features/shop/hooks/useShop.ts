import { useState, useCallback, useEffect } from 'react';
import * as shopService from '../../../services/shopService';
import { Shop, ShopAIConfig } from '../../../types';

export const useShop = (shopId?: string) => {
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchShop = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const data = await shopService.getShop(shopId);
      setShop(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch shop');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    fetchShop();
  }, [fetchShop]);

  const updateSettings = async (updates: Record<string, any>) => {
    if (!shopId) return;
    const res = await shopService.updateShopSettings(shopId, updates);
    if (!res.success) throw new Error(res.error);
    await fetchShop(); // Refresh state
  };

  const updateAIConfig = async (config: ShopAIConfig) => {
    if (!shopId) return;
    await shopService.updateShopAIConfig(shopId, config);
    await fetchShop();
  };

  const clearCache = async (keyword?: string) => {
    if (!shopId) return;
    await shopService.clearShopCache(shopId, keyword);
  };

  return {
    shop,
    loading,
    error,
    refresh: fetchShop,
    updateSettings,
    updateAIConfig,
    clearCache
  };
};

export const useAllShops = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchShops = useCallback(async () => {
    setLoading(true);
    const data = await shopService.getAllShops();
    setShops(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchShops();
  }, [fetchShops]);

  return { shops, loading, fetchShops };
};
