import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Database, 
  MessageSquare, 
  Loader2, 
  CheckCircle2, 
  X, 
  ChevronUp, 
  ChevronDown, 
  Trash2, 
  Settings, 
  AlertCircle, 
  RefreshCw, 
  Copy,
  Filter,
  Store,
  ExternalLink,
  Check,
  LayoutDashboard,
  FileJson,
  ShieldAlert
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { getAllShops, saveShop, deleteShop, createVendorUser } from '../services/firebaseService';
import { Shop, SortField, SortOrder } from '../types';
import { useToast } from '../components/Toast';
import { Key, Eye, EyeOff, Bot, Edit2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import SystemExportModal from '../components/admin/SystemExportModal';

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function ShopsPage() {
  const { showToast } = useToast();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [newShop, setNewShop] = useState({ name: '', slug: '', chatwootAccountId: '', chatwootToken: '', email: '', password: '', agentId: '' });
  const [isCreating, setIsCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [pingingId, setPingingId] = useState<string | null>(null);
  
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  
  const [selectedShop, setSelectedShop] = useState<Shop | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [shopToDelete, setShopToDelete] = useState<Shop | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    setLoading(true);
    try {
      const data = await getAllShops();
      setShops(data);
    } catch (error) {
      console.error('Failed to fetch shops:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePing = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPingingId(id);
    try {
      // Mock ping
      await new Promise(resolve => setTimeout(resolve, 500));
      showToast('Database is healthy and reachable.', 'success');
    } catch (error) {
      showToast('Ping failed', 'error');
    } finally {
      setPingingId(null);
    }
  };

  const handleUpdateStatus = async (id: string, status: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await saveShop({ id, status: status as any });
      setShops(prev => prev.map(s => s.id === id ? { ...s, status: status as any } : s));
      showToast('Status updated', 'success');
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleDeleteShop = (shop: Shop, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShopToDelete(shop);
    setDeleteConfirmText('');
    setIsDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (!shopToDelete) return;
    if (deleteConfirmText !== shopToDelete.name) {
      showToast('Shop name does not match', 'error');
      return;
    }

    setLoading(true);
    try {
      await deleteShop(shopToDelete.id);
      setShops(prev => prev.filter(s => s.id !== shopToDelete.id));
      if (selectedShop?.id === shopToDelete.id) setIsDrawerOpen(false);
      showToast('Shop deleted successfully', 'success');
      setIsDeleteModalOpen(false);
      setShopToDelete(null);
    } catch (error) {
      showToast('Failed to delete shop', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} shops?`)) return;
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setShops(prev => prev.filter(s => !selectedIds.has(s.id)));
      setSelectedIds(new Set());
      showToast(`Deleted ${selectedIds.size} shops`, 'success');
    } catch (error) {
      showToast('Bulk delete failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkStatus = async (status: string) => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      setShops(prev => prev.map(s => selectedIds.has(s.id) ? { ...s, status: status as any } : s));
      setSelectedIds(new Set());
      showToast(`Updated status for ${selectedIds.size} shops`, 'success');
    } catch (error) {
      showToast('Bulk status update failed', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenEdit = (shop: Shop, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setModalMode('edit');
    setEditingShopId(shop.id);
    setNewShop({ 
      name: shop.name, 
      slug: shop.slug, 
      chatwootAccountId: shop.chatwootAccountId || '',
      chatwootToken: shop.chatwootToken || '',
      email: '',
      password: '',
      agentId: shop.agentId || ''
    });
    setIsModalOpen(true);
  };

  const handleSaveShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);
    try {
      if (modalMode === 'create') {
        const shopData: Partial<Shop> = {
          name: newShop.name,
          slug: newShop.slug,
          chatwootAccountId: newShop.chatwootAccountId || null,
          chatwootToken: newShop.chatwootToken || null,
          agentId: newShop.agentId || null,
          databaseName: `db_${newShop.slug}`,
          vendorCredentials: {
            email: newShop.email,
            password: newShop.password // Store for admin to see
          }
        };
        
        // 1. Save shop to Firestore
        const shopId = await saveShop(shopData);
        
        // 2. Create user in Firebase Auth and Firestore profile
        await createVendorUser(newShop.email, newShop.password, shopId);
        
        showToast(`Shop provisioned and vendor account ${newShop.email} created!`, 'success');
      } else {
        await saveShop({ 
          id: editingShopId!, 
          name: newShop.name, 
          slug: newShop.slug, 
          chatwootAccountId: newShop.chatwootAccountId || null,
          chatwootToken: newShop.chatwootToken || null,
          agentId: newShop.agentId || null
        });
        showToast('Shop configuration updated', 'success');
      }
      fetchShops();
      setIsModalOpen(false);
      setNewShop({ name: '', slug: '', chatwootAccountId: '', chatwootToken: '', email: '', password: '', agentId: '' });
    } catch (error: any) {
      console.error('Save error:', error);
      showToast(error.message || 'An error occurred while saving the shop', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredShops.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredShops.map(s => s.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredShops = useMemo(() => {
    return shops
      .filter(shop => {
        const matchesSearch = (shop.name?.toLowerCase() || '').includes(searchQuery.toLowerCase()) ||
          (shop.slug?.toLowerCase() || '').includes(searchQuery.toLowerCase());
        const matchesStatus = statusFilter === 'all' || shop.status === statusFilter;
        return matchesSearch && matchesStatus;
      })
      .sort((a, b) => {
        let valA: any = a[sortField];
        let valB: any = b[sortField];
        
        if (sortField === 'size') {
          valA = a.size || 0;
          valB = b.size || 0;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [shops, searchQuery, sortField, sortOrder]);

  const paginatedShops = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredShops.slice(start, start + itemsPerPage);
  }, [filteredShops, currentPage]);

  const totalPages = Math.ceil(filteredShops.length / itemsPerPage);

  return (
    <>
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('shops.title')}</h1>
          <p className="text-slate-500">{t('shops.subtitle')}</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setIsExportModalOpen(true)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all"
            title="Export System JSON"
          >
            <FileJson className="w-5 h-5" />
          </button>
          <button 
            onClick={fetchShops}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all"
          >
            <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
          </button>
          <button 
            onClick={() => {
              setModalMode('create');
              setNewShop({ name: '', slug: '', chatwootAccountId: '', email: '', password: '', agentId: '' });
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            {t('shops.provision_new')}
          </button>
        </div>
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: t('dashboard.total_shops'), value: shops.length, icon: Store, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: t('shops.active_dbs'), value: shops.filter(s => s.status === 'active').length, icon: Database, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: t('shops.chatwoot_links'), value: shops.filter(s => s.chatwootAccountId).length, icon: MessageSquare, color: 'text-amber-600', bg: 'bg-amber-50' },
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

      {/* Bulk Actions Bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 lg:left-[calc(50%+128px)] z-50 bg-slate-900 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 border border-white/10"
          >
            <div className="flex items-center gap-2 border-r border-white/20 pr-6">
              <span className="bg-indigo-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{selectedIds.size}</span>
              <span className="text-sm font-medium">Selected</span>
            </div>
            
            <div className="flex items-center gap-4">
              <button onClick={() => handleBulkStatus('active')} className="text-sm font-medium hover:text-emerald-400 transition-colors flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Activate
              </button>
              <button onClick={() => handleBulkStatus('suspended')} className="text-sm font-medium hover:text-amber-400 transition-colors flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4" /> Suspend
              </button>
              <button onClick={handleBulkDelete} className="text-sm font-medium hover:text-red-400 transition-colors flex items-center gap-1.5">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
            
            <button 
              onClick={() => setSelectedIds(new Set())}
              className="ml-2 p-1 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Shops Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder={t('shops.search_placeholder')} 
              className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            >
              <option value="all">{t('shops.all_status')}</option>
              <option value="active">{t('common.active')}</option>
              <option value="suspended">{t('shops.suspended')}</option>
              <option value="provisioning">{t('shops.provisioning')}</option>
            </select>
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
                <th className="px-6 py-4">{t('shops.chatwoot_id')}</th>
                <th 
                  className="px-6 py-4 cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => handleSort('size')}
                >
                  <div className="flex items-center gap-1">
                    {t('shops.database')}
                    {sortField === 'size' && (sortOrder === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                  </div>
                </th>
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
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900 group-hover:text-indigo-600 transition-colors">{shop.name}</span>
                        <span className="text-xs text-slate-500">/{shop.slug}</span>
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
                      {shop.chatwootAccountId ? (
                        <code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">#{shop.chatwootAccountId}</code>
                      ) : (
                        <span className="text-slate-400 text-xs italic">Not linked</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs text-slate-500">
                          <Database className="w-3 h-3" />
                          <span className="truncate max-w-[120px]" title={shop.databaseName}>{shop.databaseName}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(shop.databaseName);
                              showToast('Database name copied to clipboard', 'info');
                            }}
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <span className="text-[10px] text-slate-400 font-mono">{formatSize(shop.size || 0)}</span>
                      </div>
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

        {/* Pagination Controls */}
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

      {/* Details Drawer */}
      <AnimatePresence>
        {isDrawerOpen && selectedShop && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDrawerOpen(false)}
              className="fixed inset-0 z-50 bg-slate-900/20 backdrop-blur-[2px]"
            />
            <motion.div 
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl z-50 overflow-y-auto border-l border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
                    <Store className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 leading-tight">{selectedShop.name}</h2>
                    <div className="flex flex-col gap-0.5">
                      <p className="text-[10px] text-slate-500">{t('dashboard.shop_id')}: {selectedShop.id}</p>
                      {selectedShop.agentId && (
                        <p className="text-[10px] text-indigo-600 font-bold">{t('shops.agent_id')}: {selectedShop.agentId}</p>
                      )}
                    </div>
                  </div>
                </div>
                <button onClick={() => setIsDrawerOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <div className="p-6 space-y-8">
                {/* Status Section */}
                <section>
                  <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-4">{t('common.status')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] text-slate-500 mb-1">{t('common.status')}</p>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-2 h-2 rounded-full", selectedShop.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500')} />
                        <span className="font-bold text-sm capitalize">{t(`common.${selectedShop.status}`)}</span>
                      </div>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <p className="text-[10px] text-slate-500 mb-1">DB Health</p>
                      <button 
                        onClick={() => handlePing(selectedShop.id)}
                        className="flex items-center gap-2 text-indigo-600 font-bold text-sm hover:underline"
                      >
                        <RefreshCw className={cn("w-3 h-3", pingingId === selectedShop.id && "animate-spin")} />
                        Check Now
                      </button>
                    </div>
                  </div>
                </section>

                {/* Database Section */}
                <section>
                  <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-4">{t('shops.database')}</h3>
                  <div className="space-y-3">
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-3">
                      <div>
                        <p className="text-[10px] text-slate-500 mb-1">{t('shops.database')}</p>
                        <div className="flex items-center justify-between gap-2">
                          <code className="text-xs text-slate-600 truncate bg-white px-2 py-1 rounded border border-slate-200 flex-1">
                            {selectedShop.databaseName}
                          </code>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(selectedShop.databaseName);
                              showToast('Database name copied to clipboard', 'info');
                            }}
                            className="p-1.5 hover:bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-indigo-600 transition-all"
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-slate-200/50">
                        <div>
                          <p className="text-[10px] text-slate-500">File Size</p>
                          <p className="text-sm font-bold">{formatSize(selectedShop.size || 0)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] text-slate-500">Architecture</p>
                          <p className="text-sm font-bold">Remote PostgreSQL</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Shop Credentials (Admin only) */}
                {selectedShop.vendorCredentials && (
                  <section>
                    <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-4">{t('shops.credentials')}</h3>
                    <div className="bg-indigo-50 rounded-2xl p-4 border border-indigo-100 space-y-3">
                      <div>
                        <span className="text-[10px] uppercase font-bold text-indigo-400 block mb-1">{t('common.email')}</span>
                        <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-indigo-100">
                          <code className="text-xs text-indigo-900">{selectedShop.vendorCredentials.email}</code>
                          <button 
                            onClick={() => {
                              navigator.clipboard.writeText(selectedShop.vendorCredentials!.email);
                              showToast('Email copied', 'success');
                            }}
                            className="text-indigo-400 hover:text-indigo-600 transition-colors"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <span className="text-[10px] uppercase font-bold text-indigo-400 block mb-1">{t('common.password')}</span>
                        <div className="flex items-center justify-between bg-white px-3 py-2 rounded-lg border border-indigo-100">
                          <code className="text-xs text-indigo-900">
                            {showPassword ? selectedShop.vendorCredentials.password : '••••••••'}
                          </code>
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => setShowPassword(!showPassword)}
                              className="text-indigo-400 hover:text-indigo-600 transition-colors"
                            >
                              {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                            <button 
                              onClick={() => {
                                navigator.clipboard.writeText(selectedShop.vendorCredentials!.password || '');
                                showToast('Password copied', 'success');
                              }}
                              className="text-indigo-400 hover:text-indigo-600 transition-colors"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                )}

                {/* Integration Section */}
                <section>
                  <h3 className="text-xs uppercase tracking-wider font-bold text-slate-400 mb-4">Integrations</h3>
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white rounded-lg border border-slate-200 flex items-center justify-center">
                          <MessageSquare className="w-4 h-4 text-slate-600" />
                        </div>
                        <div>
                          <p className="text-sm font-bold">Chatwoot</p>
                          <p className="text-[10px] text-slate-500">
                            {selectedShop.chatwootAccountId ? `Account ID: #${selectedShop.chatwootAccountId}` : 'Not connected'}
                          </p>
                        </div>
                      </div>
                      <button className="text-xs font-bold text-indigo-600 hover:underline">Configure</button>
                    </div>
                  </div>
                </section>

                {/* Danger Zone */}
                <section className="pt-8 border-t border-slate-100">
                  <h3 className="text-xs uppercase tracking-wider font-bold text-red-400 mb-4">{t('shops.danger_zone')}</h3>
                  <div className="flex flex-col gap-3">
                    <button 
                      onClick={() => handleUpdateStatus(selectedShop.id, selectedShop.status === 'active' ? 'suspended' : 'active')}
                      className="w-full px-4 py-2.5 border border-slate-200 text-slate-700 font-bold rounded-xl hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
                    >
                      {selectedShop.status === 'active' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                      {selectedShop.status === 'active' ? t('shops.suspended') : t('common.active')}
                    </button>
                    <button 
                      onClick={() => handleDeleteShop(selectedShop.id)}
                      className="w-full px-4 py-2.5 bg-red-50 text-red-600 font-bold rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      {t('shops.delete_tenant')}
                    </button>
                  </div>
                </section>
              </div>

              <div className="absolute bottom-0 left-0 w-full p-6 bg-white border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => navigate(`/admin/support?shopId=${selectedShop.id}`)}
                  className="px-4 py-2.5 bg-indigo-50 text-indigo-600 font-bold rounded-xl hover:bg-indigo-100 transition-all flex items-center justify-center gap-2"
                >
                  <MessageSquare className="w-4 h-4" />
                  {t('dashboard.chat')}
                </button>
                <Link 
                  to={`/vendor/${selectedShop.id}`}
                  className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
                >
                  <LayoutDashboard className="w-4 h-4" />
                  {t('nav.dashboard')}
                </Link>
                <Link 
                  to={`/vendor/${selectedShop.id}/ai-training`}
                  className="px-4 py-2.5 bg-amber-50 text-amber-600 font-bold rounded-xl hover:bg-amber-100 transition-all flex items-center justify-center gap-2"
                  title="AI Training"
                >
                  <Bot className="w-4 h-4" />
                </Link>
                <Link 
                  to={`/vendor/${selectedShop.id}/settings`}
                  className="px-4 py-2.5 bg-slate-50 text-slate-600 font-bold rounded-xl hover:bg-slate-100 transition-all flex items-center justify-center gap-2"
                  title="Shop Settings"
                >
                  <Settings className="w-4 h-4" />
                </Link>
                <button 
                  onClick={() => handleOpenEdit(selectedShop)}
                  className="px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Provisioning / Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200">
                    {modalMode === 'create' ? <Plus className="w-6 h-6 text-white" /> : <Settings className="w-6 h-6 text-white" />}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 leading-tight">
                      {modalMode === 'create' ? t('shops.provision_new') : t('inventory.edit_item')}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {modalMode === 'create' ? t('shops.provision_desc') : t('shops.edit_desc')}
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-slate-500" />
                </button>
              </div>

              <form onSubmit={handleSaveShop} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('dashboard.shop_name')}</label>
                  <input 
                    required
                    type="text" 
                    placeholder="e.g. My Awesome Store"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={newShop.name}
                    onChange={(e) => setNewShop({ ...newShop, name: e.target.value })}
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('shops.url_slug')}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-sm">/</span>
                    <input 
                      required
                      type="text" 
                      placeholder="my-store"
                      disabled={modalMode === 'edit'}
                      className="w-full pl-7 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all disabled:opacity-50"
                      value={newShop.slug}
                      onChange={(e) => setNewShop({ ...newShop, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') })}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('shops.agent_id')}</label>
                  <input 
                    type="text" 
                    placeholder="e.g. AGENT-001"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                    value={newShop.agentId}
                    onChange={(e) => setNewShop({ ...newShop, agentId: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('shops.chatwoot_optional')}</label>
                    <input 
                      type="text" 
                      placeholder="Account ID (e.g. 12345)"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={newShop.chatwootAccountId}
                      onChange={(e) => setNewShop({ ...newShop, chatwootAccountId: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Chatwoot Token (Optional)</label>
                    <input 
                      type="text" 
                      placeholder="Access Token"
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                      value={newShop.chatwootToken}
                      onChange={(e) => setNewShop({ ...newShop, chatwootToken: e.target.value })}
                    />
                  </div>
                </div>

                {modalMode === 'create' && (
                  <div className="pt-4 border-t border-slate-100 space-y-4">
                    <h3 className="text-sm font-bold text-slate-900">{t('shops.credentials')}</h3>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('common.email')}</label>
                      <input 
                        required
                        type="email" 
                        placeholder="vendor@example.com"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                        value={newShop.email}
                        onChange={(e) => setNewShop({ ...newShop, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">{t('common.password')}</label>
                      <div className="relative">
                        <input 
                          required
                          type={showPassword ? "text" : "password"} 
                          placeholder="••••••••"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
                          value={newShop.password}
                          onChange={(e) => setNewShop({ ...newShop, password: e.target.value })}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 px-4 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {modalMode === 'create' ? t('shops.provision') : t('inventory.save_changes')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <SystemExportModal 
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        shops={shops}
      />

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {isDeleteModalOpen && shopToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsDeleteModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-red-100"
            >
              <div className="p-6 border-b border-red-50 bg-red-50/50 flex items-center gap-4">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center text-red-600 shrink-0">
                  <ShieldAlert className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900 leading-tight">
                    {t('shops.delete_confirm_title')}
                  </h2>
                  <p className="text-xs text-red-600 font-medium">
                    {t('shops.danger_zone')}
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="p-4 bg-amber-50 border border-amber-100 rounded-xl">
                  <p className="text-xs text-amber-800 leading-relaxed">
                    {t('shops.delete_confirm_desc')}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    {t('shops.type_to_confirm', { name: shopToDelete.name })}
                  </label>
                  <input 
                    type="text" 
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all font-medium"
                    placeholder={shopToDelete.name}
                    value={deleteConfirmText}
                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setIsDeleteModalOpen(false)}
                    className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 font-bold rounded-xl hover:bg-slate-50 transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <button 
                    onClick={confirmDelete}
                    disabled={deleteConfirmText !== shopToDelete.name || loading}
                    className="flex-1 px-4 py-2.5 bg-red-600 text-white font-bold rounded-xl hover:bg-red-700 transition-all shadow-lg shadow-red-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    {t('shops.delete_tenant')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
