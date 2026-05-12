import React from 'react';
import { useParams } from 'react-router-dom';
import { useShop } from '../../features/shop/hooks/useShop';
import { Shop } from '../../types';
import ShopSettings from '../../features/shop/components/ShopSettings';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../components/Toast';

export default function SettingsPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { user } = useAuth();
  const { showToast } = useToast();
  const effectiveShopId = shopId || user?.shopId;
  
  const { shop, loading: isLoading, updateSettings } = useShop(effectiveShopId);

  const handleUpdateLogo = async (logoUrl: string) => {
    if (!effectiveShopId || !shop) return;
    try {
      await updateSettings({ logoUrl });
      showToast('Logo updated successfully', 'success');
    } catch (err) {
      showToast('Failed to update logo', 'error');
    }
  };

  const handleUpdateShop = async (updatedFields: Partial<Shop>) => {
    if (!effectiveShopId || !shop) return;
    try {
      await updateSettings(updatedFields);
      showToast('Settings updated successfully', 'success');
    } catch (err) {
      showToast('Failed to update settings', 'error');
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-zinc-500">Loading Settings...</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Shop Settings</h1>
        <p className="text-sm font-medium text-zinc-500 mt-1">Configure your shop profile and settings.</p>
      </div>

      <ShopSettings 
        currentShop={shop} 
        effectiveShopId={effectiveShopId}
        handleLogoUpload={(e) => {
          // Add implementation or wrap it
        }}
        setCurrentShop={() => {}} // It's managed by hook now, ShopSettings may need refactoring
        saveShop={handleUpdateShop}
        markUnsynced={() => {}}
        showToast={showToast}
      />
    </div>
  );
}
