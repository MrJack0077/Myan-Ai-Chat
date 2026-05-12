import React from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useShop } from '../../features/shop/hooks/useShop';
import OrderManager from '../../features/orders/components/OrderManager';

export default function OrdersPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { user } = useAuth();
  const effectiveShopId = shopId || user?.shopId;

  const { shop: currentShop, loading: isLoading } = useShop(effectiveShopId);

  if (isLoading) {
    return <div className="p-8 text-center text-zinc-500">Loading Orders...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Orders</h1>
        <p className="text-sm font-medium text-zinc-500 mt-1">Manage and track your customer orders.</p>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <OrderManager 
          shopId={effectiveShopId || ''} 
          currency={currentShop?.currency || 'MMK'} 
        />
      </div>
    </div>
  );
}
