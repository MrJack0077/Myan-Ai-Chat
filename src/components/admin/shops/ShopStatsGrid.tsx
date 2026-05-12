import React from 'react';
import { useTranslation } from 'react-i18next';
import { Store, Database, MessageSquare } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { Shop } from '../../../types';

interface ShopStatsGridProps {
  shops: Shop[];
}

export default function ShopStatsGrid({ shops }: ShopStatsGridProps) {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
      {[
        { label: t('dashboard.total_shops'), value: shops.length, icon: Store, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: t('shops.active_dbs'), value: shops.filter(s => s.status === 'active').length, icon: Database, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: t('shops.sendpulse_links'), value: shops.filter(s => s.sendpulseBotIds && s.sendpulseBotIds.length > 0).length, icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-50' },
      ].map((stat, i) => (
        <div key={i} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className={cn("p-2 rounded-lg", stat.bg)}>
              <stat.icon className={cn("w-5 h-5", stat.color)} />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">{stat.value}</div>
          <div className="text-sm text-slate-500">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
