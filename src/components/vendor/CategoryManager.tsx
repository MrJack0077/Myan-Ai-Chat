import React from 'react';
import { Plus, Tag, Trash2 } from 'lucide-react';
import { Category, VendorItem } from '../../types';
import { useTranslation } from 'react-i18next';

interface CategoryManagerProps {
  categories: Category[];
  items: VendorItem[];
  newCategoryName: string;
  setNewCategoryName: (name: string) => void;
  onAdd: (e: React.FormEvent) => void;
  onDelete: (id: string) => void;
}

export default function CategoryManager({ 
  categories, 
  items, 
  newCategoryName, 
  setNewCategoryName, 
  onAdd, 
  onDelete 
}: CategoryManagerProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1">
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <h3 className="text-lg font-bold text-zinc-900 mb-4">{t('categories.add_new')}</h3>
          <form onSubmit={onAdd} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-zinc-700 mb-1.5">{t('categories.name')}</label>
              <input
                type="text"
                required
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                placeholder="e.g. Accessories"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {t('categories.add_btn')}
            </button>
          </form>
        </div>
      </div>

      <div className="md:col-span-2">
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('categories.name')}</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('categories.items_count')}</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {categories.map(cat => (
                <tr key={cat.id} className="hover:bg-zinc-50 transition-all">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Tag className="w-4 h-4 text-zinc-400" />
                      <span className="text-sm font-bold text-zinc-900">{cat.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-zinc-500">
                      {items.filter(i => i.category === cat.name).length} {t('common.total_items')}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => onDelete(cat.id)}
                      className="p-2 hover:bg-red-50 rounded-lg text-zinc-400 hover:text-red-600 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
