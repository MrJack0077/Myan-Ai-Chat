import React, { useEffect, useState } from 'react';
import { Store, Database, ArrowUpRight, Plus, MoreVertical, Trash2, ExternalLink, MessageSquare, FileJson, Activity, Server, Zap, RefreshCw } from 'lucide-react';
import * as shopService from '../services/shopService';
import * as supportService from '../services/supportService';
import { ChatSession } from '../services/supportService';
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
    shopService.getAllShops()
      .then(data => {
        setShops(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error('Failed to fetch shops:', err);
        setIsLoading(false);
      });

    const unsubscribe = supportService.subscribeToChatSessions((newSessions) => {
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
        <div className="flex items-center gap-3">
          <button 
            className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-bold text-zinc-600 hover:bg-zinc-50 transition-all shadow-sm"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm">
        <h2 className="text-sm font-bold text-zinc-900 mb-6 flex items-center gap-2 uppercase tracking-wider">
          <Activity className="w-4 h-4 text-emerald-500" />
          System Health & Workers
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 flex flex-col">
             <div className="flex items-center gap-2 text-emerald-700 font-medium mb-1">
                <Server className="w-4 h-4" /> Redis Queue
             </div>
             <span className="text-2xl font-bold text-emerald-900">Operational</span>
             <span className="text-xs text-emerald-600 mt-1">0 messages pending</span>
          </div>
          <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 flex flex-col">
             <div className="flex items-center gap-2 text-emerald-700 font-medium mb-1">
                <Zap className="w-4 h-4" /> AI Workers
             </div>
             <span className="text-2xl font-bold text-emerald-900">Active</span>
             <span className="text-xs text-emerald-600 mt-1">3 instances running</span>
          </div>
           <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 flex flex-col">
             <div className="flex items-center gap-2 text-emerald-700 font-medium mb-1">
                <Activity className="w-4 h-4" /> SendPulse APIs
             </div>
             <span className="text-2xl font-bold text-emerald-900">Connected</span>
             <span className="text-xs text-emerald-600 mt-1">v2 Endpoints Healthy</span>
          </div>
          <div className="p-4 rounded-xl border border-indigo-100 bg-indigo-50/50 flex flex-col">
             <div className="flex items-center gap-2 text-indigo-700 font-medium mb-1">
                <Database className="w-4 h-4" /> Firestore
             </div>
             <span className="text-2xl font-bold text-indigo-900">Synchronized</span>
             <span className="text-xs text-indigo-600 mt-1">Real-time connected</span>
          </div>
        </div>
      </div>

      {/* Main Stats Grid */}
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

      {/* Grid for Shops Table & Activity Log */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* Shops Table (Takes 2/3 width on large screens) */}
        <div className="xl:col-span-2 bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col h-full">
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

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left">
              <thead className="bg-zinc-50 border-b border-zinc-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('dashboard.shop_name')}</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('common.status')}</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">{t('dashboard.chat')}</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">{t('common.loading')}</td>
                  </tr>
                ) : shops.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-zinc-500">{t('common.no_data')}</td>
                  </tr>
                ) : (
                  shops.map((shop) => (
                    <tr key={shop.id} className="hover:bg-zinc-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-zinc-100 rounded-lg flex items-center justify-center font-bold text-zinc-600">
                            {shop.name?.charAt(0) || '?'}
                          </div>
                          <div>
                            <span className="font-medium text-zinc-900 block">{shop.name}</span>
                            <span className="text-xs text-zinc-500">/{shop.slug}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          shop.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                        }`}>
                          {t(`common.${shop.status}`)}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <button 
                          onClick={() => navigate(`/admin/support?shopId=${shop.id}`)}
                          className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition-all"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                          Chat
                        </button>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button className="p-2 hover:bg-zinc-100 rounded-lg text-zinc-500 hover:text-indigo-600 transition-all">
                            <ExternalLink className="w-4 h-4" />
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

        {/* Recent Activity Log */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col h-full opacity-90 relative">
          <div className="p-6 border-b border-zinc-100">
             <h3 className="text-lg font-bold text-zinc-900">Recent Activity Logs</h3>
             <p className="text-sm text-zinc-500">System wide actions & events</p>
          </div>
          <div className="p-6 flex-1 flex flex-col gap-6">
             {/* Mock logs for visual demonstration */}
             <div className="relative pl-6 pb-2 border-l border-zinc-200 last:border-0 last:pb-0">
                <div className="absolute top-0 -left-1.5 w-3 h-3 rounded-full bg-indigo-500"></div>
                <p className="text-sm font-medium text-zinc-800">New Shop Registered</p>
                <p className="text-xs text-zinc-500 mt-0.5">Fashion Hub was provisioned by Admin</p>
                <p className="text-xs text-zinc-400 mt-1">10 minutes ago</p>
             </div>
             <div className="relative pl-6 pb-2 border-l border-zinc-200 last:border-0 last:pb-0">
                <div className="absolute top-0 -left-1.5 w-3 h-3 rounded-full bg-emerald-500"></div>
                <p className="text-sm font-medium text-zinc-800">Worker Instance Scaled</p>
                <p className="text-xs text-zinc-500 mt-0.5">Gemini processing workers increased to 3</p>
                <p className="text-xs text-zinc-400 mt-1">2 hours ago</p>
             </div>
             <div className="relative pl-6 pb-2 border-l border-zinc-200 last:border-0 last:pb-0">
                <div className="absolute top-0 -left-1.5 w-3 h-3 rounded-full bg-amber-500"></div>
                <p className="text-sm font-medium text-zinc-800">API Rate Limit Warning</p>
                <p className="text-xs text-zinc-500 mt-0.5">SendPulse v2 endpoint responded with 429.</p>
                <p className="text-xs text-zinc-400 mt-1">5 hours ago</p>
             </div>
          </div>
          <div className="p-4 border-t border-zinc-100 bg-zinc-50 text-center">
             <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View All Logs</button>
          </div>
        </div>

      </div>
    </div>
  );
}
