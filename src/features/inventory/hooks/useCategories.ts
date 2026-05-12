import { useState, useCallback, useEffect } from 'react';
import * as categoryService from '../../../services/categoryService';
import { Category } from '../../../types';

export const useCategories = (shopId?: string) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCategories = useCallback(async () => {
    if (!shopId) return;
    setLoading(true);
    try {
      const data = await categoryService.getCategories(shopId);
      setCategories(data);
    } catch(err: any) {
      setError(err?.message || 'Failed to fetch categories');
    } finally {
      setLoading(false);
    }
  }, [shopId]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const addCategory = async (name: string) => {
    if (!shopId) return;
    await categoryService.addCategory(shopId, name);
    fetchCategories();
  };

  const deleteCategory = async (categoryId: string) => {
    if (!shopId) return;
    await categoryService.deleteCategory(shopId, categoryId);
    fetchCategories();
  };

  return {
    categories,
    loading,
    error,
    refresh: fetchCategories,
    addCategory,
    deleteCategory
  };
};
