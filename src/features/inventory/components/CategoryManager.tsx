import React, { useState } from 'react';
import { Plus, Tag, Trash2, X } from 'lucide-react';
import { useCategories } from '../hooks/useCategories';
import { useToast } from '../../../components/Toast';

interface CategoryManagerProps {
  shopId: string;
}

export default function CategoryManager({ shopId }: CategoryManagerProps) {
  const { showToast } = useToast();
  const { categories, loading, addCategory, deleteCategory } = useCategories(shopId);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    
    setIsSaving(true);
    try {
      await addCategory(newCategoryName.trim());
      setNewCategoryName('');
      showToast('Category added', 'success');
    } catch (error) {
      showToast('Failed to add category', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Delete this category?')) {
      try {
        await deleteCategory(id);
        showToast('Category deleted', 'success');
      } catch (error) {
        showToast('Failed to delete category', 'error');
      }
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-zinc-500">Loading categories...</div>;
  }

  return (
    <div className="bg-white w-full rounded-3xl overflow-hidden border border-zinc-200">
      <div className="p-6 border-b border-zinc-100 flex items-center gap-3 bg-zinc-50/50">
        <div className="p-2.5 bg-indigo-600 rounded-xl">
          <Tag className="w-5 h-5 text-white" />
        </div>
        <h2 className="text-xl font-black text-zinc-900 tracking-tight">Manage Categories</h2>
      </div>

      <div className="p-8 space-y-8 flex-1">
        <form onSubmit={handleAdd} className="flex gap-4">
          <input
            type="text"
            required
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            className="flex-1 px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 outline-none transition-all font-medium"
            placeholder="e.g. Clothes, Electronics..."
          />
          <button
            type="submit"
            disabled={isSaving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-6 py-3 rounded-xl font-bold shadow-lg shadow-indigo-100 transition-all flex items-center gap-2 whitespace-nowrap"
          >
            <Plus className="w-5 h-5" />
            Add
          </button>
        </form>

        <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-bold text-zinc-500 uppercase tracking-wider border-b border-zinc-100">
                <th className="pb-3 px-2">Category Name</th>
                <th className="pb-3 px-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {categories.map(cat => (
                <tr key={cat.id} className="group">
                  <td className="py-4 px-2">
                    <span className="text-sm font-bold text-zinc-900">{cat.name}</span>
                  </td>
                  <td className="py-4 px-2 text-right">
                    <button
                      onClick={() => handleDelete(cat.id)}
                      className="p-2 hover:bg-red-50 rounded-lg text-zinc-400 hover:text-red-600 transition-all"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-zinc-500 italic">No categories added yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
