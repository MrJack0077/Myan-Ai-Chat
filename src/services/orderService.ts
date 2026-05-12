import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc,
  query,
  where,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order, OrderStatus, PaymentStatus, VendorItem, OrderItem } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { saveItem } from './inventoryService';

export const getOrders = async (shopId: string): Promise<Order[]> => {
  if (!shopId) return [];
  
  try {
    const subColRef = collection(db, 'shops', shopId, 'orders');
    const subSnap = await getDocs(subColRef);
    let ordersData = subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    if (ordersData.length === 0) {
      const rootColRef = collection(db, 'orders');
      const q = query(rootColRef, where('shopId', '==', shopId));
      const rootSnap = await getDocs(q);
      ordersData = rootSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    const orders = ordersData.map((data: any) => {
      const normalizedItems = (data.items || []).map((item: any) => {
        if (typeof item === 'string') {
          return { id: Math.random().toString(36).substr(2, 9), itemId: 'manual', name: item, price: 0, quantity: 1 };
        }
        return item;
      });

      return { 
        id: data.id, 
        ...data,
        customerName: data.customerName || data.customer_name || 'Unknown',
        customerPhone: data.customerPhone || data.customer_phone || '',
        shippingAddress: data.shippingAddress || data.shipping_address || data.address || '',
        items: normalizedItems,
        totalAmount: data.totalAmount || data.total_amount || data.total_price || 0,
        createdAt: data.createdAt || data.created_at || new Date().toISOString(),
        updatedAt: data.updatedAt || data.updated_at || data.createdAt || data.created_at || new Date().toISOString()
      } as Order;
    });

    return orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch(error) {
    handleFirestoreError(error, OperationType.LIST, `shops/${shopId}/orders`);
    return [];
  }
};

export const createOrder = async (shopId: string, order: Omit<Order, 'id'>) => {
  try {
    const colRef = collection(db, 'shops', shopId, 'orders');
    const sanitizedOrder = JSON.parse(JSON.stringify(order));
    const now = new Date().toISOString();
    const orderData = {
      ...sanitizedOrder,
      shopId,
      createdAt: now,
      created_at: now,
      updatedAt: now,
      updated_at: now,
      customer_name: order.customerName,
      customer_phone: order.customerPhone,
      total_amount: order.totalAmount
    };

    const docRef = await addDoc(colRef, orderData);
    return docRef.id;
  } catch(error) {
    handleFirestoreError(error, OperationType.WRITE, `shops/${shopId}/orders`);
    throw error;
  }
};

export const updateOrderStatus = async (shopId: string, orderId: string, status: OrderStatus) => {
  try {
    const docRef = doc(db, 'shops', shopId, 'orders', orderId);
    if (status === 'processing') {
      const orderSnap = await getDoc(docRef);
      if (orderSnap.exists()) {
        const orderData = orderSnap.data() as Order;
        for (const item of orderData.items) {
          if (item.itemId && item.itemId !== 'bot-generated') {
            const itemRef = doc(db, 'shops', shopId, 'items', item.itemId);
            const itemSnap = await getDoc(itemRef);
            if (itemSnap.exists()) {
              const itemData = itemSnap.data() as VendorItem;
              const currentStock = itemData.stock_quantity || 0;
              const newStock = Math.max(0, currentStock - item.quantity);
              await saveItem(shopId, { ...itemData, stock_quantity: newStock }, true);
            }
          }
        }
      }
    }

    await setDoc(docRef, { status, updatedAt: new Date().toISOString() }, { merge: true });
  } catch(error) {
    handleFirestoreError(error, OperationType.WRITE, `shops/${shopId}/orders/${orderId}`);
  }
};

export const updateOrderPaymentStatus = async (shopId: string, orderId: string, paymentStatus: PaymentStatus) => {
  const docRef = doc(db, 'shops', shopId, 'orders', orderId);
  try {
    await setDoc(docRef, { paymentStatus, updatedAt: new Date().toISOString() }, { merge: true });
  } catch(error) {
    handleFirestoreError(error, OperationType.WRITE, `shops/${shopId}/orders/${orderId}`);
  }
};

export const getCustomerOrderHistory = async (shopId: string, customerPhone: string): Promise<Order[]> => {
  try {
    const colRef = collection(db, 'shops', shopId, 'orders');
    const q = query(colRef, where('customerPhone', '==', customerPhone));
    const snap = await getDocs(q);
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  } catch(error) {
    handleFirestoreError(error, OperationType.LIST, `shops/${shopId}/orders`);
    return [];
  }
};

export const subscribeToOrders = (shopId: string, callback: (orders: Order[]) => void) => {
  const subColRef = collection(db, 'shops', shopId, 'orders');
  return onSnapshot(subColRef, (snapshot) => {
    const orders = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      const normalizedItems = (data.items || []).map((item: any) => {
        if (typeof item === 'string') {
          return { id: Math.random().toString(36).substr(2, 9), itemId: 'manual', name: item, price: 0, quantity: 1 };
        }
        return item;
      });

      return { 
        id: doc.id, 
        ...data,
        customerName: data.customerName || data.customer_name || 'Unknown',
        customerPhone: data.customerPhone || data.customer_phone || '',
        shippingAddress: data.shippingAddress || data.shipping_address || data.address || '',
        items: normalizedItems,
        totalAmount: data.totalAmount || data.total_amount || data.total_price || 0,
        createdAt: data.createdAt || data.created_at || new Date().toISOString(),
        updatedAt: data.updatedAt || data.updated_at || data.createdAt || data.created_at || new Date().toISOString()
      } as Order;
    });

    callback(orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, `shops/${shopId}/orders`);
  });
};

export const getOrder = async (shopId: string, orderId: string): Promise<Order | null> => {
  try {
    const docRef = doc(db, 'shops', shopId, 'orders', orderId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    
    const data = docSnap.data();
    const normalizedItems = (data.items || []).map((item: any) => {
      if (typeof item === 'string') return { id: Math.random().toString(36).substr(2, 9), itemId: 'manual', name: item, price: 0, quantity: 1 };
      return item;
    });

    return { 
      id: docSnap.id, 
      ...data,
      customerName: data.customerName || data.customer_name || 'Unknown',
      customerPhone: data.customerPhone || data.customer_phone || '',
      shippingAddress: data.shippingAddress || data.shipping_address || data.address || '',
      items: normalizedItems,
      totalAmount: data.totalAmount || data.total_amount || data.total_price || 0,
      createdAt: data.createdAt || data.created_at || new Date().toISOString(),
      updatedAt: data.updatedAt || data.updated_at || data.createdAt || data.created_at || new Date().toISOString()
    } as Order;
  } catch(error) {
    handleFirestoreError(error, OperationType.GET, `shops/${shopId}/orders/${orderId}`);
    return null;
  }
};
