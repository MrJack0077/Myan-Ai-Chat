import React from 'react';
import { Package, Upload, Settings, ShieldCheck, AlertCircle } from 'lucide-react';
import { Shop } from '../../../types';
import { useTranslation } from 'react-i18next';

interface ShopSettingsProps {
  currentShop: Shop | null;
  effectiveShopId: string | undefined;
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  setCurrentShop: React.Dispatch<React.SetStateAction<Shop | null>>;
  saveShop: (shop: Partial<Shop>) => Promise<any>;
  markUnsynced: () => void;
  showToast: (message: string, type: 'success' | 'error') => void;
}

export default function ShopSettings({
  currentShop,
  effectiveShopId,
  handleLogoUpload,
  setCurrentShop,
  saveShop,
  markUnsynced,
  showToast
}: ShopSettingsProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="max-w-4xl grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="space-y-6">
            <div className="flex items-center gap-6 pb-6 border-b border-zinc-100">
              <div className="relative group">
                <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-3xl flex items-center justify-center overflow-hidden">
                  {currentShop?.logoUrl ? (
                    <img src={currentShop.logoUrl} alt={currentShop.name} className="w-full h-full object-cover" />
                  ) : (
                    <Package className="w-10 h-10" />
                  )}
                </div>
                <label className="absolute inset-0 bg-black/50 text-white flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer rounded-3xl">
                  <Upload className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-medium">Upload</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleLogoUpload}
                  />
                </label>
              </div>
              <div>
                <h3 className="text-xl font-bold text-zinc-900">{currentShop?.name}</h3>
                <p className="text-sm text-zinc-500">Shop ID: {effectiveShopId}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('dashboard.shop_name')}</label>
                <input
                  type="text"
                  value={currentShop?.name || ''}
                  onChange={async (e) => {
                    const newName = e.target.value;
                    setCurrentShop((prev: Shop | null) => prev ? { ...prev, name: newName } : null);
                  }}
                  onBlur={async () => {
                    if (effectiveShopId && currentShop) {
                      await saveShop({ id: effectiveShopId, name: currentShop.name });
                      markUnsynced();
                      showToast('Shop name updated', 'success');
                    }
                  }}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 transition-all focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('dashboard.slug')}</label>
                <input
                  type="text"
                  disabled
                  value={currentShop?.slug || ''}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-500 cursor-not-allowed"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-zinc-100">
              <h4 className="text-sm font-bold text-zinc-900 mb-4">{t('shop.status')}</h4>
              <div className="flex items-center justify-between p-4 bg-zinc-50 rounded-2xl border border-zinc-200">
                <div>
                  <p className="text-sm font-bold text-zinc-900">Current Status: <span className={currentShop?.status === 'active' ? 'text-emerald-600' : 'text-red-600'}>{currentShop?.status?.toUpperCase()}</span></p>
                  <p className="text-[10px] text-zinc-500">When inactive, your shop will not be visible to customers.</p>
                </div>
                <button 
                  onClick={async () => {
                    const newStatus = currentShop?.status === 'active' ? 'inactive' : 'active';
                    await saveShop({ id: effectiveShopId, status: newStatus });
                    markUnsynced();
                    setCurrentShop((prev: Shop | null) => prev ? { ...prev, status: newStatus } : null);
                    showToast(`Shop ${newStatus === 'active' ? 'activated' : 'deactivated'}`, 'success');
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                    currentShop?.status === 'active' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                  }`}
                >
                  {currentShop?.status === 'active' ? 'Deactivate Shop' : 'Activate Shop'}
                </button>
              </div>
            </div>

            <div className="pt-6 border-t border-zinc-100">
              <h4 className="text-sm font-bold text-zinc-900 mb-4">{t('shop.sendpulse_integration')}</h4>
              <div className="bg-zinc-50 p-4 rounded-2xl border border-zinc-200">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-indigo-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-bold text-zinc-900 mb-1">Account ID: {(currentShop?.sendpulseBotIds || []).join(', ') || 'Not Connected'}</p>
                    {currentShop?.sendpulseClientId && (
                      <p className="text-xs font-bold text-zinc-900 mb-1">Client ID: {currentShop.sendpulseClientId.replace(/./g, "*")}</p>
                    )}
                    <p className="text-[10px] text-zinc-500 leading-relaxed">
                      Your shop is ready to be connected to SendPulse. Use the AI Context Export to feed your inventory data to the AI Agent.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-6 border-b border-zinc-100">
              <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                <Settings className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-zinc-900">{t('shop.manager_settings')}</h3>
                <p className="text-xs text-zinc-500">{t('shop.manager_configs')}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('shop.manager_email')}</label>
                <input
                  type="email"
                  disabled
                  value={currentShop?.vendorCredentials?.email || ''}
                  className="w-full px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-500 cursor-not-allowed"
                />
              </div>
              
              <div className="p-4 bg-indigo-50 rounded-2xl border border-indigo-100">
                <div className="flex gap-3">
                  <ShieldCheck className="w-5 h-5 text-indigo-600 shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-indigo-900 mb-1">{t('shop.role_permissions')}</p>
                    <p className="text-[10px] text-indigo-700 leading-relaxed">
                      As a Shop Manager, you have full control over inventory, AI training, and customer interactions for this specific shop.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
