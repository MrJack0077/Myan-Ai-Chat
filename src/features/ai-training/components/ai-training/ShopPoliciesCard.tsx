import React from 'react';
import { AITrainingCardProps } from './types';

export default function ShopPoliciesCard({ config, updateConfig, onSave, isSaving }: AITrainingCardProps) {
  const policies = config.policies || {};

  const updatePolicy = (key: string, value: string) => {
    updateConfig({
      policies: { ...policies, [key]: value }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-6">
      <h3 className="text-lg font-bold text-zinc-900 mb-4">Shop Policies</h3>
      <p className="text-sm text-zinc-500 mb-4">Set your shop policies for shipping, returns, and guarantees.</p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Shipping Policy</label>
          <textarea
            value={policies.shipping || ''}
            onChange={(e) => updatePolicy('shipping', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="e.g., Free shipping for orders over 50,000 MMK"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Return Policy</label>
          <textarea
            value={policies.returns || ''}
            onChange={(e) => updatePolicy('returns', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="e.g., 7-day return policy for defective items"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Guarantees</label>
          <textarea
            value={policies.guarantees || ''}
            onChange={(e) => updatePolicy('guarantees', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="e.g., 1-year warranty on all electronics"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">General Policy</label>
          <textarea
            value={policies.general || ''}
            onChange={(e) => updatePolicy('general', e.target.value)}
            rows={2}
            className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="e.g., Prices are subject to change without notice"
          />
        </div>
      </div>
      <button
        onClick={() => onSave('policies')}
        disabled={isSaving}
        className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all"
      >
        {isSaving ? 'Saving...' : 'Save Policies'}
      </button>
    </div>
  );
}
