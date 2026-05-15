import React from 'react';
import { Package, Clock, Sparkles, Edit2, Trash2, Layers, Check, X } from 'lucide-react';
import { VendorItem } from '../../../types';
import { useTranslation } from 'react-i18next';
import { getCurrencySymbol } from '../../../lib/utils';

interface InventoryListProps {
  items: VendorItem[];
  onEdit: (item: VendorItem) => void;
  onDelete: (id: string) => void;
  onToggleStatus: (item: VendorItem) => void;
  currency?: string;
}

export default function InventoryList({ items, onEdit, onDelete, onToggleStatus, currency = 'MMK' }: InventoryListProps) {
  const { t } = useTranslation();
  const symbol = getCurrencySymbol(currency);

  const isAIReady = (item: VendorItem) =>
    !!(item.ai_custom_description || item.specifications || item.usage_instructions);

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-3xl border border-zinc-200 p-16 text-center">
        <Package className="w-16 h-16 text-zinc-300 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-zinc-500 mb-2">{t('inventory.no_items')}</h3>
        <p className="text-sm text-zinc-400">{t('inventory.no_items_desc')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
      {/* ── Desktop Table ── */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-zinc-50 border-b border-zinc-200">
              <th className="text-left px-5 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider w-12">
                #
              </th>
              <th className="text-left px-5 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                {t('common.item')}
              </th>
              <th className="text-left px-5 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                {t('common.category')}
              </th>
              <th className="text-right px-5 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                {t('common.price')}
              </th>
              <th className="text-center px-5 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                {t('common.stock')}
              </th>
              <th className="text-center px-5 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider">
                {t('common.status')}
              </th>
              <th className="text-center px-5 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider w-16">
                AI
              </th>
              <th className="text-right px-5 py-4 text-xs font-bold text-zinc-400 uppercase tracking-wider w-20">
                &nbsp;
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {items.map((item, idx) => (
              <tr
                key={item.id}
                className={`group transition-colors hover:bg-zinc-50/80 ${
                  item.status === 'inactive' ? 'opacity-50' : ''
                }`}
              >
                {/* Image + Index */}
                <td className="px-5 py-4 align-middle">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 overflow-hidden flex-shrink-0">
                    {item.image_url ? (
                      <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className={`w-full h-full flex items-center justify-center ${
                        item.item_type === 'product' ? 'bg-blue-50 text-blue-500' : 'bg-purple-50 text-purple-500'
                      }`}>
                        {item.item_type === 'product' ? (
                          <Package className="w-5 h-5" />
                        ) : (
                          <Clock className="w-5 h-5" />
                        )}
                      </div>
                    )}
                  </div>
                </td>

                {/* Name + Description */}
                <td className="px-5 py-4 align-middle">
                  <div className="flex items-center gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-bold text-zinc-900 truncate">
                          {item.name}
                        </span>
                        {item.sub_items && item.sub_items.length > 0 && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded-full flex-shrink-0">
                            <Layers className="w-3 h-3" />
                            {item.sub_items.length}
                          </span>
                        )}
                      </div>
                      {item.description && (
                        <p className="text-xs text-zinc-400 truncate max-w-[240px]">
                          {item.description}
                        </p>
                      )}
                      {item.ai_keywords && (
                        <div className="flex flex-wrap gap-1 mt-1">
                          {item.ai_keywords
                            .split(',')
                            .slice(0, 3)
                            .map((kw, i) => (
                              <span
                                key={i}
                                className="text-[9px] bg-indigo-50 text-indigo-500 px-1.5 py-0.5 rounded font-medium"
                              >
                                #{kw.trim()}
                              </span>
                            ))}
                          {item.ai_keywords.split(',').length > 3 && (
                            <span className="text-[9px] text-zinc-400">
                              +{item.ai_keywords.split(',').length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </td>

                {/* Category */}
                <td className="px-5 py-4 align-middle">
                  <div className="flex flex-col gap-1">
                    <span
                      className={`inline-flex self-start text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        item.item_type === 'product'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-purple-100 text-purple-700'
                      }`}
                    >
                      {t(`common.${item.item_type}`)}
                    </span>
                    {item.category && (
                      <span className="text-xs font-medium text-zinc-600">{item.category}</span>
                    )}
                  </div>
                </td>

                {/* Price */}
                <td className="px-5 py-4 align-middle text-right">
                  <span className="text-sm font-bold text-zinc-900 tabular-nums">
                    {symbol} {Number(item.price).toLocaleString()}
                  </span>
                </td>

                {/* Stock */}
                <td className="px-5 py-4 align-middle text-center">
                  {item.item_type === 'product' ? (
                    item.stock_type === 'count' ? (
                      <span
                        className={`inline-flex items-center gap-1 text-sm font-bold tabular-nums px-2.5 py-1 rounded-xl ${
                          item.stock_quantity === 0
                            ? 'bg-red-50 text-red-600'
                            : item.stock_quantity <= 5
                            ? 'bg-amber-50 text-amber-700'
                            : 'bg-emerald-50 text-emerald-700'
                        }`}
                      >
                        {item.stock_quantity === 0 && (
                          <X className="w-3.5 h-3.5" />
                        )}
                        {item.stock_quantity}
                      </span>
                    ) : item.is_available ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-xl">
                        <Check className="w-3.5 h-3.5" />
                        {t('common.available')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-red-600 bg-red-50 px-2.5 py-1 rounded-xl">
                        <X className="w-3.5 h-3.5" />
                        {t('common.out_of_stock')}
                      </span>
                    )
                  ) : (
                    <span className="text-xs text-zinc-500 bg-zinc-100 px-2.5 py-1 rounded-xl font-medium">
                      {item.duration || 'N/A'}
                    </span>
                  )}
                </td>

                {/* Status toggle */}
                <td className="px-5 py-4 align-middle text-center">
                  <button
                    onClick={() => onToggleStatus(item)}
                    className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl transition-all hover:scale-105 active:scale-95 ${
                      item.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                        : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        item.status === 'active' ? 'bg-emerald-500 shadow-sm shadow-emerald-300' : 'bg-zinc-400'
                      }`}
                    />
                    {t(`common.${item.status}`)}
                  </button>
                </td>

                {/* AI badge */}
                <td className="px-5 py-4 align-middle text-center">
                  {isAIReady(item) && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-full">
                      <Sparkles className="w-3 h-3" />
                      AI
                    </span>
                  )}
                </td>

                {/* Actions */}
                <td className="px-5 py-4 align-middle text-right">
                  <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onEdit(item)}
                      className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400 hover:text-zinc-700 transition-all"
                      title={t('common.edit')}
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(item.id)}
                      className="p-2 hover:bg-red-50 rounded-lg text-zinc-400 hover:text-red-600 transition-all"
                      title={t('common.delete')}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile Cards (fallback) ── */}
      <div className="md:hidden divide-y divide-zinc-100">
        {items.map((item) => (
          <div
            key={item.id}
            className={`p-5 ${item.status === 'inactive' ? 'opacity-50' : ''}`}
          >
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-zinc-100 overflow-hidden flex-shrink-0">
                {item.image_url ? (
                  <img
                    src={item.image_url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div
                    className={`w-full h-full flex items-center justify-center ${
                      item.item_type === 'product'
                        ? 'bg-blue-50 text-blue-500'
                        : 'bg-purple-50 text-purple-500'
                    }`}
                  >
                    {item.item_type === 'product' ? (
                      <Package className="w-6 h-6" />
                    ) : (
                      <Clock className="w-6 h-6" />
                    )}
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h4 className="font-bold text-zinc-900 truncate">{item.name}</h4>
                  <span className="text-sm font-bold text-zinc-900 flex-shrink-0">
                    {symbol} {Number(item.price).toLocaleString()}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                      item.item_type === 'product'
                        ? 'bg-blue-100 text-blue-700'
                        : 'bg-purple-100 text-purple-700'
                    }`}
                  >
                    {t(`common.${item.item_type}`)}
                  </span>
                  {item.category && (
                    <span className="text-[10px] font-bold text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full">
                      {item.category}
                    </span>
                  )}
                  {isAIReady(item) && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                      <Sparkles className="w-3 h-3" /> AI
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => onToggleStatus(item)}
                    className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-xl ${
                      item.status === 'active'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-zinc-100 text-zinc-500'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        item.status === 'active' ? 'bg-emerald-500' : 'bg-zinc-400'
                      }`}
                    />
                    {t(`common.${item.status}`)}
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => onEdit(item)}
                      className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-400"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onDelete(item.id)}
                      className="p-2 hover:bg-red-50 rounded-lg text-zinc-400 hover:text-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
