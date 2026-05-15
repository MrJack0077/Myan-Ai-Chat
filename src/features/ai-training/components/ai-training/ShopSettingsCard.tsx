import React, { useState } from 'react';
import { Plus, Trash2, Store, BadgeDollarSign, Truck } from 'lucide-react';
import { ShopSettingsData } from './types';

interface ShopSettingsCardProps {
  shopSettings: ShopSettingsData;
  setShopSettings: (s: ShopSettingsData) => void;
  onSave: (section?: string) => void;
  isSaving: boolean;
}

interface PaymentMethod {
  id: string;
  name: string;
  accountNumber?: string;
  accountName?: string;
  isActive?: boolean;
}

interface DeliveryOption {
  id: string;
  name: string;
  description?: string;
  cost?: number;
  estimatedDays?: string;
  isActive?: boolean;
}

export default function ShopSettingsCard({ shopSettings, setShopSettings, onSave, isSaving }: ShopSettingsCardProps) {
  const [newPayment, setNewPayment] = useState({ name: '', accountNumber: '', accountName: '' });
  const [newDelivery, setNewDelivery] = useState({ name: '', description: '', cost: 0, estimatedDays: '' });

  const addPaymentMethod = () => {
    if (!newPayment.name.trim()) return;
    const item: PaymentMethod = {
      id: Date.now().toString(),
      name: newPayment.name.trim(),
      accountNumber: newPayment.accountNumber.trim(),
      accountName: newPayment.accountName.trim(),
      isActive: true
    };
    setShopSettings({ ...shopSettings, paymentInfo: [...(shopSettings.paymentInfo || []), item] });
    setNewPayment({ name: '', accountNumber: '', accountName: '' });
  };

  const removePaymentMethod = (id: string) => {
    setShopSettings({
      ...shopSettings,
      paymentInfo: (shopSettings.paymentInfo || []).filter((p: any) => p.id !== id)
    });
  };

  const addDeliveryOption = () => {
    if (!newDelivery.name.trim()) return;
    const item: DeliveryOption = {
      id: Date.now().toString(),
      name: newDelivery.name.trim(),
      description: newDelivery.description.trim(),
      cost: newDelivery.cost || 0,
      estimatedDays: newDelivery.estimatedDays.trim(),
      isActive: true
    };
    setShopSettings({ ...shopSettings, deliveryInfo: [...(shopSettings.deliveryInfo || []), item] });
    setNewDelivery({ name: '', description: '', cost: 0, estimatedDays: '' });
  };

  const removeDeliveryOption = (id: string) => {
    setShopSettings({
      ...shopSettings,
      deliveryInfo: (shopSettings.deliveryInfo || []).filter((d: any) => d.id !== id)
    });
  };

  return (
    <div className="bg-white relative p-8 sm:p-10 rounded-[2rem] border border-zinc-100/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-8">
      <div className="flex items-center justify-between pb-6 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <Store className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-zinc-900">Shop Settings</h3>
            <p className="text-sm text-zinc-500">Currency, payment methods, and delivery options used in AI replies.</p>
          </div>
        </div>
        <button
          onClick={() => onSave('Shop Settings')}
          disabled={isSaving}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold transition-all disabled:opacity-50 shadow-lg shadow-indigo-100"
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>

      {/* Currency */}
      <div className="space-y-3">
        <label className="flex items-center gap-2 text-sm font-bold text-zinc-700">
          <BadgeDollarSign className="w-4 h-4 text-amber-500" />
          Currency
        </label>
        <select
          value={shopSettings.currency}
          onChange={e => setShopSettings({ ...shopSettings, currency: e.target.value })}
          className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
        >
          <option value="MMK">🇲🇲 MMK (Kyat)</option>
          <option value="THB">🇹🇭 THB (Baht)</option>
          <option value="USD">🇺🇸 USD (Dollar)</option>
        </select>
      </div>

      {/* Payment Methods */}
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-bold text-zinc-700">
          <BadgeDollarSign className="w-4 h-4 text-emerald-500" />
          Payment Methods
        </label>
        
        <div className="space-y-2">
          {(shopSettings.paymentInfo || []).map((pm: any) => (
            <div key={pm.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100 group">
              <div>
                <span className="text-sm font-semibold text-zinc-800">{pm.name}</span>
                {pm.accountNumber && <span className="text-xs text-zinc-400 ml-2">{pm.accountNumber}</span>}
                {pm.accountName && <span className="text-xs text-zinc-400 ml-1">({pm.accountName})</span>}
              </div>
              <button
                onClick={() => removePaymentMethod(pm.id)}
                className="text-zinc-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 p-1"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input
            type="text"
            placeholder="Method name (e.g. KPay)"
            value={newPayment.name}
            onChange={e => setNewPayment({ ...newPayment, name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && addPaymentMethod()}
            className="px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
          <input
            type="text"
            placeholder="Account number"
            value={newPayment.accountNumber}
            onChange={e => setNewPayment({ ...newPayment, accountNumber: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && addPaymentMethod()}
            className="px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Account name"
              value={newPayment.accountName}
              onChange={e => setNewPayment({ ...newPayment, accountName: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && addPaymentMethod()}
              className="flex-1 px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
            <button
              onClick={addPaymentMethod}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Delivery Options */}
      <div className="space-y-4">
        <label className="flex items-center gap-2 text-sm font-bold text-zinc-700">
          <Truck className="w-4 h-4 text-blue-500" />
          Delivery Options
        </label>

        <div className="space-y-2">
          {(shopSettings.deliveryInfo || []).map((d: any) => (
            <div key={d.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100 group">
              <div className="flex-1 min-w-0">
                <span className="text-sm font-semibold text-zinc-800">{d.name}</span>
                {d.cost > 0 && <span className="text-xs text-emerald-600 font-bold ml-2">{d.cost.toLocaleString()} {shopSettings.currency}</span>}
                {d.estimatedDays && <span className="text-xs text-zinc-400 ml-2">~{d.estimatedDays} days</span>}
                {d.description && <p className="text-xs text-zinc-400 mt-0.5 truncate">{d.description}</p>}
              </div>
              <button
                onClick={() => removeDeliveryOption(d.id)}
                className="text-zinc-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100 p-1 flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <input
            type="text"
            placeholder="Option name"
            value={newDelivery.name}
            onChange={e => setNewDelivery({ ...newDelivery, name: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && addDeliveryOption()}
            className="px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
          <input
            type="text"
            placeholder="Description"
            value={newDelivery.description}
            onChange={e => setNewDelivery({ ...newDelivery, description: e.target.value })}
            onKeyDown={e => e.key === 'Enter' && addDeliveryOption()}
            className="px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
          <input
            type="number"
            placeholder="Cost"
            value={newDelivery.cost || ''}
            onChange={e => setNewDelivery({ ...newDelivery, cost: parseInt(e.target.value) || 0 })}
            onKeyDown={e => e.key === 'Enter' && addDeliveryOption()}
            className="px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Days"
              value={newDelivery.estimatedDays}
              onChange={e => setNewDelivery({ ...newDelivery, estimatedDays: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && addDeliveryOption()}
              className="flex-1 px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
            <button
              onClick={addDeliveryOption}
              className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
