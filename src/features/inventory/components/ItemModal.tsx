import React, { useState } from 'react';
import { Plus, X, Info, Settings, ShieldCheck, Layers, Trash2, DollarSign, Tag, CheckCircle2, Sparkles } from 'lucide-react';
import { Category, VendorItem, SubItem } from '../../../types';
import { useTranslation } from 'react-i18next';
import { cn, getCurrencySymbol } from '../../../lib/utils';

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingItem: VendorItem | null;
  categories: Category[];
  formData: any;
  setFormData: (data: any) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSaving?: boolean;
  currency?: string;
}

export default function ItemModal({ 
  isOpen, 
  onClose, 
  editingItem, 
  categories, 
  formData, 
  setFormData, 
  onSubmit,
  isSaving = false,
  currency = 'MMK'
}: ItemModalProps) {
  const { t } = useTranslation();

  const symbol = getCurrencySymbol(currency);
  const [activeTab, setActiveTab] = useState<'basic' | 'variations' | 'ai' | 'logistics'>('basic');
  
  if (!isOpen) return null;

  const addSubItem = () => {
    const newSub: SubItem = {
      id: Math.random().toString(36).substr(2, 9),
      name: '',
      item_type: 'product',
      price: parseFloat(formData.price) || 0,
      stock_type: 'count',
      stock_quantity: 0,
      is_available: true
    };
    setFormData({
      ...formData,
      sub_items: [...(formData.sub_items || []), newSub]
    });
  };

  const removeSubItem = (id: string) => {
    setFormData({
      ...formData,
      sub_items: formData.sub_items.filter((s: SubItem) => s.id !== id)
    });
  };

  const updateSubItem = (id: string, field: keyof SubItem, value: any) => {
    setFormData({
      ...formData,
      sub_items: formData.sub_items.map((s: SubItem) => 
        s.id === id ? { ...s, [field]: value } : s
      )
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-3xl relative z-10 overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-4 sm:p-8 overflow-y-auto flex-1">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-zinc-900">
                {editingItem ? t('inventory.edit_item') : t('inventory.add_new')}
              </h3>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-zinc-100 rounded-full transition-all">
              <X className="w-6 h-6 text-zinc-400" />
            </button>
          </div>

          <div className="flex gap-1 p-1 bg-zinc-100 rounded-2xl mb-8 overflow-x-auto">
            <button
              type="button"
              onClick={() => setActiveTab('basic')}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'basic' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Info className="w-4 h-4" />
              {t('inventory.basic')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('variations')}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'variations' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Layers className="w-4 h-4" />
              {t('inventory.variations')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ai')}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'ai' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              {t('inventory.ai_knowledge')}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('logistics')}
              className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'logistics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              {t('inventory.logistics')}
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-8">
            {activeTab === 'basic' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Left Column */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.item_name')}</label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        placeholder={t('inventory.name_placeholder')}
                      />
                    </div>

                    <div className="flex items-end gap-4">
                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.price')} ({symbol})</label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            required
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                            placeholder={t('inventory.price_placeholder')}
                          />
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.stock_management')}</label>
                        <div className="flex p-1 bg-zinc-100 rounded-xl">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, stock_type: 'count' })}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${
                              formData.stock_type === 'count' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500'
                            }`}
                          >
                            {t('inventory.quantity')}
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, stock_type: 'status' })}
                            className={`flex-1 py-2 rounded-lg text-[10px] font-bold transition-all ${
                              formData.stock_type === 'status' ? 'bg-white text-indigo-600 shadow-sm' : 'text-zinc-500'
                            }`}
                          >
                            {t('inventory.status')}
                          </button>
                        </div>
                      </div>
                    </div>

                    {formData.stock_type === 'count' ? (
                      <div>
                        <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.quantity')}</label>
                        <input
                          type="number"
                          value={formData.stock_quantity}
                          onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) })}
                          className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                          placeholder={t('inventory.quantity_placeholder')}
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.availability')}</label>
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, is_available: !formData.is_available })}
                          className={`w-full px-4 py-3 rounded-xl border font-bold transition-all flex items-center justify-center gap-2 ${
                            formData.is_available 
                              ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                              : 'bg-red-50 border-red-200 text-red-700'
                          }`}
                        >
                          {formData.is_available ? t('common.available') : t('common.out_of_stock')}
                        </button>
                      </div>
                    )}

                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.brand')}</label>
                      <input
                        type="text"
                        value={formData.brand || ''}
                        onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        placeholder={t('inventory.brand_placeholder')}
                      />
                    </div>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.category')}</label>
                      <select
                        value={formData.category}
                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all bg-white"
                      >
                        <option value="">{t('inventory.select_category')}</option>
                        {categories.map(cat => <option key={cat.id} value={cat.name}>{cat.name}</option>)}
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.image_url')}</label>
                      <input
                        type="url"
                        value={formData.image_url}
                        onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        placeholder={t('inventory.image_placeholder')}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.description')}</label>
                      <textarea
                        rows={6}
                        required
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                        placeholder={t('inventory.description_placeholder')}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'variations' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-900">{t('inventory.variations')}</h4>
                    <p className="text-xs text-zinc-500">{t('inventory.sub_items_desc')}</p>
                  </div>
                  <button
                    type="button"
                    onClick={addSubItem}
                    className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    {t('inventory.add_variation')}
                  </button>
                </div>

                <div className="space-y-4">
                  {formData.sub_items && formData.sub_items.map((sub: SubItem, idx: number) => (
                    <div key={sub.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-200 space-y-4 relative group">
                      <button
                        type="button"
                        onClick={() => removeSubItem(sub.id)}
                        className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-1">
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{t('inventory.type')}</label>
                          <select
                            value={sub.item_type}
                            onChange={(e) => updateSubItem(sub.id, 'item_type', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                          >
                            <option value="product">{t('common.product')}</option>
                            <option value="service">{t('common.service')}</option>
                          </select>
                        </div>
                        <div className="md:col-span-1">
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{t('inventory.variation_name')}</label>
                          <input
                            type="text"
                            value={sub.name}
                            onChange={(e) => updateSubItem(sub.id, 'name', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="e.g. Size XL / Blue"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{t('inventory.price')} ({symbol})</label>
                          <div className="relative">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-xs">{symbol}</span>
                            <input
                              type="number"
                              step="0.01"
                              value={sub.price}
                              onChange={(e) => updateSubItem(sub.id, 'price', parseFloat(e.target.value))}
                              className="w-full pl-8 pr-3 py-2 rounded-lg border border-zinc-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                              placeholder="0.00"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{t('inventory.stock_mode')}</label>
                          <div className="flex gap-1 p-1 bg-white rounded-lg border border-zinc-200">
                            <button
                              type="button"
                              onClick={() => updateSubItem(sub.id, 'stock_type', 'count')}
                              className={`flex-1 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                                sub.stock_type === 'count' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-600'
                              }`}
                            >
                              {t('inventory.qty')}
                            </button>
                            <button
                              type="button"
                              onClick={() => updateSubItem(sub.id, 'stock_type', 'status')}
                              className={`flex-1 py-1 rounded text-[9px] font-bold uppercase transition-all ${
                                sub.stock_type === 'status' ? 'bg-indigo-600 text-white' : 'text-zinc-400 hover:text-zinc-600'
                              }`}
                            >
                              {t('inventory.stat')}
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="md:col-span-2">
                          <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{t('inventory.image_url')} ({t('common.optional')})</label>
                          <input
                            type="url"
                            value={sub.image_url || ''}
                            onChange={(e) => updateSubItem(sub.id, 'image_url', e.target.value)}
                            className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                            placeholder="https://..."
                          />
                        </div>
                        <div className="md:col-span-2">
                          {sub.stock_type === 'count' ? (
                            <>
                              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{t('inventory.quantity')}</label>
                              <input
                                type="number"
                                value={sub.stock_quantity}
                                onChange={(e) => updateSubItem(sub.id, 'stock_quantity', parseInt(e.target.value))}
                                className="w-full px-3 py-2 rounded-lg border border-zinc-200 text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="0"
                              />
                            </>
                          ) : (
                            <>
                              <label className="block text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{t('inventory.availability')}</label>
                              <button
                                type="button"
                                onClick={() => updateSubItem(sub.id, 'is_available', !sub.is_available)}
                                className={`w-full px-3 py-2 rounded-lg border text-xs font-bold transition-all ${
                                  sub.is_available 
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                    : 'bg-red-50 border-red-200 text-red-700'
                                }`}
                              >
                                {sub.is_available ? t('common.available') : t('common.out_of_stock')}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}

                  {(!formData.sub_items || formData.sub_items.length === 0) && (
                    <div className="text-center py-12 bg-zinc-50 rounded-3xl border border-dashed border-zinc-200">
                      <Layers className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                      <p className="text-sm text-zinc-400 italic">{t('inventory.no_variations')}</p>
                      <button
                        type="button"
                        onClick={addSubItem}
                        className="mt-4 text-indigo-600 text-xs font-bold hover:underline"
                      >
                        {t('inventory.add_first_variation')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}


            {activeTab === 'ai' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex gap-4">
                  <div className="p-2 bg-indigo-100 rounded-xl h-fit">
                    <Sparkles className="w-5 h-5 text-indigo-600" />
                  </div>
                  <p className="text-sm text-indigo-900 leading-relaxed">
                    {t('inventory.ai_training_desc')}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.ai_desc')}</label>
                      <textarea
                        rows={4}
                        value={formData.ai_custom_description || ''}
                        onChange={(e) => setFormData({ ...formData, ai_custom_description: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                        placeholder="Detailed internal notes for the AI to use when describing this item..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.specifications')}</label>
                      <textarea
                        rows={4}
                        value={formData.specifications || ''}
                        onChange={(e) => setFormData({ ...formData, specifications: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                        placeholder="e.g. Weight: 200g, Material: Aluminum, Battery: 20h"
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.keywords')}</label>
                      <input
                        type="text"
                        value={formData.ai_keywords || ''}
                        onChange={(e) => setFormData({ ...formData, ai_keywords: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        placeholder="premium, durable, eco-friendly"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.target_audience')}</label>
                      <input
                        type="text"
                        value={formData.target_audience || ''}
                        onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                        placeholder="e.g. Professionals, Students, Outdoor Enthusiasts"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.usage')}</label>
                      <textarea
                        rows={3}
                        value={formData.usage_instructions || ''}
                        onChange={(e) => setFormData({ ...formData, usage_instructions: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                        placeholder="How should the customer use this item?"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'logistics' && (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.shipping_info')}</label>
                      <textarea
                        rows={3}
                        value={formData.shipping_info}
                        onChange={(e) => setFormData({ ...formData, shipping_info: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                        placeholder="Specific shipping details for this item..."
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.return_policy')}</label>
                      <textarea
                        rows={3}
                        value={formData.return_policy}
                        onChange={(e) => setFormData({ ...formData, return_policy: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                        placeholder="Specific return policy for this item..."
                      />
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.warranty_info')}</label>
                      <textarea
                        rows={3}
                        value={formData.warranty_info}
                        onChange={(e) => setFormData({ ...formData, warranty_info: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                        placeholder="e.g. 1-year manufacturer warranty"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('inventory.special_instructions')}</label>
                      <textarea
                        rows={3}
                        value={formData.internal_notes}
                        onChange={(e) => setFormData({ ...formData, internal_notes: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                        placeholder="Internal notes or special handling instructions..."
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="pt-6 border-t border-zinc-100 flex gap-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-3 rounded-xl font-bold text-zinc-500 hover:bg-zinc-50 transition-all"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className={`flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2 ${
                  isSaving ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isSaving && <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
                {isSaving ? t('inventory.saving') : (editingItem ? t('inventory.save_changes') : t('inventory.add_item'))}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
