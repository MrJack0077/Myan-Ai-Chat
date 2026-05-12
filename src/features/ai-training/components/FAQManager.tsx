import React, { useState } from 'react';
import { Plus, Trash2, Edit2, MessageSquare, Search } from 'lucide-react';
import { FAQ } from '../../../types';
import { useFAQs } from '../hooks/useFAQs';
import { useTranslation } from 'react-i18next';

export default function FAQManager({ shopId, onUnsynced }: { shopId: string, onUnsynced?: () => void }) {
  const { t } = useTranslation();
  const { faqs, loading, saveFAQ, deleteFAQ } = useFAQs(shopId);
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [faqToDelete, setFaqToDelete] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: 'General'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const faqData = editingFaq ? { ...formData, id: editingFaq.id } : formData;
      await saveFAQ(faqData);
      if (onUnsynced) onUnsynced();
      setIsModalOpen(false);
      setEditingFaq(null);
      setFormData({ question: '', answer: '', category: 'General' });
    } catch (error) {
      console.error('Failed to save FAQ:', error);
    }
  };

  const handleEdit = (faq: FAQ) => {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category || 'General'
    });
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    setFaqToDelete(id);
  };

  const confirmDelete = async () => {
    if (!faqToDelete) return;
    try {
      await deleteFAQ(faqToDelete);
      if (onUnsynced) onUnsynced();
      setFaqToDelete(null);
    } catch (error) {
      console.error('Failed to delete FAQ:', error);
    }
  };

  const filteredFaqs = faqs.filter(faq => 
    (faq.question?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
    (faq.answer?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-bold text-zinc-900">{t('faqs.kb_title')}</h3>
          <p className="text-sm text-zinc-500">{t('faqs.kb_desc')}</p>
        </div>
        <button 
          onClick={() => {
            setEditingFaq(null);
            setFormData({ question: '', answer: '', category: 'General' });
            setIsModalOpen(true);
          }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-indigo-100"
        >
          <Plus className="w-4 h-4" />
          {t('faqs.add_faq')}
        </button>
      </div>

      <div className="relative">
        <Search className="w-5 h-5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
        <input 
          type="text" 
          placeholder={t('faqs.search_placeholder')} 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
        />
      </div>

      {loading ? (
        <div className="py-12 text-center text-zinc-500">{t('faqs.loading')}</div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredFaqs.map(faq => (
            <div key={faq.id} className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:border-indigo-200 transition-all group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-zinc-100 text-zinc-600 rounded text-[10px] font-bold uppercase tracking-wider">
                      {faq.category}
                    </span>
                  </div>
                  <h4 className="font-bold text-zinc-900">Q: {faq.question}</h4>
                  <p className="text-sm text-zinc-600 leading-relaxed">A: {faq.answer}</p>
                </div>
                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all">
                  <button 
                    onClick={() => handleEdit(faq)}
                    className="p-2 hover:bg-indigo-50 text-indigo-600 rounded-lg transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(faq.id)}
                    className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredFaqs.length === 0 && (
            <div className="py-12 text-center bg-zinc-50 rounded-2xl border-2 border-dashed border-zinc-200">
              <MessageSquare className="w-12 h-12 text-zinc-300 mx-auto mb-3" />
              <p className="text-zinc-500 font-medium">{t('faqs.no_faqs')}</p>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg relative z-10 overflow-hidden">
            <form onSubmit={handleSubmit} className="p-8 space-y-6">
              <h3 className="text-2xl font-bold text-zinc-900">
                {editingFaq ? t('faqs.edit_faq') : t('faqs.add_new_faq')}
              </h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('faqs.question')}</label>
                  <input
                    type="text"
                    required
                    value={formData.question}
                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. What is your return policy?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('faqs.answer')}</label>
                  <textarea
                    required
                    rows={4}
                    value={formData.answer}
                    onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                    placeholder="Provide a clear and helpful answer..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('faqs.category')}</label>
                  <input
                    type="text"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    placeholder="e.g. Shipping, General, Returns"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 px-6 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-50 transition-all"
                >
                  {t('common.cancel')}
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all"
                >
                  {editingFaq ? t('faqs.update_faq') : t('faqs.add_faq')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FAQ Delete Confirmation Modal */}
      {faqToDelete && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setFaqToDelete(null)}></div>
          <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-2xl max-w-sm w-full text-center space-y-6 relative z-10">
            <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-zinc-900">Delete FAQ</h3>
              <p className="text-zinc-500 mt-2">{t('faqs.delete_confirm')}</p>
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setFaqToDelete(null)}
                className="flex-1 py-3 bg-zinc-100 text-zinc-700 rounded-xl font-bold hover:bg-zinc-200 transition-all"
              >
                {t('common.cancel')}
              </button>
              <button 
                onClick={confirmDelete}
                className="flex-1 py-3 bg-red-600 text-white rounded-xl font-bold hover:bg-red-700 transition-all"
              >
                {t('common.actions')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
