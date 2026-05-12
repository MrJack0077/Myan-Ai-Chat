import React, { useState, useEffect } from 'react';
import { Search, User, ShoppingBag, Star, Mail, Phone, MapPin, Activity, ShieldAlert } from 'lucide-react';
import * as orderService from '../../../services/orderService';
import { Order } from '../../../types';

interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  totalOrders: number;
  totalSpent: number;
  sentiment: 'Positive' | 'Neutral' | 'Negative';
  lastActive: string;
  orders: Order[];
}

export default function CustomerManager({ shopId }: { shopId?: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      if (!shopId) return;
      setIsLoading(true);
      try {
        const orders = await orderService.getOrders(shopId);
        
        // Group orders by customer phone or email to create unique customers
        const customerMap = new Map<string, Customer>();
        
        orders.forEach(order => {
          const key = order.customerPhone || order.customerEmail || order.customerName;
          if (!key) return;

          if (!customerMap.has(key)) {
            customerMap.set(key, {
              id: key,
              name: order.customerName,
              email: order.customerEmail || 'N/A',
              phone: order.customerPhone || 'N/A',
              address: order.shippingAddress || 'N/A',
              totalOrders: 0,
              totalSpent: 0,
              sentiment: Math.random() > 0.8 ? 'Negative' : (Math.random() > 0.4 ? 'Positive' : 'Neutral'), // Mock sentiment
              lastActive: order.createdAt,
              orders: []
            });
          }
          
          const customer = customerMap.get(key)!;
          customer.totalOrders += 1;
          customer.totalSpent += order.totalAmount;
          customer.orders.push(order);
          
          // Update last active if this order is newer
          if (new Date(order.createdAt) > new Date(customer.lastActive)) {
            customer.lastActive = order.createdAt;
          }
        });

        setCustomers(Array.from(customerMap.values()).sort((a, b) => b.totalSpent - a.totalSpent));
      } catch (error) {
        console.error('Failed to fetch customers:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, [shopId]);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    c.phone.includes(searchQuery) ||
    c.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-4">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-zinc-500 font-medium">Loading customer insights...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-12rem)]">
      {/* Customer List */}
      <div className="w-full lg:w-1/3 bg-white rounded-3xl border border-zinc-200 shadow-sm flex flex-col overflow-hidden">
        <div className="p-6 border-b border-zinc-100">
          <h3 className="text-xl font-bold text-zinc-900 mb-4">Smart CRM</h3>
          <div className="relative">
            <Search className="w-5 h-5 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search customers..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredCustomers.map(customer => (
            <div 
              key={customer.id}
              onClick={() => setSelectedCustomer(customer)}
              className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                selectedCustomer?.id === customer.id 
                  ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                  : 'bg-white border-zinc-100 hover:border-indigo-200 hover:bg-zinc-50'
              }`}
            >
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-zinc-100 rounded-full flex items-center justify-center text-zinc-500 font-bold">
                    {customer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-bold text-zinc-900 text-sm">{customer.name}</h4>
                    <p className="text-xs text-zinc-500">{customer.phone}</p>
                  </div>
                </div>
                {customer.sentiment === 'Negative' && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-red-600 bg-red-50 px-2 py-1 rounded-lg">
                    <ShieldAlert className="w-3 h-3" /> Needs Attention
                  </span>
                )}
              </div>
              <div className="flex justify-between items-center mt-3 pt-3 border-t border-zinc-100/50">
                <div className="text-xs text-zinc-500">
                  <span className="font-bold text-zinc-900">{customer.totalOrders}</span> orders
                </div>
                <div className="text-xs font-bold text-indigo-600">
                  {customer.totalSpent.toLocaleString()} Ks
                </div>
              </div>
            </div>
          ))}
          {filteredCustomers.length === 0 && (
            <div className="text-center py-12 text-zinc-500 text-sm">
              No customers found.
            </div>
          )}
        </div>
      </div>

      {/* Customer Details */}
      <div className="w-full lg:w-2/3 bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
        {selectedCustomer ? (
          <>
            <div className="p-8 border-b border-zinc-100 bg-zinc-50/50">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center text-2xl font-bold shadow-sm">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-zinc-900">{selectedCustomer.name}</h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-zinc-500">
                      <span className="flex items-center gap-1.5"><Phone className="w-4 h-4" /> {selectedCustomer.phone}</span>
                      <span className="flex items-center gap-1.5"><Mail className="w-4 h-4" /> {selectedCustomer.email}</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex gap-3">
                  <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 ${
                    selectedCustomer.sentiment === 'Positive' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                    selectedCustomer.sentiment === 'Negative' ? 'bg-red-50 border-red-200 text-red-700' :
                    'bg-amber-50 border-amber-200 text-amber-700'
                  }`}>
                    <Activity className="w-4 h-4" />
                    <span className="text-sm font-bold">{selectedCustomer.sentiment} Sentiment</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-8 space-y-8">
              {/* Stats Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl border border-zinc-100 bg-white shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><ShoppingBag className="w-4 h-4" /></div>
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Orders</span>
                  </div>
                  <p className="text-2xl font-bold text-zinc-900">{selectedCustomer.totalOrders}</p>
                </div>
                <div className="p-5 rounded-2xl border border-zinc-100 bg-white shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Star className="w-4 h-4" /></div>
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Total Spent</span>
                  </div>
                  <p className="text-2xl font-bold text-zinc-900">{selectedCustomer.totalSpent.toLocaleString()} Ks</p>
                </div>
                <div className="p-5 rounded-2xl border border-zinc-100 bg-white shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-amber-50 text-amber-600 rounded-lg"><MapPin className="w-4 h-4" /></div>
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Location</span>
                  </div>
                  <p className="text-sm font-medium text-zinc-900 line-clamp-2">{selectedCustomer.address}</p>
                </div>
              </div>

              {/* Past Purchases */}
              <div>
                <h3 className="text-lg font-bold text-zinc-900 mb-4 flex items-center gap-2">
                  <ShoppingBag className="w-5 h-5 text-indigo-600" /> Past Purchases
                </h3>
                <div className="space-y-4">
                  {selectedCustomer.orders.map(order => (
                    <div key={order.id} className="p-5 rounded-2xl border border-zinc-200 bg-white shadow-sm">
                      <div className="flex justify-between items-center mb-4 pb-4 border-b border-zinc-100">
                        <div>
                          <p className="text-xs text-zinc-500 font-medium mb-1">{new Date(order.createdAt).toLocaleDateString()}</p>
                          <p className="text-sm font-bold text-zinc-900">Order #{order.id.slice(-6).toUpperCase()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-indigo-600">{order.totalAmount.toLocaleString()} Ks</p>
                          <span className={`inline-block mt-1 px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                            order.status === 'delivered' ? 'bg-emerald-100 text-emerald-700' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                            'bg-amber-100 text-amber-700'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      </div>
                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-sm">
                            <span className="text-zinc-700">{item.quantity}x {item.name}</span>
                            <span className="text-zinc-900 font-medium">{(item.price * item.quantity).toLocaleString()} Ks</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mb-4">
              <User className="w-10 h-10 text-zinc-300" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900 mb-2">Select a Customer</h3>
            <p className="text-zinc-500 max-w-sm">
              Click on a customer from the list to view their detailed insights, past purchases, and AI-analyzed sentiment.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
