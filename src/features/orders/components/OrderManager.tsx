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
  Package,
  Plus,
  Trash2,
  History,
  FileText,
  ShieldCheck,
  ShieldAlert
} from 'lucide-react';
import { Order, OrderStatus, VendorItem, PaymentStatus } from '../../../types';
import * as orderService from '../../../services/orderService';
import * as customerService from '../../../services/customerService';
import * as inventoryService from '../../../services/inventoryService';
import { BotUser } from '../../../services/customerService';
import { useOrders } from '../hooks/useOrders';
import { useTranslation } from 'react-i18next';
import { useToast } from '../../../components/Toast';
import { cn, getCurrencySymbol } from '../../../lib/utils';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function OrderManager({ shopId, currency = 'MMK' }: { shopId: string, currency?: string }) {
  const { t } = useTranslation();
  const { showToast } = useToast();

  const symbol = getCurrencySymbol(currency);
  const { orders, loading: isLoading, refresh: refreshOrders, updateStatus, updatePaymentStatus } = useOrders(shopId, true);
  
  const [botUsers, setBotUsers] = useState<BotUser[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<'real' | 'bot'>('real');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [customerHistory, setCustomerHistory] = useState<Order[]>([]);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [availableItems, setAvailableItems] = useState<VendorItem[]>([]);
  const [newOrder, setNewOrder] = useState<Omit<Order, 'id' | 'createdAt' | 'updatedAt'>>({
    shopId,
    customerName: '',
    customerPhone: '',
    customerEmail: '',
    shippingAddress: '',
    items: [],
    totalAmount: 0,
    status: 'pending',
    notes: ''
  });

  useEffect(() => {
    if (shopId) {
      fetchBotUsers();
      fetchAvailableItems();
    }
  }, [shopId]);

  const fetchBotUsers = async () => {
    try {
      const data = await customerService.getBotUsers(shopId);
      setBotUsers(data);
    } catch (error) {
      console.error('Failed to fetch bot users:', error);
    }
  };

  const fetchAvailableItems = async () => {
    try {
      const data = await inventoryService.getItems(shopId);
      setAvailableItems(data.filter(i => i.status === 'active'));
    } catch (error) {
      console.error('Failed to fetch items:', error);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: OrderStatus) => {
    setIsUpdating(true);
    try {
      await updateStatus(orderId, newStatus);
      showToast(`Order status updated to ${newStatus}`, 'success');
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

  const handleUpdatePaymentStatus = async (orderId: string, status: PaymentStatus) => {
    setIsUpdating(true);
    try {
      await updatePaymentStatus(orderId, status);
      showToast(`Payment status updated to ${status}`, 'success');
      if (selectedOrder) {
        setSelectedOrder({ ...selectedOrder, paymentStatus: status });
      }
    } catch (error) {
      console.error('Failed to update payment status:', error);
      showToast('Failed to update payment status', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const fetchCustomerHistory = async (phone: string) => {
    setHistoryLoading(true);
    try {
      const history = await orderService.getCustomerOrderHistory(shopId, phone);
      setCustomerHistory(history);
      setIsHistoryModalOpen(true);
    } catch (error) {
      console.error('Failed to fetch customer history:', error);
      showToast('Failed to load history', 'error');
    } finally {
      setHistoryLoading(false);
    }
  };

  const generateReceipt = (order: Order) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    // Header
    doc.setFontSize(22);
    doc.setTextColor(79, 70, 229); // Indigo-600
    doc.text('RECEIPT', pageWidth / 2, 20, { align: 'center' });

    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Order ID: #${order.id.toUpperCase()}`, pageWidth / 2, 28, { align: 'center' });
    doc.text(`Date: ${new Date(order.createdAt).toLocaleString()}`, pageWidth / 2, 34, { align: 'center' });

    // Customer Info
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text('Bill To:', 20, 50);
    doc.setFontSize(10);
    doc.text(order.customerName, 20, 58);
    doc.text(order.customerPhone, 20, 64);
    doc.text(order.customer_address || order.shippingAddress || 'No address', 20, 70, { maxWidth: 80 });

    // Table
    const tableData = order.items.map(item => {
      const isStringItem = typeof item === 'string';
      const name = isStringItem ? item : item.name + (item.subItemName ? ` (${item.subItemName})` : '');
      const quantity = isStringItem ? 1 : item.quantity;
      const price = isStringItem ? 0 : item.price;
      return [
        name,
        quantity.toString(),
        `${symbol}${price.toFixed(2)}`,
        `${symbol}${(quantity * price).toFixed(2)}`
      ];
    });

    autoTable(doc, {
      startY: 85,
      head: [['Item', 'Qty', 'Price', 'Total']],
      body: tableData,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      margin: { left: 20, right: 20 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 10;

    // Deli Charge
    let currentY = finalY;
    if (order.deli_charge !== undefined) {
      doc.setFontSize(10);
      doc.text(`Delivery Charge: ${symbol}${order.deli_charge.toFixed(2)}`, pageWidth - 20, currentY, { align: 'right' });
      currentY += 7;
    }

    // Total
    doc.setFontSize(14);
    doc.text(`Total Amount: ${symbol}${(order.total_price || order.totalAmount).toFixed(2)}`, pageWidth - 20, currentY, { align: 'right' });

    // Footer
    doc.setFontSize(10);
    doc.setTextColor(150);
    doc.text('Thank you for your business!', pageWidth / 2, finalY + 30, { align: 'center' });

    doc.save(`receipt-${order.id.slice(-6)}.pdf`);
  };

  const handleAddSampleData = async () => {
    if (availableItems.length === 0) {
      showToast('Please add some products first', 'error');
      return;
    }

    setIsUpdating(true);
    try {
      const sampleOrders = [
        {
          customerName: 'Aung Kyaw',
          customerPhone: '09123456789',
          customerEmail: 'aung@example.com',
          shippingAddress: 'No. 123, Pyay Road, Yangon',
          items: [
            {
              id: Math.random().toString(36).substr(2, 9),
              itemId: availableItems[0].id,
              name: availableItems[0].name,
              price: availableItems[0].price,
              quantity: 2,
              imageUrl: availableItems[0].image_url || ''
            }
          ],
          status: 'pending' as OrderStatus,
          notes: 'Please deliver in the evening'
        },
        {
          customerName: 'Ma Ma',
          customerPhone: '09987654321',
          customerEmail: 'mama@example.com',
          shippingAddress: 'No. 45, Mandalay-Lashio Road, Mandalay',
          items: [
            {
              id: Math.random().toString(36).substr(2, 9),
              itemId: availableItems[availableItems.length > 1 ? 1 : 0].id,
              name: availableItems[availableItems.length > 1 ? 1 : 0].name,
              price: availableItems[availableItems.length > 1 ? 1 : 0].price,
              quantity: 1,
              imageUrl: availableItems[availableItems.length > 1 ? 1 : 0].image_url || ''
            }
          ],
          status: 'processing' as OrderStatus,
          notes: ''
        }
      ];

      for (const sample of sampleOrders) {
        const total = sample.items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
        await orderService.createOrder(shopId, {
          ...sample,
          shopId,
          totalAmount: total,
          paymentStatus: 'pending' as PaymentStatus
        } as Omit<Order, 'id'>);
      }

      showToast('Sample orders added successfully', 'success');
      refreshOrders();
    } catch (error) {
      console.error('Failed to add sample data:', error);
      showToast('Failed to add sample data', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newOrder.items.length === 0) {
      showToast('Please add at least one item', 'error');
      return;
    }
    setIsUpdating(true);
    try {
      await orderService.createOrder(shopId, newOrder as Omit<Order, 'id'>);
      showToast('Order created successfully', 'success');
      setIsCreateModalOpen(false);
      setNewOrder({
        shopId,
        customerName: '',
        customerPhone: '',
        customerEmail: '',
        shippingAddress: '',
        items: [],
        totalAmount: 0,
        status: 'pending',
        notes: ''
      });
      refreshOrders();
    } catch (error) {
      console.error('Failed to create order:', error);
      showToast('Failed to create order', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  const addItemToOrder = (item: VendorItem) => {
    const existingItemIdx = newOrder.items.findIndex(i => i.itemId === item.id);
    let updatedItems = [...newOrder.items];
    
    if (existingItemIdx > -1) {
      updatedItems[existingItemIdx].quantity += 1;
    } else {
      updatedItems.push({
        id: Math.random().toString(36).substr(2, 9),
        itemId: item.id,
        name: item.name,
        price: item.price,
        quantity: 1,
        imageUrl: item.image_url || ''
      });
    }
    
    const total = updatedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    setNewOrder({ ...newOrder, items: updatedItems, totalAmount: total });
  };

  const removeItemFromOrder = (idx: number) => {
    const updatedItems = newOrder.items.filter((_, i) => i !== idx);
    const total = updatedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    setNewOrder({ ...newOrder, items: updatedItems, totalAmount: total });
  };

  const updateItemQuantity = (idx: number, delta: number) => {
    const updatedItems = [...newOrder.items];
    updatedItems[idx].quantity = Math.max(1, updatedItems[idx].quantity + delta);
    const total = updatedItems.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    setNewOrder({ ...newOrder, items: updatedItems, totalAmount: total });
  };

  const filteredOrders = orders.filter(order => {
    const matchesSearch = 
      order.id.toLowerCase().includes(searchQuery.toLowerCase()) || 
      order.customerName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
    
    const orderDate = new Date(order.createdAt);
    const matchesStartDate = !startDate || orderDate >= new Date(startDate);
    const matchesEndDate = !endDate || orderDate <= new Date(new Date(endDate).setHours(23, 59, 59, 999));
    
    return matchesSearch && matchesStatus && matchesStartDate && matchesEndDate;
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
            {symbol}{orders
              .filter(o => o.status === 'delivered' && new Date(o.updatedAt).toDateString() === new Date().toDateString())
              .reduce((sum, o) => sum + o.totalAmount, 0)
              .toFixed(2)}
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex bg-white p-1 rounded-2xl border border-zinc-200 shadow-sm">
          <button 
            onClick={() => setActiveSubTab('real')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all",
              activeSubTab === 'real' ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"
            )}
          >
            Real Orders ({orders.length})
          </button>
          <button 
            onClick={() => setActiveSubTab('bot')}
            className={cn(
              "px-4 py-2 rounded-xl text-sm font-bold transition-all",
              activeSubTab === 'bot' ? "bg-zinc-900 text-white" : "text-zinc-500 hover:bg-zinc-50"
            )}
          >
            Bot Interactions ({botUsers.length})
          </button>
        </div>

        <div className="flex gap-2 w-full md:w-auto">
          <button 
            onClick={() => { refreshOrders(); fetchBotUsers(); }}
            className="p-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-2xl hover:bg-zinc-50 transition-all"
            title="Refresh"
          >
            <Clock className="w-5 h-5" />
          </button>
          <button 
            onClick={handleAddSampleData}
            disabled={isUpdating || availableItems.length === 0}
            className="px-4 py-2.5 bg-white border border-zinc-200 text-zinc-600 rounded-2xl text-sm font-bold hover:bg-zinc-50 transition-all flex items-center gap-2 whitespace-nowrap disabled:opacity-50"
          >
            <History className="w-4 h-4" />
            Add Sample Data
          </button>
          <button 
            onClick={() => setIsCreateModalOpen(true)}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-2xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center gap-2 shadow-lg shadow-indigo-100 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Create Order
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-3xl border border-zinc-200 shadow-sm flex flex-col lg:flex-row gap-4">
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
        <div className="flex flex-wrap gap-2">
          <div className="flex items-center gap-2 bg-zinc-50 border border-zinc-200 rounded-2xl px-3 py-1">
            <Calendar className="w-4 h-4 text-zinc-400" />
            <input 
              type="date" 
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-transparent text-xs font-medium outline-none"
            />
            <span className="text-zinc-300">to</span>
            <input 
              type="date" 
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-transparent text-xs font-medium outline-none"
            />
            {(startDate || endDate) && (
              <button 
                onClick={() => { setStartDate(''); setEndDate(''); }}
                className="ml-1 p-1 hover:bg-zinc-200 rounded-full transition-all"
              >
                <XCircle className="w-3 h-3 text-zinc-400" />
              </button>
            )}
          </div>
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
      {activeSubTab === 'real' ? (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('orders.order_id')}</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('orders.customer')}</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Items</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('orders.total')}</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">{t('orders.status')}</th>
                  <th className="px-4 py-3 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">{t('common.loading')}</td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">
                      <div className="flex flex-col items-center gap-2">
                        <p>{t('orders.no_orders')}</p>
                        <p className="text-[10px] text-zinc-400">Searching for Shop ID: {shopId}</p>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-zinc-50 transition-all group">
                      <td className="px-4 py-3">
                        <span className="text-xs font-mono font-bold text-zinc-900">#{order.id.slice(-6).toUpperCase()}</span>
                        <p className="text-[10px] text-zinc-400">{new Date(order.createdAt).toLocaleDateString()}</p>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{order.customerName}</p>
                          <p className="text-xs text-zinc-500">{order.customerPhone}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-xs text-zinc-700 font-medium">
                          {Array.isArray(order.items) ? order.items.slice(0, 2).join(', ') : String(order.items || '-')}
                        </p>
                        {(order as any).item_qty > 1 && (
                          <span className="text-[10px] text-indigo-600 font-bold">x{(order as any).item_qty}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-zinc-900">{symbol}{(order.total_price || order.totalAmount).toLocaleString()}</p>
                        <div className="flex items-center gap-1 flex-wrap">
                          {(order as any).deli_charge > 0 && (
                            <span className="text-[10px] text-zinc-400">+{symbol}{(order as any).deli_charge} deli</span>
                          )}
                          {(order.payment_slip_url || order.paymentScreenshotUrl) && (
                            <span className="text-[10px] text-green-600 font-bold" title="Payment slip uploaded">📎Slip</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-col gap-1">
                          <span className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                            getStatusColor(order.status)
                          )}>
                            {getStatusIcon(order.status)} {order.status}
                          </span>
                          {(order.payment_slip_url || order.paymentScreenshotUrl) && (
                            <span className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                              order.paymentStatus === 'verified' ? 'bg-green-50 text-green-700 border-green-200' :
                              order.paymentStatus === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' :
                              'bg-amber-50 text-amber-700 border-amber-200'
                            )}>
                              {order.paymentStatus === 'verified' ? '✅' : order.paymentStatus === 'rejected' ? '❌' : '⏳'} 
                              {order.paymentStatus || 'pending_payment'}
                            </span>
                          )}
                        </div>
                      </td>
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                          getStatusColor(order.status)
                        )}>
                          {getStatusIcon(order.status)}
                          {t(`orders.${order.status}`)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => generateReceipt(order)}
                            className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                            title="Generate Receipt"
                          >
                            <FileText className="w-5 h-5" />
                          </button>
                          <button 
                            onClick={() => setSelectedOrder(order)}
                            className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                          >
                            <Eye className="w-5 h-5" />
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
      ) : (
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-100">
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">User ID</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Items</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">State</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {isLoading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">{t('common.loading')}</td>
                  </tr>
                ) : botUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-zinc-500">No active bot interactions found</td>
                  </tr>
                ) : (
                  botUsers.map((user) => (
                    <tr key={user.id} className="hover:bg-zinc-50 transition-all group">
                      <td className="px-6 py-4">
                        <span className="text-sm font-mono font-bold text-zinc-900">{user.id.slice(-8)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div>
                          <p className="text-sm font-bold text-zinc-900">{user.name || 'Anonymous'}</p>
                          <p className="text-xs text-zinc-500">{user.phone || 'No phone'}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm text-zinc-600">{user.items?.length || 0} items</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-sm font-bold text-zinc-900">{symbol}{(user.total_price || 0).toFixed(2)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider",
                          user.order_state === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        )}>
                          {user.order_state}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {user.order_state === 'CONFIRMING' && (
                          <button 
                            onClick={async () => {
                              try {
                                await customerService.finalizeBotOrder(shopId, user.id);
                                showToast('Order finalized successfully', 'success');
                                refreshOrders();
                                fetchBotUsers();
                              } catch (e) {
                                showToast('Failed to finalize order', 'error');
                              }
                            }}
                            className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold hover:bg-emerald-700 transition-all"
                          >
                            Finalize Order
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Create Order Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div>
                <h3 className="text-xl font-bold text-zinc-900">Create Manual Order</h3>
                <p className="text-sm text-zinc-500">Add customer details and select items</p>
              </div>
              <button onClick={() => setIsCreateModalOpen(false)} className="p-2 hover:bg-zinc-200 rounded-xl transition-all">
                <XCircle className="w-6 h-6 text-zinc-400" />
              </button>
            </div>
            
            <form onSubmit={handleCreateOrder} className="flex-1 overflow-hidden flex flex-col lg:flex-row">
              {/* Left Side: Customer Info & Items List */}
              <div className="flex-1 overflow-y-auto p-8 border-r border-zinc-100 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Customer Name</label>
                    <input 
                      required
                      type="text"
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newOrder.customerName}
                      onChange={(e) => setNewOrder({ ...newOrder, customerName: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Customer Phone</label>
                    <input 
                      required
                      type="tel"
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                      value={newOrder.customerPhone}
                      onChange={(e) => setNewOrder({ ...newOrder, customerPhone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Shipping Address</label>
                    <textarea 
                      required
                      rows={2}
                      className="w-full px-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-2xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                      value={newOrder.shippingAddress}
                      onChange={(e) => setNewOrder({ ...newOrder, shippingAddress: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Order Items</h4>
                  {newOrder.items.length === 0 ? (
                    <div className="p-12 text-center border-2 border-dashed border-zinc-200 rounded-3xl text-zinc-400">
                      No items added yet. Select from the list on the right.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {newOrder.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                          <div className="w-12 h-12 bg-white rounded-xl border border-zinc-100 flex items-center justify-center overflow-hidden shrink-0">
                            {item.imageUrl ? (
                              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                            ) : (
                              <Package className="w-5 h-5 text-zinc-300" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-zinc-900 truncate">{item.name}</p>
                            <p className="text-xs text-zinc-500">{symbol}{item.price.toFixed(2)}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center bg-white border border-zinc-200 rounded-xl overflow-hidden">
                              <button 
                                type="button"
                                onClick={() => updateItemQuantity(idx, -1)}
                                className="px-3 py-1 hover:bg-zinc-50 text-zinc-500 transition-all"
                              >
                                -
                              </button>
                              <span className="px-3 py-1 text-sm font-bold text-zinc-900 border-x border-zinc-200 min-w-[40px] text-center">
                                {item.quantity}
                              </span>
                              <button 
                                type="button"
                                onClick={() => updateItemQuantity(idx, 1)}
                                className="px-3 py-1 hover:bg-zinc-50 text-zinc-500 transition-all"
                              >
                                +
                              </button>
                            </div>
                            <button 
                              type="button"
                              onClick={() => removeItemFromOrder(idx)}
                              className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side: Item Selection */}
              <div className="w-full lg:w-80 bg-zinc-50 overflow-y-auto p-6 space-y-4">
                <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider">Select Products</h4>
                <div className="space-y-2">
                  {availableItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => addItemToOrder(item)}
                      className="w-full p-3 bg-white border border-zinc-200 rounded-2xl text-left hover:border-indigo-500 hover:shadow-sm transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-zinc-50 rounded-lg border border-zinc-100 flex items-center justify-center overflow-hidden shrink-0">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-4 h-4 text-zinc-300" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-zinc-900 truncate group-hover:text-indigo-600">{item.name}</p>
                          <p className="text-[10px] text-zinc-500">{symbol}{item.price.toFixed(2)}</p>
                        </div>
                        <Plus className="w-4 h-4 text-zinc-300 group-hover:text-indigo-600" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </form>
            
            <div className="p-6 bg-white border-t border-zinc-100 flex items-center justify-between">
              <div className="text-lg font-bold text-zinc-900">
                Total: <span className="text-indigo-600">{symbol}{newOrder.totalAmount.toFixed(2)}</span>
              </div>
              <div className="flex gap-3">
                <button 
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-6 py-2.5 border border-zinc-200 text-zinc-600 font-bold rounded-xl hover:bg-zinc-50 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleCreateOrder}
                  disabled={isUpdating || newOrder.items.length === 0}
                  className="px-8 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 flex items-center gap-2"
                >
                  {isUpdating ? <Clock className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  Create Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <div className="flex items-center gap-4">
                <div>
                  <h3 className="text-xl font-bold text-zinc-900">{t('orders.order_details')}</h3>
                  <p className="text-sm text-zinc-500">#{selectedOrder.id.toUpperCase()}</p>
                </div>
                <button 
                  onClick={() => generateReceipt(selectedOrder)}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-600 font-bold rounded-xl hover:bg-zinc-50 transition-all text-sm"
                >
                  <FileText className="w-4 h-4" />
                  Receipt
                </button>
                <a 
                  href={`/track/${shopId}/${selectedOrder.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 text-zinc-600 font-bold rounded-xl hover:bg-zinc-50 transition-all text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Tracking Link
                </a>
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
                      {selectedOrder.items.map((item, idx) => {
                        const isStringItem = typeof item === 'string';
                        const name = isStringItem ? item : item.name;
                        const price = isStringItem ? 0 : item.price;
                        const quantity = isStringItem ? 1 : item.quantity;
                        const imageUrl = isStringItem ? null : item.imageUrl;
                        const subItemName = isStringItem ? null : item.subItemName;

                        return (
                          <div key={idx} className="flex items-center gap-4 p-4 bg-zinc-50 rounded-2xl border border-zinc-100">
                            <div className="w-16 h-16 bg-white rounded-xl border border-zinc-100 flex items-center justify-center overflow-hidden shrink-0">
                              {imageUrl ? (
                                <img src={imageUrl} alt={name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="w-6 h-6 text-zinc-300" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-zinc-900 truncate">{name}</p>
                              {subItemName && <p className="text-xs text-zinc-500">{subItemName}</p>}
                              <p className="text-xs text-zinc-400 mt-1">{quantity} x {symbol}{price.toFixed(2)}</p>
                            </div>
                            <p className="text-sm font-bold text-zinc-900">{symbol}{(quantity * price).toFixed(2)}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="pt-6 border-t border-zinc-100 space-y-2">
                    {selectedOrder.deli_charge !== undefined && (
                      <div className="flex justify-between items-center text-sm text-zinc-500">
                        <span>Delivery Charge</span>
                        <span>{symbol}{selectedOrder.deli_charge.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between items-center text-lg font-bold text-zinc-900">
                      <span>{t('orders.total')}</span>
                      <span>{symbol}{(selectedOrder.total_price || selectedOrder.totalAmount).toFixed(2)}</span>
                    </div>
                  </div>

                  {selectedOrder.notes && (
                    <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                      <p className="text-xs font-bold text-amber-800 mb-1 uppercase tracking-wider">{t('orders.notes')}</p>
                      <p className="text-sm text-amber-900">{selectedOrder.notes}</p>
                    </div>
                  )}

                  {/* Payment Verification Section */}
                  <div className="pt-6 border-t border-zinc-100 space-y-4">
                    <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-indigo-600" />
                      Payment Verification
                    </h4>
                    
                    {(selectedOrder.paymentScreenshotUrl || selectedOrder.payment_slip_url) ? (
                      <div className="space-y-4">
                        <div className="aspect-video bg-zinc-100 rounded-2xl border border-zinc-200 overflow-hidden relative group">
                          <img 
                            src={selectedOrder.paymentScreenshotUrl || selectedOrder.payment_slip_url} 
                            alt="Payment Proof" 
                            className="w-full h-full object-contain"
                          />
                          <a 
                            href={selectedOrder.paymentScreenshotUrl || selectedOrder.payment_slip_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white font-bold gap-2"
                          >
                            <ExternalLink className="w-5 h-5" />
                            View Full Size
                          </a>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdatePaymentStatus(selectedOrder.id, 'verified')}
                            disabled={isUpdating || selectedOrder.paymentStatus === 'verified'}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all border",
                              selectedOrder.paymentStatus === 'verified'
                                ? "bg-emerald-50 border-emerald-100 text-emerald-700"
                                : "bg-white border-zinc-200 text-zinc-600 hover:bg-emerald-50 hover:border-emerald-100 hover:text-emerald-700"
                            )}
                          >
                            <CheckCircle className="w-4 h-4" />
                            Verify Payment
                          </button>
                          <button
                            onClick={() => handleUpdatePaymentStatus(selectedOrder.id, 'rejected')}
                            disabled={isUpdating || selectedOrder.paymentStatus === 'rejected'}
                            className={cn(
                              "flex-1 flex items-center justify-center gap-2 py-3 rounded-2xl text-sm font-bold transition-all border",
                              selectedOrder.paymentStatus === 'rejected'
                                ? "bg-red-50 border-red-100 text-red-700"
                                : "bg-white border-zinc-200 text-zinc-600 hover:bg-red-50 hover:border-red-100 hover:text-red-700"
                            )}
                          >
                            <XCircle className="w-4 h-4" />
                            Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-8 text-center bg-zinc-50 rounded-2xl border border-dashed border-zinc-200">
                        <ShieldAlert className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                        <p className="text-sm text-zinc-500 font-medium">No payment proof uploaded yet</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Customer & Status */}
                <div className="space-y-8">
                  <div className="space-y-4">
                    <h4 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                      <User className="w-4 h-4 text-indigo-600" />
                      {t('orders.customer')}
                    </h4>
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <User className="w-4 h-4 text-zinc-400 mt-0.5" />
                          <div>
                            <p className="text-sm font-bold text-zinc-900">{selectedOrder.customerName}</p>
                          </div>
                        </div>
                        <button 
                          onClick={() => fetchCustomerHistory(selectedOrder.customerPhone)}
                          className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-all"
                          title="View History"
                        >
                          <History className="w-4 h-4" />
                        </button>
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
                        <p className="text-sm text-zinc-600 leading-relaxed">
                          {selectedOrder.customer_address || selectedOrder.shippingAddress || 'No address provided'}
                        </p>
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
      {/* Customer History Modal */}
      {isHistoryModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden border border-zinc-200 animate-in zoom-in-95 duration-200 max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-zinc-100 flex items-center justify-between bg-zinc-50">
              <h3 className="text-xl font-bold text-zinc-900">Order History</h3>
              <button onClick={() => setIsHistoryModalOpen(false)} className="p-2 hover:bg-zinc-200 rounded-xl transition-all">
                <XCircle className="w-6 h-6 text-zinc-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {customerHistory.length === 0 ? (
                <p className="text-center text-zinc-500 py-12">No past orders found.</p>
              ) : (
                customerHistory.map(order => (
                  <div key={order.id} className="p-4 bg-zinc-50 rounded-2xl border border-zinc-100 flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-zinc-900">#{order.id.slice(-6).toUpperCase()}</p>
                      <p className="text-xs text-zinc-500">{new Date(order.createdAt).toLocaleDateString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-zinc-900">{symbol}{order.totalAmount.toFixed(2)}</p>
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-wider",
                        order.status === 'delivered' ? "text-emerald-600" : "text-zinc-500"
                      )}>
                        {order.status}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
