import { useState, useEffect, useCallback } from 'react';
import { VendorItem } from '../../../types';
import * as inventoryService from '../../../services/inventoryService';

export const useInventory = (shopId: string | undefined) => {
  const [items, setItems] = useState<VendorItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch normally (preferred for non-realtime highly active screens)
  const fetchItems = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await inventoryService.getItems(shopId);
      setItems(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  // Optionally use realtime subscription
  useEffect(() => {
    if (!shopId) return;
    
    setLoading(true);
    const unsubscribe = inventoryService.subscribeToItems(shopId, (fetchedItems) => {
      setItems(fetchedItems);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [shopId]);

  const saveItem = async (item: Partial<VendorItem>) => {
    if (!shopId) return;
    await inventoryService.saveItem(shopId, item);
    // Realtime listener will auto-update state
  };

  const deleteItem = async (itemId: string) => {
    if (!shopId) return;
    await inventoryService.deleteItem(shopId, itemId);
  };

  return {
    items,
    loading,
    error,
    saveItem,
    deleteItem,
    refresh: fetchItems
  };
};
