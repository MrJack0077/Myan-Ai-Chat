import React, { useState } from 'react';
import { Save, Zap, Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AITrainingCardProps } from './types';

export default function BehavioralConstraintsCard({ config, updateConfig, onSave, isSaving }: AITrainingCardProps) {
  const { t } = useTranslation();
  const [newConstraint, setNewConstraint] = useState('');

  const addConstraint = () => {
    if (!newConstraint.trim()) return;
    updateConfig({
      constraints: [...(config.constraints || []), newConstraint.trim()]
    });
    setNewConstraint('');
  };

  const removeConstraint = (index: number) => {
    const updated = [...(config.constraints || [])];
    updated.splice(index, 1);
    updateConfig({ constraints: updated });
  };

  return (
    <div className="bg-white relative p-8 sm:p-10 rounded-[2rem] border border-zinc-100/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-6">
      <div className="flex items-center justify-between pb-6 border-b border-zinc-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-zinc-900">{t('ai_training.behavioral_constraints')}</h3>
            <p className="text-sm text-zinc-500">{t('ai_training.constraints_desc')}</p>
          </div>
        </div>
        <button
          onClick={() => onSave(t('ai_training.behavioral_constraints'))}
          disabled={isSaving}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
        >
          <Save className="w-4 h-4" />
          {isSaving ? 'Saving...' : t('common.save')}
        </button>
      </div>

      <div className="space-y-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={newConstraint}
            onChange={(e) => setNewConstraint(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addConstraint()}
            className="flex-1 px-4 py-2 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            placeholder={t('ai_training.constraint_placeholder')}
          />
          <button
            onClick={addConstraint}
            className="bg-zinc-900 text-white px-4 py-2 rounded-xl font-bold hover:bg-zinc-800 transition-all"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-2">
          {config.constraints?.map((constraint: string, idx: number) => (
            <div key={idx} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl border border-zinc-100 group">
              <span className="text-sm text-zinc-700">{constraint}</span>
              <button
                onClick={() => removeConstraint(idx)}
                className="text-zinc-400 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
          {(!config.constraints || config.constraints.length === 0) && (
            <p className="text-center text-zinc-400 text-sm py-4 italic">{t('ai_training.no_constraints')}</p>
          )}
        </div>
      </div>
    </div>
  );
}
