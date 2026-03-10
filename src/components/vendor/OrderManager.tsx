import React, { useState, useEffect } from 'react';
import { 
  ShoppingBag, 
  Search, 
  ChevronDown, 
  Eye, 
  Truck, 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar,
  ExternalLink,
  Filter,
  Package
} from 'lucide-react';
import { Order, OrderStatus } from '../../types';
import { getOrders, updateOrderStatus } from '../../services/firebaseService';
import { useTranslation } from 'react-i18next';
import { useToast } from '../Toast';
import { cn } from '../../lib/utils';

export default function OrderManager({ shopId }: { shopId: string }) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    if (shopId) {
      fetchOrders();
    }
  }, [shopId]);

  const fetchOrders = async () => {
    setIsLoading(true);
    try {
      const data = await getOrders(shopId);
      setOrders(data.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      showToast('Failed to load orders', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setIsUpdating(true);
    try {
      await updateOrderStatus(shopId, orderId, newStatus);
      showToast(`Order status updated to ${newStatus}`, 'success');
      fetchOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => prev ? { ...prev, status: newStatus } : null);
      }
    } catch (error) {
      console.error('Failed to update status:', error);
      showToast('Failed to update status', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'processing': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'shipped': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'delivered': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'cancelled': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-zinc-100 text-zinc-700 border-zinc-200';
    }
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'pending': return <Clock className="w-3 h-3" />;
      case 'processing': return <ShoppingBag className="w-3 h-3" />;
      case 'shipped': return <Truck className="w-3 h-3" />;
      case 'delivered': return <CheckCircle className="w-3 h-3" />;
      case 'cancelled': return <XCircle className="w-3 h-3" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">{t('orders.summary.new_orders')}</p>
          <p className="text-3xl font-bold text-zinc-900">{orders.filter(o => o.status === 'pending').length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">{t('orders.summary.pending_delivery')}</p>
          <p className="text-3xl font-bold text-zinc-900">{orders.filter(o => ['processing', 'shipped'].includes(o.status)).length}</p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">{t('orders.summary.completed_today')}</p>
          <p className="text-3xl font-bold text-zinc-900">
            {orders.filter(o => o.status === 'delivered' && new Date(o.updatedAt).toDateString() === new Date().toDateString()).length}
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm">
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-1">{t('orders.summary.revenue_today')}</p>
          <p className="text-3xl font-bold text-emerald-600">
            ${orders
              .filter(o => o.status === 'delivered' && new Date(o.updatedAt).toDateString() === new Date().toDateString())
              .reduce((sum, o) => sum + o.totalAmount, 0)
              .toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="w-5 h-5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input 
            type="text" 
            placeholder={t('orders.search_placeholder')} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Filter className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <select 
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="appearance-none pl-10 pr-10 py-2.5 bg-white border border-zinc-200 rounded-2xl text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-all outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">{t('orders.all_status')}</option>
              <option value="pending">{t('orders.pending')}</option>
              <option value="processing">{t('orders.processing')}</option>
              <option value="shipped">{t('orders.shipped')}</option>
              <option value="delivered">{t('orders.delivered')}</option>
              <option value="cancelled">{t('orders.cancelled')}</option>
            </select>
            <ChevronDown className="w-4 h-4 text-zinc-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Order List */}
      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-100">
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('orders.order_id')}</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('orders.customer')}</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('orders.date')}</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('orders.total')}</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('orders.status')}</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">{t('common.loading')}</td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">{t('orders.no_orders')}</td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="hover:bg-zinc-50 transition-all group">
                    <td className="px-6 py-4">
                      <span className="text-sm font-mono font-bold text-zinc-900">#{order.id.slice(-6).toUpperCase()}</span>
                    </td>
                    <td className="px-6 py-4">
                      <div>
                        <p className="text-sm font-bold text-zinc-900">{order.customerName}</p>
                        <p className="text-xs text-zinc-500">{order.customerPhone}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm text-zinc-600">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-zinc-900">${order.totalAmount.toFixed(2)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                        getStatusColor(order.status)
                      )}>
                        {getStatusIcon(order.status)}
                        {t(`orders.${order.status}`)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button 
                        onClick={() => setSelectedOrder(order)}
                        className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div>
                <h3 className="text-xl font-bold text-zinc-900">{t('orders.order_details')}</h3>
                <p className="text-sm text-zinc-500">#{selectedOrder.id.toUpperCase()}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 hover:bg-zinc-200 rounded-xl transition-all">
                <XCircle className="w-6 h-6 text-zinc-400" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Items & Summary */}
                <div className="lg:col-span-2 space-y-8">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                      <ShoppingBag className="w-4 h-4 text-indigo-600" />
                      {t('orders.items')}
                    </h4>
                    <div className="space-y-3">
                      {selectedOrder.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                          <div className="w-16 h-16 bg-white rounded-xl border border-zinc-100 flex items-center justify-center overflow-hidden shrink-0">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-6 h-6 text-zinc-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-zinc-900 truncate">{item.name}</p>
                            {item.subItemName && <p className="text-xs text-zinc-500">{item.subItemName}</p>}
                            <p className="text-xs text-zinc-400 mt-1">{item.quantity} x ${item.price.toFixed(2)}</p>
                          </div>
                          <p className="text-sm font-bold text-zinc-900">${(item.quantity * item.price).toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-100">
                    <div className="flex justify-between items-center text-lg font-bold text-zinc-900">
                      <span>{t('orders.total')}</span>
                      <span>${selectedOrder.totalAmount.toFixed(2)}</span>
                    </div>
                  </div>

                  {selectedOrder.notes && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                      <p className="text-xs font-bold text-amber-800 mb-1 uppercase tracking-wider">{t('orders.notes')}</p>
                      <p className="text-sm text-amber-900">{selectedOrder.notes}</p>
                    </div>
                  )}
                </div>

                {/* Right Column: Customer & Status */}
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                      <User className="w-4 h-4 text-indigo-600" />
                      {t('orders.customer')}
                    </h4>
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <User className="w-4 h-4 text-zinc-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{selectedOrder.customerName}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-3">
                        <Phone className="w-4 h-4 text-zinc-400 mt-0.5" />
                        <p className="text-sm text-zinc-600">{selectedOrder.customerPhone}</p>
                      </div>
                      {selectedOrder.customerEmail && (
                        <div className="flex items-start gap-3">
                          <Mail className="w-4 h-4 text-zinc-400 mt-0.5" />
                          <p className="text-sm text-zinc-600">{selectedOrder.customerEmail}</p>
                        </div>
                      )}
                      <div className="flex items-start gap-3">
                        <MapPin className="w-4 h-4 text-zinc-400 mt-0.5" />
                        <p className="text-sm text-zinc-600 leading-relaxed">{selectedOrder.shippingAddress}</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-100 space-y-4">
                    <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                      <Truck className="w-4 h-4 text-indigo-600" />
                      {t('orders.update_status')}
                    </h4>
                    <div className="grid grid-cols-1 gap-2">
                      {(['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as OrderStatus[]).map((status) => (
                        <button
                          key={status}
                          onClick={() => handleUpdateStatus(selectedOrder.id, status)}
                          disabled={isUpdating || selectedOrder.status === status}
                          className={cn(
                            "flex items-center justify-between px-4 py-3 rounded-2xl text-xs font-bold transition-all border",
                            selectedOrder.status === status 
                              ? getStatusColor(status)
                              : "bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50"
                          )}
                        >
                          <span className="flex items-center gap-2">
                            {getStatusIcon(status)}
                            {t(`orders.${status}`)}
                          </span>
                          {selectedOrder.status === status && <CheckCircle className="w-4 h-4" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 bg-zinc-50 border-t border-zinc-100 flex justify-end">
              <button 
                onClick={() => setSelectedOrder(null)}
                className="px-6 py-2 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
