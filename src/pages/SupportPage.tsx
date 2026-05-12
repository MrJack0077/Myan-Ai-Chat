import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Search, 
  RefreshCw, 
  Loader2,
  User,
  ShieldCheck,
  Clock,
  ChevronRight,
  Store
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Shop } from '../types';
import * as shopService from '../services/shopService';
import * as supportService from '../services/supportService';
import { ChatSession } from '../services/supportService';
import SupportChat from '../components/common/SupportChat';
import { formatDistanceToNow } from 'date-fns';
import { useTranslation } from 'react-i18next';

import { useSearchParams } from 'react-router-dom';

export default function SupportPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const initialShopId = searchParams.get('shopId');
  
  const [shops, setShops] = useState<Shop[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeChatShop, setActiveChatShop] = useState<Shop | null>(null);
  const [showMobileChat, setShowMobileChat] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const shopsData = await shopService.getAllShops();
        setShops(shopsData);
        
        if (initialShopId) {
          const shop = shopsData.find(s => s.id === initialShopId);
          if (shop) {
            setActiveChatShop(shop);
            setShowMobileChat(true);
          }
        }
      } catch (error) {
        console.error('Failed to fetch shops:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();

    const unsubscribe = supportService.subscribeToChatSessions((newSessions) => {
      setSessions(newSessions);
    });

    return () => unsubscribe();
  }, []);

  const handleSelectShop = (shop: Shop) => {
    setActiveChatShop(shop);
    setShowMobileChat(true);
  };

  const chatList = shops.map(shop => {
    const session = sessions.find(s => s.id === shop.id);
    return {
      ...shop,
      lastMessage: session?.lastMessage,
      lastTimestamp: session?.lastTimestamp,
      hasActiveSession: !!session
    };
  }).filter(shop => 
    (shop.name?.toLowerCase() || '').includes(searchQuery.toLowerCase())
  ).sort((a, b) => {
    if (a.lastTimestamp && b.lastTimestamp) {
      return new Date(b.lastTimestamp).getTime() - new Date(a.lastTimestamp).getTime();
    }
    if (a.lastTimestamp) return -1;
    if (b.lastTimestamp) return 1;
    return 0;
  });

  return (
    <div className="h-[calc(100vh-120px)] flex flex-col gap-6">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('support.title')}</h1>
          <p className="text-slate-500">{t('support.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={t('support.search_shops')} 
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-64"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
      </header>

      <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col md:flex-row relative">
        {/* Chat List Sidebar */}
        <div className={cn(
          "w-full md:w-80 lg:w-96 border-r border-slate-100 flex flex-col transition-all duration-300",
          showMobileChat ? "hidden md:flex" : "flex"
        )}>
          <div className="p-4 bg-slate-50/50 border-b border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('support.active_conversations')}</h3>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-slate-50">
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mx-auto mb-2" />
                <p className="text-xs text-slate-500">{t('common.loading')}</p>
              </div>
            ) : chatList.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">{t('common.no_data')}</div>
            ) : (
              chatList.map((shop) => (
                <button
                  key={shop.id}
                  onClick={() => handleSelectShop(shop)}
                  className={cn(
                    "w-full p-4 flex items-start gap-3 hover:bg-slate-50 transition-all text-left group",
                    activeChatShop?.id === shop.id && "bg-indigo-50/50"
                  )}
                >
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600 font-bold">
                      {shop.name?.charAt(0) || '?'}
                    </div>
                    {shop.hasActiveSession && (
                      <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h4 className="font-bold text-slate-900 truncate">{shop.name}</h4>
                      {shop.lastTimestamp && (
                        <span className="text-[10px] text-slate-400 whitespace-nowrap">
                          {formatDistanceToNow(new Date(shop.lastTimestamp), { addSuffix: true })}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {shop.lastMessage || t('support.no_messages')}
                    </p>
                  </div>
                  <ChevronRight className={cn(
                    "w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-all self-center",
                    activeChatShop?.id === shop.id && "text-indigo-600"
                  )} />
                </button>
              ))
            )}
          </div>
        </div>

        {/* Chat Area */}
        <div className={cn(
          "flex-1 bg-slate-50/30 flex flex-col transition-all duration-300",
          !showMobileChat ? "hidden md:flex" : "flex"
        )}>
          {activeChatShop ? (
            <div className="w-full h-full flex flex-col">
              <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setShowMobileChat(false)}
                    className="p-2 hover:bg-slate-100 rounded-lg md:hidden"
                  >
                    <ChevronRight className="w-5 h-5 text-slate-500 rotate-180" />
                  </button>
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold">
                    {activeChatShop.name?.charAt(0) || '?'}
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-slate-900">{activeChatShop.name}</h3>
                    <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider">{t('support.online_support')}</p>
                  </div>
                </div>
              </div>
              <div className="flex-1 relative">
                <SupportChat 
                  room={activeChatShop.id} 
                  recipientName={activeChatShop.name} 
                  senderRole="ADMIN" 
                  embed={true}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="max-w-sm">
                <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MessageSquare className="w-8 h-8 text-indigo-600" />
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">{t('support.select_conversation')}</h3>
                <p className="text-sm text-slate-500">
                  {t('support.select_desc')}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
