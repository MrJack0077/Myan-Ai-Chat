import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import CategoryManager from '../../features/inventory/components/CategoryManager';
import { useAuth } from '../../contexts/AuthContext';

export default function CategoriesPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { user } = useAuth();
  const effectiveShopId = shopId || user?.shopId;

  if (!effectiveShopId) return null;

  return (
    <div className="space-y-8 h-full flex flex-col">
      <div>
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Categories</h1>
        <p className="text-sm font-medium text-zinc-500 mt-1">Organize your items into logical groups for better discoverability.</p>
      </div>

      <CategoryManager shopId={effectiveShopId} />
    </div>
  );
}
