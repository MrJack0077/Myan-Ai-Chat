import React, { useEffect, useState } from 'react';
import { Store, Database, ArrowUpRight, Plus, MoreVertical, Trash2, ExternalLink, MessageSquare, FileJson } from 'lucide-react';
import { getAllShops, subscribeToChatSessions, ChatSession } from '../services/firebaseService';
import { Shop } from '../types';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import SystemExportModal from '../components/admin/SystemExportModal';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [shops, setShops] = useState<Shop[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  useEffect(() => {
    getAllShops()
      .then(data => {
        setShops(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch shops:', err);
        setIsLoading(false);
      });

    const unsubscribe = subscribeToChatSessions((newSessions) => {
      setSessions(newSessions);
    });

    return () => unsubscribe();
  }, []);

  const stats = [
    { name: t('dashboard.total_shops'), value: shops.length, icon: Store, color: 'bg-indigo-500' },
    { name: t('dashboard.active_chats'), value: sessions.length, icon: MessageSquare, color: 'bg-indigo-600' },
    { name: t('dashboard.databases'), value: shops.length, icon: Database, color: 'bg-amber-500' },
  ];

  return (
    <div className="space-y-8">
      {/* Header with Export */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">{t('nav.overview')}</h1>
          <p className="text-sm text-zinc-500">{t('dashboard.overview_desc')}</p>
        </div>
        <button 
          onClick={() => setIsExportModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-all shadow-sm"
        >
          <FileJson className="w-4 h-4" />
          Export System JSON
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm hover:shadow-md transition-all group">
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.color} p-3 rounded-xl shadow-lg shadow-zinc-100`}>
                  <Icon className="text-white w-6 h-6" />
                </div>
                <button className="text-zinc-400 hover:text-zinc-900 transition-colors">
                  <ArrowUpRight className="w-5 h-5" />
                </button>
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-500 mb-1">{stat.name}</p>
                <p className="text-2xl font-bold text-zinc-900">{stat.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Shops Table */}
      <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-zinc-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-zinc-900">{t('dashboard.manage_all_shops')}</h3>
            <p className="text-sm text-zinc-500">{t('dashboard.shops_overview_desc')}</p>
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 transition-all">
            <Plus className="w-4 h-4" />
            {t('dashboard.new_shop')}
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-zinc-50 border-b border-zinc-100">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('dashboard.shop_name')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('dashboard.slug')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('common.status')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('dashboard.created_at')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('dashboard.chat')}</th>
                <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">{t('common.loading')}</td>
                </tr>
              ) : shops.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">{t('common.no_data')}</td>
                </tr>
              ) : (
                shops.map((shop) => (
                  <tr key={shop.id} className="hover:bg-zinc-50/50 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center font-bold text-zinc-600">
                          {shop.name?.charAt(0) || '?'}
                        </div>
                        <span className="font-medium text-zinc-900">{shop.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500">/{shop.slug}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                        shop.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                      }`}>
                        {t(`common.${shop.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-zinc-500">
                      {shop.createdAt ? new Date(shop.createdAt).toLocaleDateString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => navigate(`/admin/support?shopId=${shop.id}`)}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        {t('dashboard.open_chat')}
                      </button>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-indigo-600 transition-all">
                          <ExternalLink className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-red-600 transition-all">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <button className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SystemExportModal 
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        shops={shops}
      />
    </div>
  );
}
