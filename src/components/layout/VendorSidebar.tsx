import React from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  Sparkles, 
  Settings, 
  ChevronLeft, 
  ChevronRight,
  LogOut
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '../../lib/utils';
import { Shop } from '../../types';

interface VendorSidebarProps {
  activeTab: string;
  setActiveTab: (tab: any) => void;
  isSidebarOpen: boolean;
  setIsSidebarOpen: (open: boolean) => void;
  currentShop: Shop | null;
  onLogout: () => void;
}

export default function VendorSidebar({
  activeTab,
  setActiveTab,
  isSidebarOpen,
  setIsSidebarOpen,
  currentShop,
  onLogout
}: VendorSidebarProps) {
  const { t } = useTranslation();

  const tabs = [
    { id: 'overview', name: t('nav.overview'), icon: LayoutDashboard },
    { id: 'inventory', name: t('nav.inventory'), icon: Package },
    { id: 'orders', name: t('nav.orders'), icon: ShoppingCart },
    { id: 'customers', name: t('nav.customers'), icon: Users },
    { id: 'ai-training', name: t('nav.ai_training'), icon: Sparkles },
    { id: 'settings', name: t('nav.settings'), icon: Settings },
  ] as const;

  return (
    <div className={cn(
      "fixed left-0 top-0 h-full bg-white border-r border-zinc-200 transition-all duration-300 z-50 flex flex-col group",
      isSidebarOpen ? "w-64" : "w-20"
    )}>
      {/* Sidebar Toggle */}
      <button 
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-zinc-200 rounded-full flex items-center justify-center text-zinc-400 hover:text-indigo-600 shadow-sm z-50 transition-all"
      >
        {isSidebarOpen ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Profile / Shop Info */}
      <div className={cn("p-6 flex items-center gap-3", !isSidebarOpen && "justify-center")}>
        <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-bold shrink-0 shadow-lg shadow-indigo-100">
          {currentShop?.name?.charAt(0) || 'V'}
        </div>
        {isSidebarOpen && (
          <div className="overflow-hidden">
            <p className="font-bold text-zinc-900 truncate tracking-tight">{currentShop?.name || 'Vendor Admin'}</p>
            <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Shop Manager</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-1.5 scrollbar-hide">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group/item relative",
                isActive 
                  ? "bg-indigo-50 text-indigo-600" 
                  : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900"
              )}
            >
              <Icon className={cn("w-5 h-5 shrink-0 transition-transform duration-200", isActive && "scale-110")} />
              {isSidebarOpen && <span className="font-bold text-sm tracking-tight">{tab.name}</span>}
              {!isSidebarOpen && (
                <div className="absolute left-16 bg-zinc-900 text-white px-2 py-1 rounded text-[10px] font-bold opacity-0 group-hover/item:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {tab.name}
                </div>
              )}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-indigo-600 rounded-r-full" />
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-4 border-t border-zinc-100">
        <button 
          onClick={onLogout}
          className={cn(
            "w-full flex items-center gap-3 px-4 py-3 text-red-500 hover:bg-red-50 rounded-2xl transition-all group/logout relative",
            !isSidebarOpen && "justify-center"
          )}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {isSidebarOpen && <span className="font-bold text-sm tracking-tight">Logout</span>}
          {!isSidebarOpen && (
            <div className="absolute left-16 bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold opacity-0 group-hover/logout:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
              Logout
            </div>
          )}
        </button>
      </div>
    </div>
  );
}
