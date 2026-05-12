import React from 'react';
import { 
  Package, 
  Search, 
  Plus, 
  Layers, 
  Download, 
  Upload, 
  Filter, 
  ChevronDown,
  RefreshCw 
} from 'lucide-react';
import { VendorItem, Category } from '../../../types';
import InventoryGrid from './InventoryGrid';
import CategoryManager from './CategoryManager';
import { useTranslation } from 'react-i18next';

interface InventoryManagerProps {
  items: VendorItem[];
  categories: Category[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedCategory: string;
  setSelectedCategory: (cat: string) => void;
  isCategoryManagerOpen: boolean;
  setIsCategoryManagerOpen: (open: boolean) => void;
  handleAddItem: () => void;
  setIsBulkModalOpen: (open: boolean) => void;
  setIsImportModalOpen: (open: boolean) => void;
  handleExportCSV: () => void;
  onEditItem: (item: VendorItem) => void;
  onDeleteItem: (id: string) => void;
  onToggleStatus: (item: VendorItem) => void;
  currency: string;
  refreshCategories: () => void;
  effectiveShopId: string | undefined;
  hasPendingSync?: boolean;
  onSyncAI?: () => void;
}

export default function InventoryManager({
  items,
  categories,
  searchQuery,
  setSearchQuery,
  selectedCategory,
  setSelectedCategory,
  isCategoryManagerOpen,
  setIsCategoryManagerOpen,
  handleAddItem,
  setIsBulkModalOpen,
  setIsImportModalOpen,
  handleExportCSV,
  onEditItem,
  onDeleteItem,
  onToggleStatus,
  currency,
  refreshCategories,
  effectiveShopId,
  hasPendingSync,
  onSyncAI
}: InventoryManagerProps) {
  const { t } = useTranslation();

  const filteredItems = items.filter(item => {
    const itemName = item.name || '';
    const itemDescription = item.description || '';
    const itemCategory = item.category || '';
    
    const matchesSearch = itemName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         itemDescription.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'all' || itemCategory === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-4 flex-1">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
            <input 
              type="text" 
              placeholder={t('inventory.search_placeholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-medium"
            />
          </div>
          <div className="relative group">
            <select 
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none pl-4 pr-10 py-3 bg-zinc-50 border border-zinc-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 transition-all text-sm font-bold text-zinc-700 cursor-pointer"
            >
              <option value="all">{t('inventory.all_categories')}</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.name}>{cat.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
          </div>
          <button 
            onClick={() => setIsCategoryManagerOpen(true)}
            className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl hover:bg-indigo-100 transition-all"
            title="Manage Categories"
          >
            <Layers className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-zinc-100 p-1 rounded-2xl border border-zinc-200">
            <button 
              onClick={handleExportCSV}
              className="p-2.5 text-zinc-600 hover:text-indigo-600 hover:bg-white rounded-xl transition-all"
              title="Export CSV"
            >
              <Download className="w-5 h-5" />
            </button>
            <div className="w-px h-5 bg-zinc-200 mx-1"></div>
            <button 
              onClick={() => setIsImportModalOpen(true)}
              className="p-2.5 text-zinc-600 hover:text-indigo-600 hover:bg-white rounded-xl transition-all"
              title="Import CSV"
            >
              <Upload className="w-5 h-5" />
            </button>
            <div className="w-px h-5 bg-zinc-200 mx-1"></div>
            <button 
              onClick={() => setIsBulkModalOpen(true)}
              className="p-2.5 text-zinc-600 hover:text-indigo-600 hover:bg-white rounded-xl transition-all"
              title="Bulk Stock Update"
            >
              <Filter className="w-5 h-5" />
            </button>
          </div>

          {hasPendingSync && (
            <button 
              onClick={onSyncAI}
              className="group flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-2xl font-bold shadow-lg shadow-amber-100 hover:bg-amber-600 transition-all animate-in fade-in zoom-in duration-300"
            >
              <RefreshCw className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" />
              Sync to AI
            </button>
          )}

          <button 
            onClick={handleAddItem}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            <Plus className="w-5 h-5" />
            {t('inventory.add_item')}
          </button>
        </div>
      </div>

      <InventoryGrid 
        items={filteredItems} 
        onEdit={onEditItem} 
        onDelete={onDeleteItem}
        onToggleStatus={onToggleStatus}
        currency={currency}
      />

      {isCategoryManagerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setIsCategoryManagerOpen(false)} />
          <div className="relative w-full max-w-lg z-10 bg-white rounded-3xl overflow-hidden shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-zinc-100 bg-zinc-50/50">
               <span className="font-bold">Manage Categories</span>
               <button
                 onClick={() => setIsCategoryManagerOpen(false)}
                 className="p-2 bg-zinc-100 hover:bg-zinc-200 rounded-xl transition-all"
               >
                 <span className="text-zinc-600 font-bold overflow-hidden w-5 h-5 flex items-center justify-center">X</span>
               </button>
            </div>
            <CategoryManager 
              shopId={effectiveShopId || ''}
            />
          </div>
        </div>
      )}
    </div>
  );
}
