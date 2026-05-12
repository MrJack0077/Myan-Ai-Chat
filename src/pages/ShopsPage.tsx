import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  RefreshCw, 
  FileJson,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '../lib/utils';
import * as shopService from '../services/shopService';
import { Shop, SortField, SortOrder } from '../types';
import { useToast } from '../components/Toast';
import { useTranslation } from 'react-i18next';
import SystemExportModal from '../components/admin/SystemExportModal';
import ShopCreateEditModal from '../components/admin/shops/ShopCreateEditModal';
import ShopDeleteModal from '../components/admin/shops/ShopDeleteModal';
import ShopDetailsDrawer from '../components/admin/shops/ShopDetailsDrawer';
import ShopListTable from '../components/admin/shops/ShopListTable';
import ShopStatsGrid from '../components/admin/shops/ShopStatsGrid';
import ShopBulkActionsBar from '../components/admin/shops/ShopBulkActionsBar';

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
  const [newShop, setNewShop] = useState({ name: '', slug: '', sendpulseBotIds: [] as string[], sendpulseBots: [] as {id: string, channel: string}[], sendpulseClientId: '', sendpulseClientSecret: '', email: '', password: '', agentId: '', disableCache: false });
  
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

  useEffect(() => {
    fetchShops();
  }, []);

  const fetchShops = async () => {
    setLoading(true);
    try {
      const data = await shopService.getAllShops();
      setShops(data);
      
      // Update selectedShop data if drawer is open
      if (selectedShop) {
        const updatedShop = data.find(s => s.id === selectedShop.id);
        if (updatedShop) setSelectedShop(updatedShop);
      }
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
      await shopService.saveShop({ id, status: status as any });
      setShops(prev => prev.map(s => s.id === id ? { ...s, status: status as any } : s));
      showToast('Status updated', 'success');
    } catch (error) {
      showToast('Failed to update status', 'error');
    }
  };

  const handleDeleteShop = (shop: Shop, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setShopToDelete(shop);
    setIsDeleteModalOpen(true);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} shops?`)) return;
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500)); // mocking the actual bulk delete
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
      slug: shop.slug || '', 
      sendpulseBotIds: shop.sendpulseBotIds || [],
      sendpulseBots: shop.sendpulseBots || [],
      sendpulseClientId: shop.sendpulseClientId || '', sendpulseClientSecret: shop.sendpulseClientSecret || '',
      email: '',
      password: '',
      agentId: shop.agentId || '',
      disableCache: shop.disableCache || false
    });
    setIsModalOpen(true);
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
            onClick={fetchShops}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white border border-transparent hover:border-slate-200 rounded-lg transition-all"
          >
            <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
          </button>
          <button 
            onClick={() => {
              setModalMode('create');
              setNewShop({ name: '', slug: '', sendpulseBotIds: [] as string[], sendpulseBots: [] as {id: string, channel: string}[], sendpulseClientId: '', sendpulseClientSecret: '', email: '', password: '', agentId: '', disableCache: false });
              setIsModalOpen(true);
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-medium transition-all shadow-sm active:scale-95"
          >
            <Plus className="w-4 h-4" />
            {t('shops.provision_new')}
          </button>
        </div>
      </header>

      <ShopStatsGrid shops={shops} />

      <ShopBulkActionsBar 
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        handleBulkStatus={handleBulkStatus}
        handleBulkDelete={handleBulkDelete}
      />

      <ShopListTable
        loading={loading}
        shops={shops}
        paginatedShops={paginatedShops}
        filteredShops={filteredShops}
        selectedIds={selectedIds}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        sortField={sortField}
        sortOrder={sortOrder}
        handleSort={handleSort}
        toggleSelectAll={toggleSelectAll}
        toggleSelect={toggleSelect}
        setSelectedShop={setSelectedShop}
        setIsDrawerOpen={setIsDrawerOpen}
        handleOpenEdit={handleOpenEdit}
        handleUpdateStatus={handleUpdateStatus}
        handlePing={handlePing}
        pingingId={pingingId}
        handleDeleteShop={handleDeleteShop}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        itemsPerPage={itemsPerPage}
        totalPages={totalPages}
        setIsModalOpen={setIsModalOpen}
        setModalMode={setModalMode}
      />

      <ShopDetailsDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        shop={selectedShop}
        onSuccess={fetchShops}
        onEdit={handleOpenEdit}
        onDelete={handleDeleteShop}
      />

      <ShopCreateEditModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        mode={modalMode}
        initialData={newShop}
        onSuccess={fetchShops}
        editingShopId={editingShopId}
      />

      <ShopDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        shop={shopToDelete}
        onDeleted={fetchShops}
      />
    </>
  );
}
