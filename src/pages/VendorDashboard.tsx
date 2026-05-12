import React from 'react';
import { Routes, Route, useParams, Navigate } from 'react-router-dom';
import OverviewPage from './vendor/OverviewPage';
import InventoryPage from './vendor/InventoryPage';
import CategoriesPage from './vendor/CategoriesPage';
import OrdersPage from './vendor/OrdersPage';
import CustomersPage from './vendor/CustomersPage';
import AnalyticsPage from './vendor/AnalyticsPage';
import AITrainingPage from './vendor/AITrainingPage';
import SettingsPage from './vendor/SettingsPage';
import SupportChat from '../components/common/SupportChat';
import { useAuth } from '../contexts/AuthContext';

export default function VendorDashboard() {
  const { shopId } = useParams<{ shopId: string }>();
  const { user } = useAuth();
  const effectiveShopId = shopId || user?.shopId;

  if (!effectiveShopId && user?.role !== 'ADMIN') {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-zinc-200">
        <h2 className="text-xl font-bold text-zinc-900">No Shop Assigned</h2>
        <p className="text-zinc-500 mt-2">Please contact an admin to assign a shop to your account.</p>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <Routes>
        <Route index element={<OverviewPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="ai-training" element={<AITrainingPage />} />
        <Route path="settings" element={<SettingsPage />} />
        {/* Redirect any other sub-paths to home */}
        <Route path="*" element={<Navigate to="" replace />} />
      </Routes>

      {effectiveShopId && (
        <SupportChat 
          room={effectiveShopId} 
          recipientName="Super Admin" 
          senderRole="VENDOR" 
        />
      )}
    </div>
  );
}
