import React from 'react';
import { useParams } from 'react-router-dom';
import VendorAnalytics from '../../features/analytics/components/VendorAnalytics';
import { useAuth } from '../../contexts/AuthContext';

export default function AnalyticsPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { user } = useAuth();
  const effectiveShopId = shopId || user?.shopId;

  if (!effectiveShopId) return null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Analytics</h1>
        <p className="text-sm font-medium text-zinc-500 mt-1">Track your business performance and growth metrics.</p>
      </div>

      <VendorAnalytics shopId={effectiveShopId} />
    </div>
  );
}
