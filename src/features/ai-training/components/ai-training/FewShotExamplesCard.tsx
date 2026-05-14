import React, { useState } from 'react';
import { AITrainingCardProps } from './types';
import { Plus, Trash2 } from 'lucide-react';

export default function FewShotExamplesCard({ config, updateConfig, onSave, isSaving }: AITrainingCardProps) {
  const examples = config.fewShotExamples || [];
  const [newUser, setNewUser] = useState('');
  const [newAssistant, setNewAssistant] = useState('');

  const addExample = () => {
    if (!newUser.trim() || !newAssistant.trim()) return;
    updateConfig({
      fewShotExamples: [...examples, { user: newUser.trim(), assistant: newAssistant.trim() }]
    });
    setNewUser('');
    setNewAssistant('');
  };

  const removeExample = (index: number) => {
    updateConfig({ fewShotExamples: examples.filter((_: any, i: number) => i !== index) });
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-6">
      <h3 className="text-lg font-bold text-zinc-900 mb-4">Few-Shot Examples</h3>
      <p className="text-sm text-zinc-500 mb-4">Teach the AI how to respond with example Q&A pairs.</p>
      
      <div className="space-y-3 mb-4">
        {examples.map((ex: any, i: number) => (
          <div key={i} className="flex items-start gap-3 p-3 bg-zinc-50 rounded-xl">
            <div className="flex-1">
              <p className="text-sm font-semibold text-zinc-800">👤 {ex.user}</p>
              <p className="text-sm text-zinc-600 mt-1">🤖 {ex.assistant}</p>
            </div>
            <button onClick={() => removeExample(i)} className="text-red-500 hover:text-red-700 p-1">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <input value={newUser} onChange={e => setNewUser(e.target.value)} placeholder="Customer message" className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        <input value={newAssistant} onChange={e => setNewAssistant(e.target.value)} placeholder="AI response" className="w-full px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        <button onClick={addExample} className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-sm">
          <Plus className="w-4 h-4 inline mr-1" /> Add Example
        </button>
      </div>

      <button onClick={() => onSave('fewShotExamples')} disabled={isSaving} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all">
        {isSaving ? 'Saving...' : 'Save Examples'}
      </button>
    </div>
  );
}
