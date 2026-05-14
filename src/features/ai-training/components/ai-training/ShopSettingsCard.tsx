import React from 'react';
import { ShopSettingsData } from './types';

interface ShopSettingsCardProps {
  shopSettings: ShopSettingsData;
  setShopSettings: (s: ShopSettingsData) => void;
  onSave: () => void;
  isSaving: boolean;
}

export default function ShopSettingsCard({ shopSettings, setShopSettings, onSave, isSaving }: ShopSettingsCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-6">
      <h3 className="text-lg font-bold text-zinc-900 mb-4">Shop Settings</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Currency</label>
          <select value={shopSettings.currency} onChange={e => setShopSettings({ ...shopSettings, currency: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm">
            <option value="MMK">MMK (Kyat)</option>
            <option value="THB">THB (Baht)</option>
            <option value="USD">USD (Dollar)</option>
          </select>
        </div>
      </div>
      <button onClick={onSave} disabled={isSaving} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all">
        {isSaving ? 'Saving...' : 'Save Settings'}
      </button>
    </div>
  );
}
