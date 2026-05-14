import React from 'react';
import { AITrainingCardProps } from './types';

export default function StandardResponsesCard({ config, updateConfig, onSave, isSaving }: AITrainingCardProps) {
  const guidelines = config.replyGuidelines || {};

  const updateGuideline = (key: string, value: string) => {
    updateConfig({
      replyGuidelines: { ...guidelines, [key]: value }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-6">
      <h3 className="text-lg font-bold text-zinc-900 mb-4">Standard Responses</h3>
      <p className="text-sm text-zinc-500 mb-4">Pre-set reply templates for common scenarios.</p>
      <div className="space-y-4">
        {[
          { key: 'greeting', label: 'Greeting Message' },
          { key: 'outOfStock', label: 'Out of Stock Message' },
          { key: 'orderConfirm', label: 'Order Confirmation Message' },
          { key: 'fallback', label: 'Fallback Message' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-zinc-700 mb-1">{label}</label>
            <textarea
              value={(guidelines as any)[key] || ''}
              onChange={(e) => updateGuideline(key, e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        ))}
      </div>
      <button onClick={() => onSave('replyGuidelines')} disabled={isSaving} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all">
        {isSaving ? 'Saving...' : 'Save Responses'}
      </button>
    </div>
  );
}
