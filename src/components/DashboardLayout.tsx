import React from 'react';
import { useNavigate, Link, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTranslation } from 'react-i18next';
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
  Languages,
  Database
} from 'lucide-react';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { shopId: urlShopId } = useParams();
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const effectiveShopId = (user?.role === 'ADMIN' && urlShopId) ? urlShopId : user?.shopId;
  const isVendorPath = location.pathname.startsWith('/vendor');

  const toggleLanguage = () => {
    const newLang = i18n.language === 'mm' ? 'en' : 'mm';
    i18n.changeLanguage(newLang);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const adminLinks = [
    { name: t('nav.overview'), path: '/admin', icon: LayoutDashboard },
    { name: t('nav.manage_shops'), path: '/admin/shops', icon: Store },
    { name: t('nav.support_chat'), path: '/admin/support', icon: MessageSquare },
  ];

  const vendorLinks = [
    { name: t('nav.dashboard'), path: effectiveShopId ? `/vendor/${effectiveShopId}` : '/vendor', icon: LayoutDashboard },
    { name: t('nav.orders'), path: effectiveShopId ? `/vendor/${effectiveShopId}/orders` : '/vendor/orders', icon: ShoppingBag },
    { name: t('nav.inventory'), path: effectiveShopId ? `/vendor/${effectiveShopId}/inventory` : '/vendor/inventory', icon: Package },
    { name: t('nav.categories'), path: effectiveShopId ? `/vendor/${effectiveShopId}/categories` : '/vendor/categories', icon: Layers },
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
                {user?.role === 'ADMIN' ? t('common.admin_portal') : `${t('common.vendor')}: ${user?.shop?.name || 'My Shop'}`}
              </h1>
              <button
                onClick={() => {
                  const newRole = user?.role === 'ADMIN' ? 'VENDOR' : 'ADMIN';
                  const newUser = { ...user!, role: newRole };
                  localStorage.setItem('user', JSON.stringify(newUser));
                  window.location.href = newRole === 'ADMIN' ? '/admin' : '/vendor';
                }}
                className="px-2 py-0.5 md:px-3 md:py-1 bg-zinc-100 hover:bg-zinc-200 text-zinc-600 rounded-full text-[8px] md:text-[10px] font-bold uppercase tracking-wider transition-all whitespace-nowrap"
              >
                {t('common.switch_to')} {user?.role === 'ADMIN' ? t('common.vendor') : t('common.admin_portal')}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <button 
              onClick={toggleLanguage}
              className="flex items-center gap-2 px-2 py-1.5 md:px-3 md:py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-xs md:text-sm font-medium text-zinc-600 hover:bg-zinc-100 transition-all"
            >
              <Languages className="w-3.5 h-3.5 md:w-4 md:h-4" />
              <span className="hidden sm:inline">{i18n.language === 'mm' ? 'English' : 'မြန်မာ'}</span>
              <span className="sm:hidden uppercase">{i18n.language === 'mm' ? 'EN' : 'MM'}</span>
            </button>
            <div className="relative hidden lg:block">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="text" 
                placeholder={t('common.search')} 
                className="pl-9 pr-4 py-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none w-48 xl:w-64"
              />
            </div>
            <button className="p-2 hover:bg-zinc-100 rounded-lg relative">
              <Bell className="w-5 h-5 text-zinc-500" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
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

        {/* Page Content */}
        <main className="flex-1 p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
