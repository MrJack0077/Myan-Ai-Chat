import React from 'react';
import { AITrainingCardProps } from './types';
import { BookOpen, Plus, Trash2 } from 'lucide-react';

export default function KnowledgeBaseCard({ config, updateConfig, onSave, isSaving, onAddClick, onEditClick }: AITrainingCardProps & { onAddClick: () => void; onEditClick: (id: string) => void }) {
  const kb = config.knowledgeBase || [];

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-bold text-zinc-900">Knowledge Base</h3>
          <p className="text-sm text-zinc-500 mt-1">Documents and URLs for AI reference.</p>
        </div>
        <button onClick={onAddClick} className="px-3 py-2 bg-indigo-600 text-white text-sm rounded-xl hover:bg-indigo-700 flex items-center gap-1">
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
      {kb.length === 0 ? (
        <p className="text-sm text-zinc-400 py-4 text-center">No knowledge base items yet.</p>
      ) : (
        <div className="space-y-2">
          {kb.map((item: any) => (
            <div key={item.id} className="flex items-center justify-between p-3 bg-zinc-50 rounded-xl">
              <div>
                <p className="text-sm font-semibold text-zinc-800">{item.title}</p>
                <p className="text-xs text-zinc-500">{item.type} • {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : ''}</p>
              </div>
              <button onClick={() => onEditClick(item.id)} className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                Edit
              </button>
            </div>
          ))}
        </div>
      )}
      <button onClick={() => onSave('knowledgeBase')} disabled={isSaving} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all">
        {isSaving ? 'Saving...' : 'Save Knowledge Base'}
      </button>
    </div>
  );
}
