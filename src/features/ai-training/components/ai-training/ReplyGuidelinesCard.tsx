import React from 'react';
import { AITrainingCardProps } from './types';

export default function ReplyGuidelinesCard({ config, updateConfig, onSave, isSaving }: AITrainingCardProps) {
  const style = config.communicationStyle || {};

  const updateStyle = (key: string, value: any) => {
    updateConfig({
      communicationStyle: { ...style, [key]: value }
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-6">
      <h3 className="text-lg font-bold text-zinc-900 mb-4">Reply Guidelines</h3>
      <p className="text-sm text-zinc-500 mb-4">Fine-tune how the AI responds to customers.</p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Response Length</label>
          <select value={style.responseLength || 'moderate'} onChange={e => updateStyle('responseLength', e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm">
            <option value="concise">Concise</option>
            <option value="moderate">Moderate</option>
            <option value="detailed">Detailed</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Emoji Usage</label>
          <select value={style.emojiUsage || 'minimal'} onChange={e => updateStyle('emojiUsage', e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm">
            <option value="none">None</option>
            <option value="minimal">Minimal</option>
            <option value="friendly">Friendly</option>
            <option value="heavy">Heavy</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Formality</label>
          <select value={style.formalityLevel || 'casual'} onChange={e => updateStyle('formalityLevel', e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm">
            <option value="very_casual">Very Casual</option>
            <option value="casual">Casual</option>
            <option value="formal">Formal</option>
            <option value="very_formal">Very Formal</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 mb-1">Max Sentences</label>
          <input type="number" min={1} max={10} value={style.maxSentencesPerReply || 3} onChange={e => updateStyle('maxSentencesPerReply', parseInt(e.target.value))} className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm" />
        </div>
        <div className="col-span-2 flex items-center gap-2">
          <input type="checkbox" checked={style.useShopkeeperVoice || false} onChange={e => updateStyle('useShopkeeperVoice', e.target.checked)} className="w-4 h-4" />
          <label className="text-sm text-zinc-700">Use shopkeeper voice (ဆိုင်ရှင်လေသံ)</label>
        </div>
      </div>
      <button onClick={() => onSave('communicationStyle')} disabled={isSaving} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all">
        {isSaving ? 'Saving...' : 'Save Guidelines'}
      </button>
    </div>
  );
}
