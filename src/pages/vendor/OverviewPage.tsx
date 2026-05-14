import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Package, 
  ShoppingBag, 
  Users, 
  TrendingUp, 
  Activity,
  ArrowUpRight,
  Sparkles,
  Server,
  Cpu,
  Database,
  Zap,
  CheckCircle2,
  XCircle,
  Bot,
  MessageSquare
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getCurrencySymbol } from '../../lib/utils';

// Import hooks
import { useShop } from '../../features/shop/hooks/useShop';
import { useInventory } from '../../features/inventory/hooks/useInventory';
import { useOrders } from '../../features/orders/hooks/useOrders';

export default function OverviewPage() {
  const { shopId } = useParams<{ shopId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const effectiveShopId = shopId || user?.shopId;

  const { shop: currentShop, loading: shopLoading } = useShop(effectiveShopId);
  const { items, loading: itemsLoading } = useInventory(effectiveShopId);
  const { orders, loading: ordersLoading } = useOrders(effectiveShopId);

  const isLoading = shopLoading || itemsLoading || ordersLoading;

  const symbol = getCurrencySymbol(currentShop?.currency || 'MMK');

  if (isLoading) {
    return <div className="p-8 text-center text-zinc-500">Loading Overview...</div>;
  }

  const totalSales = orders.reduce((acc, order) => acc + (order.totalAmount || 0), 0);
  const lowStockItems = items.filter(i => i.stock_quantity < 10 && i.stock_quantity > 0).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-black text-zinc-900 tracking-tight">Overview</h1>
        <p className="text-sm font-medium text-zinc-500 mt-1">Quick snapshot of your shop's performance.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -z-10 group-hover:bg-indigo-100 transition-colors"></div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-indigo-600 rounded-xl">
              <ShoppingBag className="w-5 h-5 text-white" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-500 mb-1">Total Sales</p>
          <h3 className="text-2xl font-black text-zinc-900 tracking-tight">{symbol}{totalSales.toLocaleString()}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm relative overflow-hidden group hover:border-emerald-200 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-bl-full -z-10 group-hover:bg-emerald-100 transition-colors"></div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-emerald-600 rounded-xl">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-500 mb-1">Orders</p>
          <h3 className="text-2xl font-black text-zinc-900 tracking-tight">{orders.length}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm relative overflow-hidden group hover:border-amber-200 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-50 rounded-bl-full -z-10 group-hover:bg-amber-100 transition-colors"></div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-amber-600 rounded-xl">
              <Package className="w-5 h-5 text-white" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-500 mb-1">Total Items</p>
          <h3 className="text-2xl font-black text-zinc-900 tracking-tight">{items.length}</h3>
        </div>

        <div className="bg-white p-6 rounded-3xl border border-zinc-200 shadow-sm relative overflow-hidden group hover:border-indigo-200 transition-all">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-bl-full -z-10 group-hover:bg-indigo-100 transition-colors"></div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-2.5 bg-indigo-600 rounded-xl">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <ArrowUpRight className="w-4 h-4 text-zinc-400" />
          </div>
          <p className="text-sm font-medium text-zinc-500 mb-1">Low Stock</p>
          <h3 className="text-2xl font-black text-zinc-900 tracking-tight">{lowStockItems}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Recent Orders */}
          <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-500" />
                Recent Orders
              </h3>
              <button 
                onClick={() => navigate('orders')}
                className="text-sm font-bold text-indigo-600 hover:text-indigo-700"
              >
                View All
              </button>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="pb-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Order ID</th>
                    <th className="pb-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Customer</th>
                    <th className="pb-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Date</th>
                    <th className="pb-3 text-xs font-bold text-zinc-500 uppercase tracking-wider">Status</th>
                    <th className="pb-3 text-xs font-bold text-zinc-500 uppercase tracking-wider text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {orders.slice(0, 5).map(order => (
                    <tr key={order.id} className="hover:bg-zinc-50 transition-colors">
                      <td className="py-3 text-sm font-medium text-zinc-900">#{order.id.slice(0, 8)}</td>
                      <td className="py-3 text-sm text-zinc-600 font-medium">{order.customerName || 'Guest'}</td>
                      <td className="py-3 text-sm text-zinc-600 font-medium">{new Date(order.createdAt).toLocaleDateString()}</td>
                      <td className="py-3">
                        <span className={`inline-flex items-center px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                          order.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                          order.status === 'processing' ? 'bg-blue-100 text-blue-700' :
                          order.status === 'shipped' ? 'bg-indigo-100 text-indigo-700' :
                          order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                          'bg-zinc-100 text-zinc-700'
                        }`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="py-3 text-sm font-bold text-zinc-900 text-right">{symbol}{Number(order.totalAmount).toLocaleString()}</td>
                    </tr>
                  ))}
                  {orders.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-zinc-500 text-sm font-medium">
                        No orders yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Trending Products */}
          <div className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
            <h3 className="text-lg font-bold text-zinc-900 mb-6 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-500" />
              Trending Products
            </h3>
            <div className="space-y-4">
              {items.slice(0, 4).map((item, index) => (
                <div key={item.id} className="flex items-center gap-4 group cursor-pointer hover:bg-zinc-50 p-2 rounded-2xl transition-all">
                  <div className="w-10 h-10 rounded-xl bg-zinc-100 flex items-center justify-center text-zinc-500 font-bold text-sm shrink-0 transition-all group-hover:bg-indigo-600 group-hover:text-white">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-zinc-900 truncate tracking-tight">{item.name}</p>
                    <p className="text-xs text-zinc-500 font-medium">{item.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-zinc-900">{symbol}{Number(item.price).toLocaleString()}</p>
                  </div>
                </div>
              ))}
              {items.length === 0 && (
                <p className="text-sm font-medium text-zinc-500 text-center py-4">No products yet</p>
              )}
            </div>
          </div>

          {/* AI Banner */}
          <div className="bg-zinc-900 rounded-3xl p-8 text-white relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-bl-full"></div>
            <Sparkles className="w-8 h-8 text-indigo-400 mb-4" />
            <h3 className="text-xl font-bold mb-2">AI Shop Assistant</h3>
            <p className="text-sm text-zinc-400 mb-6 leading-relaxed">
              Your assistant has handled 124 questions today with an 85% success rate.
            </p>
            <button 
              onClick={() => navigate('ai-training')}
              className="w-full py-3 bg-white text-zinc-900 rounded-2xl font-bold hover:bg-indigo-50 transition-all active:scale-95"
            >
              Train Assistant
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
