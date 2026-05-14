import React from 'react';
import { useNavigate, Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '../contexts/NotificationContext';
import { 
  LayoutDashboard, 
  Store, 
  Package, 
  ShoppingBag,
  LogOut, 
  User, 
  Settings,
  Bell,
  Search,
  Menu,
  X,
  Layers,
  BarChart2,
  MessageSquare,
  Bot,
  Zap,
  Languages,
  Database,
  RotateCcw,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { useToast } from './Toast';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);
  const [isNotificationsOpen, setIsNotificationsOpen] = React.useState(false);
  const [isClearingCache, setIsClearingCache] = React.useState(false);
  const [isToolsOpen, setIsToolsOpen] = React.useState(false);
  const [confirmAction, setConfirmAction] = React.useState<string | null>(null);

  // Extract shopId from URL for ADMIN impersonation
  const pathParts = location.pathname.split('/').filter(Boolean);
  let parsedShopId = undefined;
  if (pathParts[0] === 'vendor' && pathParts.length > 1) {
    const knownTabs = ['orders', 'inventory', 'categories', 'ai-training', 'settings', 'analytics', 'customers', 'reviews'];
    if (!knownTabs.includes(pathParts[1])) {
      parsedShopId = pathParts[1];
    }
  }

  const effectiveShopId = (user?.role === 'ADMIN' && parsedShopId) ? parsedShopId : user?.shopId;
  const isVendorPath = location.pathname.startsWith('/vendor');

  const toggleLanguage = () => {
    const newLang = i18n.language === 'mm' ? 'en' : 'mm';
    i18n.changeLanguage(newLang);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleClearCache = async () => {
    if (!effectiveShopId) return;
    setIsClearingCache(true);
    setIsToolsOpen(false);
    try {
      const response = await fetch(`/api/clear-cache/${effectiveShopId}`);
      if (response.ok) {
        const data = await response.json();
        showToast(data.message || "Cache refreshed!", "success");
        // Soft reload — don't break dynamic imports
        setTimeout(() => {
          window.location.href = window.location.pathname + window.location.search;
        }, 1000);
      } else {
        throw new Error('Failed to clear cache');
      }
    } catch (err) {
      console.error('Cache Clear Error:', err);
      showToast("Failed to clear cache.", "error");
    } finally {
      setIsClearingCache(false);
    }
  };

  const handleClearHistory = async () => {
    if (!effectiveShopId) return;
    setIsToolsOpen(false);
    setConfirmAction('history');
  };

  const handleClearAll = async () => {
    if (!effectiveShopId) return;
    setIsToolsOpen(false);
    setConfirmAction('all');
  };

  const executeClearHistory = async () => {
    if (!effectiveShopId) return;
    setIsClearingCache(true);
    setConfirmAction(null);
    try {
      const response = await fetch(`/api/clear-cache/${effectiveShopId}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redis: true, firestore_customers: true, firestore_semantic: false })
      });
      if (response.ok) {
        showToast("Customer history & profiles cleared!", "success");
      }
    } catch (err) {
      showToast("Failed to clear history.", "error");
    } finally {
      setIsClearingCache(false);
    }
  };

  const executeClearAll = async () => {
    if (!effectiveShopId) return;
    setIsClearingCache(true);
    setConfirmAction(null);
    try {
      // Clear both cache and history
      await fetch(`/api/clear-cache/${effectiveShopId}`);
      await fetch(`/api/clear-cache/${effectiveShopId}/history`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redis: true, firestore_customers: true, firestore_semantic: true })
      });
      showToast("All cache & memory cleared! Fresh start.", "success");
      setTimeout(() => {
        window.location.href = window.location.pathname + window.location.search;
      }, 1000);
    } catch (err) {
      showToast("Failed to clear all.", "error");
    } finally {
      setIsClearingCache(false);
    }
  };

  const adminLinks = [
    { name: t('nav.overview'), path: '/admin', icon: LayoutDashboard },
    { name: t('nav.manage_shops'), path: '/admin/shops', icon: Store },
    { name: t('nav.support_chat'), path: '/admin/support', icon: MessageSquare },
  ];

  const vendorLinks = [
    { name: t('nav.dashboard'), path: effectiveShopId ? `/vendor/${effectiveShopId}` : '/vendor', icon: LayoutDashboard },
    { name: t('nav.orders'), path: effectiveShopId ? `/vendor/${effectiveShopId}/orders` : '/vendor/orders', icon: ShoppingBag },
    { name: t('nav.customers'), path: effectiveShopId ? `/vendor/${effectiveShopId}/customers` : '/vendor/customers', icon: User },
    { name: t('nav.inventory'), path: effectiveShopId ? `/vendor/${effectiveShopId}/inventory` : '/vendor/inventory', icon: Package },
    { name: t('nav.categories'), path: effectiveShopId ? `/vendor/${effectiveShopId}/categories` : '/vendor/categories', icon: Layers },
    { name: t('nav.analytics'), path: effectiveShopId ? `/vendor/${effectiveShopId}/analytics` : '/vendor/analytics', icon: BarChart2 },
    { name: t('nav.ai_training'), path: effectiveShopId ? `/vendor/${effectiveShopId}/ai-training` : '/vendor/ai-training', icon: Bot },
    { name: t('nav.shop_settings'), path: effectiveShopId ? `/vendor/${effectiveShopId}/settings` : '/vendor/settings', icon: Settings },
  ];

  const links = (user?.role === 'ADMIN' && !isVendorPath) ? adminLinks : vendorLinks;

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm z-50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-64 bg-white z-50 transform transition-transform duration-300 ease-in-out md:hidden flex flex-col ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Store className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl text-zinc-900">{t('common.shop_manager')}</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 hover:bg-zinc-100 rounded-lg">
            <X className="w-5 h-5 text-zinc-500" />
          </button>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {user?.role === 'ADMIN' && isVendorPath && (
            <Link
              to="/admin/shops"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-amber-600 bg-amber-50 hover:bg-amber-100 transition-all mb-4 border border-amber-200"
            >
              <Store className="w-5 h-5 shrink-0" />
              <span className="font-bold text-sm">Back to Admin</span>
            </Link>
          )}
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = link.path === '/vendor' || link.path === '/admin' 
              ? location.pathname === link.path 
              : location.pathname.startsWith(link.path);
            
            return (
              <Link
                key={link.name}
                to={link.path}
                onClick={() => setIsMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-600' 
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="font-medium">{link.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            <span className="font-medium">{t('nav.logout')}</span>
          </button>
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside className={`bg-white border-r border-zinc-200 transition-all duration-300 ${isSidebarOpen ? 'w-64' : 'w-20'} hidden md:flex flex-col sticky top-0 h-screen shrink-0`}>
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shrink-0">
            <Store className="text-white w-5 h-5" />
          </div>
          {isSidebarOpen && <span className="font-bold text-xl text-zinc-900 truncate">{t('common.shop_manager')}</span>}
        </div>

        <nav className="flex-1 px-4 space-y-1">
          {user?.role === 'ADMIN' && isVendorPath && (
            <Link
              to="/admin/shops"
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-amber-600 bg-amber-50 hover:bg-amber-100 transition-all mb-4 border border-amber-200"
            >
              <Store className="w-5 h-5 shrink-0" />
              {isSidebarOpen && <span className="font-bold text-sm">Back to Admin</span>}
            </Link>
          )}
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = link.path === '/vendor' || link.path === '/admin' 
              ? location.pathname === link.path 
              : location.pathname.startsWith(link.path);
            
            return (
              <Link
                key={link.name}
                to={link.path}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-indigo-50 text-indigo-600' 
                    : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {isSidebarOpen && <span className="font-medium">{link.name}</span>}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-zinc-100">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-red-500 hover:bg-red-50 transition-all"
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {isSidebarOpen && <span className="font-medium">{t('nav.logout')}</span>}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-4 md:px-6 sticky top-0 z-10">
          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 hover:bg-zinc-100 rounded-lg md:block hidden"
            >
              <Menu className="w-5 h-5 text-zinc-500" />
            </button>
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 hover:bg-zinc-100 rounded-lg md:hidden block"
            >
              <Menu className="w-5 h-5 text-zinc-500" />
            </button>
            <div className="flex items-center gap-2 md:gap-3">
              <h1 className="text-sm md:text-lg font-semibold text-zinc-900 truncate max-w-[120px] md:max-w-none">
                {user?.role === 'ADMIN' 
                  ? (isVendorPath ? t('common.vendor') : t('common.admin_portal')) 
                  : `${t('common.vendor')}: ${user?.shop?.name || 'My Shop'}`}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {isVendorPath && effectiveShopId && (
              <div className="relative">
                <button 
                  onClick={() => setIsToolsOpen(!isToolsOpen)}
                  disabled={isClearingCache}
                  title="Maintenance Tools"
                  className="flex items-center gap-2 px-2 py-1.5 md:px-3 md:py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs md:text-sm font-medium text-amber-600 hover:bg-amber-100 transition-all disabled:opacity-50"
                >
                  <RotateCcw className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isClearingCache ? 'animate-spin' : ''}`} />
                  <span className="hidden sm:inline">Tools</span>
                </button>

                {isToolsOpen && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsToolsOpen(false)} />
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border border-zinc-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                      <div className="p-3 border-b border-zinc-100 bg-zinc-50">
                        <h3 className="text-sm font-bold text-zinc-900">🛠️ Maintenance Tools</h3>
                        <p className="text-xs text-zinc-500 mt-0.5">Clear cache & customer data</p>
                      </div>
                      <div className="p-2">
                        <button onClick={handleClearCache} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-indigo-50 transition-all group">
                          <RotateCcw className="w-4 h-4 text-indigo-500 group-hover:text-indigo-600" />
                          <div>
                            <p className="font-medium text-zinc-800">Refresh Cache</p>
                            <p className="text-xs text-zinc-400">Redis + prompt cache</p>
                          </div>
                        </button>
                        <button onClick={handleClearHistory} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-orange-50 transition-all group">
                          <Trash2 className="w-4 h-4 text-orange-500 group-hover:text-orange-600" />
                          <div>
                            <p className="font-medium text-zinc-800">Clear History</p>
                            <p className="text-xs text-zinc-400">Chat + profiles (keeps orders)</p>
                          </div>
                        </button>
                        <button onClick={handleClearAll} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left hover:bg-red-50 transition-all group">
                          <AlertTriangle className="w-4 h-4 text-red-500 group-hover:text-red-600" />
                          <div>
                            <p className="font-medium text-zinc-800">Clear All</p>
                            <p className="text-xs text-zinc-400">Cache + history + semantic</p>
                          </div>
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
            <button 
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-2 py-1.5 md:px-3 md:py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs md:text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition-all"
            >
              <Languages className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{i18n.language === 'mm' ? 'English' : 'မြန်မာ'}</span>
              <span className="sm:hidden uppercase">{i18n.language === 'mm' ? 'EN' : 'MM'}</span>
            </button>
            <div className="relative">
              <button 
                onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
                className="p-2 hover:bg-zinc-100 rounded-lg relative"
              >
                <Bell className="w-5 h-5 text-zinc-500" />
                {unreadCount > 0 && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-red-500 text-white text-[8px] font-bold flex items-center justify-center rounded-full border-2 border-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {isNotificationsOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setIsNotificationsOpen(false)} />
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-xl border border-zinc-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="p-4 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
                      <h3 className="font-bold text-zinc-900">{t('common.notifications')}</h3>
                      <button 
                        onClick={() => {
                          markAllAsRead();
                          setIsNotificationsOpen(false);
                        }}
                        className="text-xs text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        {t('common.mark_all_read')}
                      </button>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-8 text-center">
                          <Bell className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                          <p className="text-sm text-zinc-500">{t('common.no_notifications')}</p>
                        </div>
                      ) : (
                        notifications.map(notification => (
                          <div 
                            key={notification.id}
                            className={`p-4 border-b border-zinc-50 hover:bg-zinc-50 transition-all cursor-pointer ${!notification.read ? 'bg-indigo-50/30' : ''}`}
                            onClick={() => {
                              markAsRead(notification.id);
                              if (notification.link) navigate(notification.link);
                              setIsNotificationsOpen(false);
                            }}
                          >
                            <div className="flex gap-3">
                              <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${!notification.read ? 'bg-indigo-600' : 'bg-transparent'}`} />
                              <div>
                                <p className="text-sm font-bold text-zinc-900">{notification.title}</p>
                                <p className="text-xs text-zinc-500 mt-0.5">{notification.message}</p>
                                <p className="text-[10px] text-zinc-400 mt-1">
                                  {new Date(notification.timestamp).toLocaleTimeString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center gap-2 md:gap-3 pl-2 md:pl-4 border-l border-zinc-200">
              <div className="text-right hidden lg:block">
                <p className="text-sm font-semibold text-zinc-900">{user?.email}</p>
                <p className="text-xs text-zinc-500 capitalize">{user?.role?.toLowerCase() || ''}</p>
              </div>
              <div className="w-8 h-8 md:w-9 md:h-9 bg-zinc-100 rounded-full flex items-center justify-center border border-zinc-200">
                <User className="w-4 h-4 md:w-5 md:h-5 text-zinc-500" />
              </div>
            </div>
          </div>
        </header>

        {/* Confirmation Modal */}
        {confirmAction && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center">
            <div className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm" onClick={() => setConfirmAction(null)} />
            <div className="relative bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4 z-10">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-5 h-5 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">
                    {confirmAction === 'history' ? 'Clear History?' : 'Clear All?'}
                  </h3>
                  <p className="text-sm text-zinc-500">
                    {confirmAction === 'history' 
                      ? 'Chat history & profiles will be deleted. Orders kept.' 
                      : 'All cache, history & semantic data will be permanently deleted.'}
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button 
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 px-4 py-2.5 border border-zinc-200 rounded-xl text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmAction === 'history' ? executeClearHistory : executeClearAll}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-all"
                >
                  Yes, Clear
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Page Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
