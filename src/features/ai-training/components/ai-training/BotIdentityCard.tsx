import React from 'react';
import { AITrainingCardProps } from './types';

export default function BotIdentityCard({ config, updateConfig, onSave, isSaving }: AITrainingCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-6">
      <h3 className="text-lg font-bold text-zinc-900 mb-4">Bot Identity</h3>
      <p className="text-sm text-zinc-500 mb-4">Name and personality of your AI bot.</p>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Bot Name</label>
          <input
            type="text"
            value={config.botName || ''}
            onChange={(e) => updateConfig({ botName: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="e.g., Shop Assistant"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Personality</label>
          <textarea
            value={config.personality || ''}
            onChange={(e) => updateConfig({ personality: e.target.value })}
            rows={3}
            className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="e.g., Friendly and helpful shop assistant who speaks warmly"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Welcome Message</label>
          <textarea
            value={config.welcomeMessage || ''}
            onChange={(e) => updateConfig({ welcomeMessage: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="e.g., မင်္ဂလာပါ! ဘာကူညီပေးရမလဲ?"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Fallback Message</label>
          <input
            type="text"
            value={config.fallbackMessage || ''}
            onChange={(e) => updateConfig({ fallbackMessage: e.target.value })}
            className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
            placeholder="e.g., ခဏစောင့်ပေးပါ။ ဆက်သွယ်ပေးပါမယ်။"
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Tone</label>
            <select value={config.tone || 'friendly'} onChange={e => updateConfig({ tone: e.target.value as any })} className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm">
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="humorous">Humorous</option>
              <option value="concise">Concise</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Language</label>
            <select value={config.responseLanguage || 'Myanmar'} onChange={e => updateConfig({ responseLanguage: e.target.value })} className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm">
              <option value="Myanmar">Myanmar</option>
              <option value="English">English</option>
            </select>
          </div>
        </div>
      </div>
      <button onClick={() => onSave('identity')} disabled={isSaving} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all">
        {isSaving ? 'Saving...' : 'Save Identity'}
      </button>
    </div>
  );
}
