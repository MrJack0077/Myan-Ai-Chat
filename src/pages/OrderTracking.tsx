import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getOrder, getShop } from '../services/firebaseService';
import { Order, OrderStatus, Shop } from '../types';
import { 
  Package, 
  Truck, 
  CheckCircle, 
  Clock, 
  MapPin, 
  ShoppingBag, 
  ShieldCheck,
  AlertCircle
} from 'lucide-react';
import { cn } from '../lib/utils';

export default function OrderTracking() {
  const { shopId, orderId } = useParams<{ shopId: string; orderId: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [shop, setShop] = useState<Shop | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (shopId && orderId) {
      fetchData();
    }
  }, [shopId, orderId]);

  const fetchData = async () => {
    try {
      const [orderData, shopData] = await Promise.all([
        getOrder(shopId!, orderId!),
        getShop(shopId!)
      ]);

      if (orderData) {
        setOrder(orderData);
      } else {
        setError('Order not found');
      }

      if (shopData) {
        setShop(shopData);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load order information');
    } finally {
      setLoading(false);
    }
  };

  const getCurrencySymbol = (code: string) => {
    switch (code) {
      case 'MMK': return 'Ks';
      case 'THB': return '฿';
      case 'USD': return '$';
      default: return '$';
    }
  };

  const symbol = getCurrencySymbol(shop?.currency || 'MMK');

  const getStatusStep = (status: OrderStatus) => {
    const steps = ['pending', 'processing', 'shipped', 'delivered'];
    return steps.indexOf(status);
  };

  const steps = [
    { id: 'pending', label: 'Order Placed', icon: Clock },
    { id: 'processing', label: 'Processing', icon: Package },
    { id: 'shipped', label: 'In Transit', icon: Truck },
    { id: 'delivered', label: 'Delivered', icon: CheckCircle },
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-zinc-500 font-bold">Tracking your order...</p>
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-3xl shadow-xl border border-zinc-200 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Oops!</h1>
          <p className="text-zinc-500 mb-6">{error || 'Something went wrong'}</p>
          <button 
            onClick={() => window.location.reload()}
            className="w-full py-3 bg-zinc-900 text-white font-bold rounded-xl hover:bg-zinc-800 transition-all"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const currentStep = getStatusStep(order.status);

  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-600 rounded-2xl shadow-lg shadow-indigo-200 mb-6">
            <ShoppingBag className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-zinc-900 mb-2">Track Your Order</h1>
          <p className="text-zinc-500">Order #{order.id.toUpperCase()}</p>
        </div>

        {/* Status Progress */}
        <div className="bg-white rounded-3xl shadow-xl border border-zinc-200 p-8 mb-8">
          <div className="relative">
            {/* Progress Line */}
            <div className="absolute top-5 left-0 w-full h-0.5 bg-zinc-100" />
            <div 
              className="absolute top-5 left-0 h-0.5 bg-indigo-600 transition-all duration-1000" 
              style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
            />

            {/* Steps */}
            <div className="relative flex justify-between">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isCompleted = idx <= currentStep;
                const isCurrent = idx === currentStep;

                return (
                  <div key={step.id} className="flex flex-col items-center">
                    <div className={cn(
                      "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 z-10",
                      isCompleted ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200" : "bg-white border-2 border-zinc-200 text-zinc-300"
                    )}>
                      {isCompleted && idx < currentStep ? (
                        <CheckCircle className="w-6 h-6" />
                      ) : (
                        <Icon className="w-5 h-5" />
                      )}
                    </div>
                    <p className={cn(
                      "mt-3 text-[10px] font-bold uppercase tracking-wider text-center",
                      isCompleted ? "text-indigo-600" : "text-zinc-400"
                    )}>
                      {step.label}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-white rounded-3xl shadow-xl border border-zinc-200 p-8">
            <h3 className="text-lg font-bold text-zinc-900 mb-6 flex items-center gap-2">
              <Package className="w-5 h-5 text-indigo-600" />
              Order Summary
            </h3>
            <div className="space-y-4">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center py-2 border-b border-zinc-50 last:border-0">
                  <div>
                    <p className="text-sm font-bold text-zinc-900">{item.name}</p>
                    <p className="text-xs text-zinc-500">Qty: {item.quantity}</p>
                  </div>
                  <p className="text-sm font-bold text-zinc-900">{symbol}{(item.quantity * item.price).toFixed(2)}</p>
                </div>
              ))}
              <div className="pt-4 flex justify-between items-center text-lg font-bold text-zinc-900">
                <span>Total</span>
                <span>{symbol}{order.totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl shadow-xl border border-zinc-200 p-8">
            <h3 className="text-lg font-bold text-zinc-900 mb-6 flex items-center gap-2">
              <MapPin className="w-5 h-5 text-indigo-600" />
              Delivery Info
            </h3>
            <div className="space-y-6">
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Customer</p>
                <p className="text-sm text-zinc-900 font-bold">{order.customerName}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Shipping Address</p>
                <p className="text-sm text-zinc-600 leading-relaxed">{order.shippingAddress}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-1">Payment Status</p>
                <div className="flex items-center gap-2">
                  {order.paymentStatus === 'verified' ? (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-bold uppercase">
                      <ShieldCheck className="w-3 h-3" />
                      Verified
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-700 rounded-lg text-[10px] font-bold uppercase">
                      <Clock className="w-3 h-3" />
                      Pending
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center">
          <p className="text-zinc-400 text-sm">
            Need help? Contact the shop directly.
          </p>
        </div>
      </div>
    </div>
  );
}
