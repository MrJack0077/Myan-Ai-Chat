import React from 'react';
import { useParams } from 'react-router-dom';
import CustomerManager from '../../features/customers/components/CustomerManager';
import { useAuth } from '../../contexts/AuthContext';

export default function CustomersPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { user } = useAuth();
  const effectiveShopId = shopId || user?.shopId;

  if (!effectiveShopId) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Customers</h1>
        <p className="text-sm font-medium text-zinc-500 mt-1">Manage your customer relationships and view order history.</p>
      </div>

      <CustomerManager shopId={effectiveShopId} />
    </div>
  );
}
