import React from 'react';
import { Package, Clock, DollarSign, Tag, Edit2, Trash2, Sparkles, Layers } from 'lucide-react';
import { VendorItem } from '../../types';
import { useTranslation } from 'react-i18next';

interface InventoryGridProps {
  items: VendorItem[];
  onEdit: (item: VendorItem) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (item: VendorItem) => void;
  currency?: string;
}

export default function InventoryGrid({ items, onEdit, onDelete, onToggleStatus, currency = 'MMK' }: InventoryGridProps) {
  const { t } = useTranslation();

  const getCurrencySymbol = (code: string) => {
    switch (code) {
      case 'MMK': return 'Ks';
      case 'THB': return '฿';
      case 'USD': return '$';
      default: return '$';
    }
  };

  const symbol = getCurrencySymbol(currency);
  const isAIReady = (item: VendorItem) => {
    return !!(item.ai_custom_description || item.specifications || item.usage_instructions);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {items.map((item) => (
        <div 
          key={item.id} 
          className={`bg-white rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-all overflow-hidden group ${
            item.status === 'inactive' ? 'opacity-75 grayscale-[0.5]' : ''
          }`}
        >
          {item.image_url && (
            <div className="h-48 overflow-hidden bg-zinc-100 relative">
              <img 
                src={item.image_url} 
                alt={item.name} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute top-3 left-3">
                {isAIReady(item) && (
                  <div className="px-3 py-1 bg-indigo-600/90 backdrop-blur-md text-white rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 shadow-lg">
                    <Sparkles className="w-3 h-3" />
                    {t('common.ai_ready')}
                  </div>
                )}
              </div>
              <div className="absolute top-3 right-3">
                <button 
                  onClick={() => onToggleStatus(item)}
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider backdrop-blur-md transition-all ${
                    item.status === 'active' ? 'bg-emerald-500/80 text-white' : 'bg-zinc-500/80 text-white'
                  }`}
                >
                  {t(`common.${item.status}`)}
                </button>
              </div>
            </div>
          )}
          <div className="p-6">
            <div className="flex items-start justify-between mb-4">
              <div className={`p-2.5 rounded-xl ${item.item_type === 'product' ? 'bg-blue-50 text-blue-600' : 'bg-purple-50 text-purple-600'}`}>
                {item.item_type === 'product' ? <Package className="w-6 h-6" /> : <Clock className="w-6 h-6" />}
              </div>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => onEdit(item)}
                  className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onDelete(item.id)}
                  className="p-2 hover:bg-red-50 rounded-lg text-zinc-500 hover:text-red-600 transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                  item.item_type === 'product' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                }`}>
                  {t(`common.${item.item_type}`)}
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                  {item.category}
                </span>
                {item.sub_items && item.sub_items.length > 0 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {item.sub_items.length} {t('common.variations')}
                  </span>
                )}
                {((item.stock_type === 'count' && item.stock_quantity === 0) || (item.stock_type === 'status' && !item.is_available)) ? (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                    {t('common.out_of_stock')}
                  </span>
                ) : item.item_type === 'product' && item.stock_type === 'count' && (item.stock_quantity || 0) <= 5 && (
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 animate-pulse">
                    {t('dashboard.low_stock')}
                  </span>
                )}
              </div>
              <h4 className="text-lg font-bold text-zinc-900 truncate">{item.name}</h4>
              <p className="text-sm text-zinc-500 line-clamp-2 mt-1">{item.description || t('common.no_data')}</p>
              
              {item.ai_keywords && (
                <div className="mt-3 flex flex-wrap gap-1">
                  {item.ai_keywords.split(',').map((kw, i) => (
                    <span key={i} className="text-[9px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded font-medium">
                      #{kw.trim()}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t border-zinc-100">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">{t('common.price')}</p>
                <div className="flex items-center gap-1 text-zinc-900 font-bold">
                  <span className="text-sm">{symbol}</span>
                  {Number(item.price).toLocaleString()}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mb-1">
                  {item.item_type === 'product' ? t('common.stock') : t('common.duration')}
                </p>
                <div className="flex items-center gap-1 text-zinc-900 font-bold">
                  {item.item_type === 'product' ? <Tag className="w-4 h-4 text-zinc-400" /> : <Clock className="w-4 h-4 text-zinc-400" />}
                  {item.item_type === 'product' ? (
                    item.stock_type === 'count' ? `${item.stock_quantity} ${t('inventory.units')}` : (item.is_available ? t('common.available') : t('common.out_of_stock'))
                  ) : item.duration || 'N/A'}
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
