import React from 'react';
import { useTranslation } from 'react-i18next';
import { 
  Search, 
  ChevronUp, 
  ChevronDown, 
  Store, 
  CheckCircle2, 
  Loader2, 
  AlertCircle, 
  Database, 
  Copy, 
  MessageSquare, 
  LayoutDashboard, 
  Settings, 
  Trash2 
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../../../lib/utils';
import { Shop, SortField, SortOrder } from '../../../types';
import { useToast } from '../../../components/Toast';
import { format } from 'date-fns';

interface ShopListTableProps {
  loading: boolean;
  shops: Shop[];
  paginatedShops: Shop[];
  filteredShops: Shop[];
  selectedIds: Set<string>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  sortField: SortField;
  sortOrder: SortOrder;
  handleSort: (field: SortField) => void;
  toggleSelectAll: () => void;
  toggleSelect: (id: string, e: React.MouseEvent) => void;
  setSelectedShop: (shop: Shop) => void;
  setIsDrawerOpen: (isOpen: boolean) => void;
  handleOpenEdit: (shop: Shop, e?: React.MouseEvent) => void;
  handleUpdateStatus: (id: string, status: string, e?: React.MouseEvent) => void;
  handlePing: (id: string, e?: React.MouseEvent) => void;
  pingingId: string | null;
  handleDeleteShop: (shop: Shop, e?: React.MouseEvent) => void;
  currentPage: number;
  setCurrentPage: React.Dispatch<React.SetStateAction<number>>;
  itemsPerPage: number;
  totalPages: number;
  setIsModalOpen: (val: boolean) => void;
  setModalMode: (val: 'create' | 'edit') => void;
}

export default function ShopListTable({
  loading,
  paginatedShops,
  filteredShops,
  selectedIds,
  searchQuery,
  setSearchQuery,
  statusFilter,
  setStatusFilter,
  sortField,
  sortOrder,
  handleSort,
  toggleSelectAll,
  toggleSelect,
  setSelectedShop,
  setIsDrawerOpen,
  handleOpenEdit,
  handleUpdateStatus,
  handlePing,
  pingingId,
  handleDeleteShop,
  currentPage,
  setCurrentPage,
  itemsPerPage,
  totalPages,
  setIsModalOpen,
  setModalMode
}: ShopListTableProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { showToast } = useToast();

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder={t('shops.search_placeholder')} 
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-white border border-slate-200 rounded-xl flex items-center p-1">
            <button 
              onClick={() => setStatusFilter('all')}
              className={cn("px-3 py-1.5 text-xs font-semibold rounded-lg transition-all", statusFilter === 'all' ? "bg-slate-100 text-slate-800" : "text-slate-500 hover:text-slate-700")}
            >
              {t('shops.all_status')}
            </button>
            <button 
              onClick={() => setStatusFilter('active')}
              className={cn("px-3 py-1.5 text-xs font-semibold rounded-lg transition-all", statusFilter === 'active' ? "bg-emerald-50 text-emerald-700" : "text-slate-500 hover:text-emerald-700")}
            >
              Active
            </button>
            <button 
              onClick={() => setStatusFilter('suspended')}
              className={cn("px-3 py-1.5 text-xs font-semibold rounded-lg transition-all", statusFilter === 'suspended' ? "bg-amber-50 text-amber-700" : "text-slate-500 hover:text-amber-700")}
            >
              Suspended
            </button>
             <button 
              onClick={() => setStatusFilter('provisioning')}
              className={cn("px-3 py-1.5 text-xs font-semibold rounded-lg transition-all", statusFilter === 'provisioning' ? "bg-blue-50 text-blue-700" : "text-slate-500 hover:text-blue-700")}
            >
              Provisioning
            </button>
          </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider font-semibold">
              <th className="px-6 py-4 w-10">
                <input 
                  type="checkbox" 
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  checked={selectedIds.size === filteredShops.length && filteredShops.length > 0}
                  onChange={toggleSelectAll}
                />
              </th>
              <th 
                className="px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center gap-1">
                  {t('dashboard.shop_name')}
                  {sortField === 'name' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </div>
              </th>
              <th 
                className="px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center gap-1">
                  {t('common.status')}
                  {sortField === 'status' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </div>
              </th>
              <th className="px-6 py-4">{t('shops.sendpulse_id')}</th>
              <th 
                className="px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => handleSort('createdAt')}
              >
                <div className="flex items-center gap-1">
                  {t('dashboard.created_at')}
                  {sortField === 'createdAt' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                </div>
              </th>
              <th className="px-6 py-4 text-right">{t('common.actions')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <Loader2 className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-2" />
                  <span className="text-slate-500 text-sm">{t('shops.loading')}</span>
                </td>
              </tr>
            ) : paginatedShops.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center">
                  <div className="text-slate-400 mb-2">{t('shops.no_shops')}</div>
                  <button onClick={() => {
                    setModalMode('create');
                    setIsModalOpen(true);
                  }} className="text-indigo-600 text-sm font-medium hover:underline">{t('shops.provision_first')}</button>
                </td>
              </tr>
            ) : (
              paginatedShops.map((shop) => (
                <tr 
                  key={shop.id} 
                  onClick={() => {
                    setSelectedShop(shop);
                    setIsDrawerOpen(true);
                  }}
                  className={cn(
                    "hover:bg-slate-50/80 transition-colors group cursor-pointer",
                    selectedIds.has(shop.id) && "bg-indigo-50/30 hover:bg-indigo-50/50"
                  )}
                >
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <input 
                      type="checkbox" 
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedIds.has(shop.id)}
                      onChange={(e) => toggleSelect(shop.id, e as any)}
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center overflow-hidden border border-indigo-100 flex-shrink-0">
                        {shop.logoUrl ? (
                          <img src={shop.logoUrl} alt={shop.name} className="w-full h-full object-cover" />
                        ) : (
                          <Store className="w-4 h-4 text-indigo-400" />
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">{shop.name}</span>
                        <span className="text-xs text-slate-500">/{shop.slug}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium",
                      shop.status === 'active' ? "bg-emerald-50 text-emerald-700" : 
                      shop.status === 'provisioning' ? "bg-blue-50 text-blue-700" : "bg-red-50 text-red-700"
                    )}>
                      {shop.status === 'active' && <CheckCircle2 className="w-3 h-3" />}
                      {shop.status === 'provisioning' && <Loader2 className="w-3 h-3 animate-spin" />}
                      {shop.status === 'suspended' && <AlertCircle className="w-3 h-3" />}
                      {t(`common.${shop.status}`)}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    {shop.sendpulseBotIds && shop.sendpulseBotIds.length > 0 ? (
                      <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{(shop.sendpulseBotIds || []).join(', ')}</code>
                    ) : (
                      <span className="text-slate-400 text-xs italic">Not linked</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-500">
                    {shop.createdAt ? format(new Date(shop.createdAt), 'MMM d, yyyy') : 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/support?shopId=${shop.id}`);
                        }}
                        title="Chat with Shop"
                        className="p-1.5 hover:bg-indigo-50 border border-transparent hover:border-indigo-200 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      <Link 
                        to={`/vendor/${shop.id}`}
                        title="Vendor Dashboard"
                        className="p-1.5 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
                      >
                        <LayoutDashboard className="w-4 h-4" />
                      </Link>
                      <button 
                        onClick={(e) => handleOpenEdit(shop, e)}
                        title="Edit Shop"
                        className="p-1.5 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
                      >
                        <Settings className="w-4 h-4" />
                      </button>
                      {shop.status === 'active' ? (
                        <button 
                          onClick={(e) => handleUpdateStatus(shop.id, 'suspended', e)}
                          title="Suspend Shop"
                          className="p-1.5 hover:bg-amber-50 border border-transparent hover:border-amber-200 rounded-lg text-slate-400 hover:text-amber-600 transition-all"
                        >
                          <AlertCircle className="w-4 h-4" />
                        </button>
                      ) : (
                        <button 
                          onClick={(e) => handleUpdateStatus(shop.id, 'active', e)}
                          title="Activate Shop"
                          className="p-1.5 hover:bg-emerald-50 border border-transparent hover:border-emerald-200 rounded-lg text-slate-400 hover:text-emerald-600 transition-all"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={(e) => handlePing(shop.id, e)}
                        disabled={pingingId === shop.id}
                        title="Check DB Health"
                        className="p-1.5 hover:bg-blue-50 border border-transparent hover:border-blue-200 rounded-lg text-slate-400 hover:text-blue-600 transition-all disabled:opacity-50"
                      >
                        {pingingId === shop.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                      </button>
                      <button 
                        onClick={(e) => handleDeleteShop(shop, e)}
                        title="Delete Shop"
                        className="p-1.5 hover:bg-red-50 border border-transparent hover:border-red-200 rounded-lg text-slate-400 hover:text-red-600 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing <span className="font-bold text-slate-700">{Math.min(filteredShops.length, (currentPage - 1) * itemsPerPage + 1)}-{Math.min(filteredShops.length, currentPage * itemsPerPage)}</span> of <span className="font-bold text-slate-700">{filteredShops.length}</span> shops
          </p>
          <div className="flex items-center gap-1">
            <button 
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(prev => prev - 1)}
              className="p-2 hover:bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-50 transition-all"
            >
              <ChevronUp className="w-4 h-4 -rotate-90" />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button 
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={cn(
                  "w-8 h-8 text-xs font-bold rounded-lg transition-all",
                  currentPage === i + 1 ? "bg-indigo-600 text-white shadow-sm" : "text-slate-500 hover:bg-white border border-transparent hover:border-slate-200"
                )}
              >
                {i + 1}
              </button>
            ))}
            <button 
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(prev => prev + 1)}
              className="p-2 hover:bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 disabled:opacity-50 transition-all"
            >
              <ChevronDown className="w-4 h-4 -rotate-90" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
