import React from 'react';
import { AITrainingCardProps } from './types';

export default function HumanHandoffCard({ config, updateConfig, onSave, isSaving }: AITrainingCardProps) {
  const handoff = config.handoffRules || {};

  const update = (key: string, value: any) => {
    updateConfig({ handoffRules: { ...handoff, [key]: value } });
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-6">
      <h3 className="text-lg font-bold text-zinc-900 mb-4">Human Handoff Rules</h3>
      <p className="text-sm text-zinc-500 mb-4">When should the AI escalate to a human agent?</p>
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <input type="checkbox" checked={handoff.captureEmail || false} onChange={e => update('captureEmail', e.target.checked)} className="w-4 h-4" />
          <label className="text-sm text-zinc-700">Capture customer email</label>
        </div>
        <div className="flex items-center gap-3">
          <input type="checkbox" checked={handoff.capturePhone || false} onChange={e => update('capturePhone', e.target.checked)} className="w-4 h-4" />
          <label className="text-sm text-zinc-700">Capture customer phone</label>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Trigger Keywords (comma-separated)</label>
          <input
            type="text"
            value={(handoff.triggerKeywords || []).join(', ')}
            onChange={(e) => update('triggerKeywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="e.g., complain, refund, manager, speak to human"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Min Price Threshold for Handoff</label>
          <input type="number" value={handoff.minPriceThreshold || ''} onChange={e => update('minPriceThreshold', parseInt(e.target.value) || undefined)} className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm" placeholder="e.g., 100000" />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Urgency Keywords (comma-separated)</label>
          <input
            type="text"
            value={(handoff.urgencyKeywords || []).join(', ')}
            onChange={(e) => update('urgencyKeywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))}
            className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="e.g., urgent, immediately, asap"
          />
        </div>
      </div>
      <button onClick={() => onSave('handoffRules')} disabled={isSaving} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all">
        {isSaving ? 'Saving...' : 'Save Handoff Rules'}
      </button>
    </div>
  );
}
