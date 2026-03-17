import React from 'react';
import { Package, Tag, Trash2, ShoppingBag, Truck, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface Analytics {
  mostPopularCategory: string;
  outOfStockCount: number;
  totalItems: number;
  faqCount?: number;
  newOrdersCount?: number;
  pendingDeliveryCount?: number;
}

export default function VendorStats({ analytics }: { analytics: Analytics | null }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6 gap-4">
      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{t('dashboard.total_items')}</p>
            <h3 className="text-xl font-bold text-zinc-900">{analytics?.totalItems || 0}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-amber-50 text-amber-600 rounded-xl">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{t('orders.summary.new_orders')}</p>
            <h3 className="text-xl font-bold text-zinc-900">{analytics?.newOrdersCount || 0}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{t('orders.summary.pending_delivery')}</p>
            <h3 className="text-xl font-bold text-zinc-900">{analytics?.pendingDeliveryCount || 0}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Tag className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider truncate">{t('dashboard.popular_category')}</p>
            <h3 className="text-xl font-bold text-zinc-900 truncate">{analytics?.mostPopularCategory || 'N/A'}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-red-50 text-red-600 rounded-xl">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{t('common.out_of_stock')}</p>
            <h3 className="text-xl font-bold text-zinc-900">{analytics?.outOfStockCount || 0}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-zinc-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-purple-50 text-purple-600 rounded-xl">
            <HelpCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">FAQs</p>
            <h3 className="text-xl font-bold text-zinc-900">{analytics?.faqCount || 0}</h3>
          </div>
        </div>
      </div>
    </div>
  );
}
