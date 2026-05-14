import React, { useState } from 'react';
import { AITrainingCardProps } from './types';
import { Plus, Trash2 } from 'lucide-react';

export default function FAQsCard({ config, updateConfig, onSave, isSaving }: AITrainingCardProps) {
  const faqs = config.faqs || [];
  const [newQ, setNewQ] = useState('');
  const [newA, setNewA] = useState('');

  const addFAQ = () => {
    if (!newQ.trim() || !newA.trim()) return;
    updateConfig({
      faqs: [...faqs, { id: Date.now().toString(), question: newQ.trim(), answer: newA.trim() }]
    });
    setNewQ('');
    setNewA('');
  };

  const removeFAQ = (id: string) => {
    updateConfig({ faqs: faqs.filter((f: any) => f.id !== id) });
  };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 p-6">
      <h3 className="text-lg font-bold text-zinc-900 mb-4">FAQs</h3>
      <p className="text-sm text-zinc-500 mb-4">Pre-defined Q&A pairs for common customer questions.</p>
      
      <div className="space-y-3 mb-4">
        {faqs.map((faq: any) => (
          <div key={faq.id} className="flex items-start gap-3 p-3 bg-zinc-50 rounded-xl">
            <div className="flex-1">
              <p className="text-sm font-semibold text-zinc-800">Q: {faq.question}</p>
              <p className="text-sm text-zinc-600 mt-1">A: {faq.answer}</p>
            </div>
            <button onClick={() => removeFAQ(faq.id)} className="text-red-500 hover:text-red-700 p-1">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input value={newQ} onChange={e => setNewQ(e.target.value)} placeholder="Question" className="flex-1 px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        <input value={newA} onChange={e => setNewA(e.target.value)} placeholder="Answer" className="flex-1 px-3 py-2 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        <button onClick={addFAQ} className="px-3 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700">
          <Plus className="w-4 h-4" />
        </button>
      </div>

      <button onClick={() => onSave('faqs')} disabled={isSaving} className="mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all">
        {isSaving ? 'Saving...' : 'Save FAQs'}
      </button>
    </div>
  );
}
