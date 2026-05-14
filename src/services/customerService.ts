import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc,
  query,
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { createOrder } from './orderService';
import { OrderItem, Order } from '../types';

export interface BotUser {
  id: string;
  order_state: 'IDLE' | 'COLLECTING' | 'CONFIRMING' | 'COMPLETED';
  name: string;
  phone: string;
  address: string;
  items: string[];
  total_price: number;
  payment_method: string;
  summary?: string;
  last_updated: string;
}

// ── Mapping: Backend nested profile (shops/{id}/customers/) ↔ Flat BotUser ──

function mapProfileToBotUser(userId: string, profile: Record<string, any>): BotUser {
  const identification = profile.identification || {};
  const dynamics = profile.dynamics || {};
  const currentOrder = profile.current_order || {};
  const aiInsights = profile.ai_insights || {};

  return {
    id: userId,
    order_state: dynamics.order_state || 'IDLE',
    name: identification.name || '',
    phone: identification.phone || '',
    address: currentOrder.address || '',
    items: currentOrder.items || [],
    total_price: currentOrder.total_price || 0,
    payment_method: currentOrder.payment_method || '',
    summary: aiInsights.conversation_summary || '',
    last_updated: profile.last_updated || new Date().toISOString(),
  };
}

function mapBotUserToProfile(data: Partial<BotUser>): Record<string, any> {
  const update: Record<string, any> = { last_updated: new Date().toISOString() };

  if (data.name !== undefined || data.phone !== undefined) {
    update['identification'] = {};
    if (data.name !== undefined) update['identification'].name = data.name;
    if (data.phone !== undefined) update['identification'].phone = data.phone;
  }
  if (data.order_state !== undefined) {
    update['dynamics'] = update['dynamics'] || {};
    update['dynamics'].order_state = data.order_state;
  }
  if (data.address !== undefined || data.items !== undefined || data.total_price !== undefined || data.payment_method !== undefined) {
    update['current_order'] = update['current_order'] || {};
    if (data.address !== undefined) update['current_order'].address = data.address;
    if (data.items !== undefined) update['current_order'].items = data.items;
    if (data.total_price !== undefined) update['current_order'].total_price = data.total_price;
    if (data.payment_method !== undefined) update['current_order'].payment_method = data.payment_method;
  }
  if (data.summary !== undefined) {
    update['ai_insights'] = update['ai_insights'] || {};
    update['ai_insights'].conversation_summary = data.summary;
  }

  return update;
}

// ── CRUD Operations (now using shops/{shopId}/customers/) ──

export const getBotUser = async (shopId: string, userId: string): Promise<BotUser | null> => {
  try {
    const docRef = doc(db, 'shops', shopId, 'customers', userId);
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) return null;
    return mapProfileToBotUser(userId, docSnap.data() || {});
  } catch(error) {
    handleFirestoreError(error, OperationType.GET, `shops/${shopId}/customers/${userId}`);
    return null;
  }
};

export const updateBotUser = async (shopId: string, userId: string, data: Partial<Omit<BotUser, 'id'>>) => {
  try {
    const docRef = doc(db, 'shops', shopId, 'customers', userId);
    const nestedData = mapBotUserToProfile(data);
    await setDoc(docRef, nestedData, { merge: true });
  } catch(error) {
    handleFirestoreError(error, OperationType.WRITE, `shops/${shopId}/customers/${userId}`);
  }
};

export const subscribeToBotUsers = (shopId: string, callback: (users: BotUser[]) => void) => {
  const colRef = collection(db, 'shops', shopId, 'customers');
  const q = query(colRef, orderBy('last_updated', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs
      .map(doc => mapProfileToBotUser(doc.id, doc.data() || {}));
    callback(users);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, `shops/${shopId}/customers`);
  });
};

export const getBotUsers = async (shopId: string): Promise<BotUser[]> => {
  try {
    const colRef = collection(db, 'shops', shopId, 'customers');
    const snap = await getDocs(colRef);
    return snap.docs
      .map(doc => mapProfileToBotUser(doc.id, doc.data() || {}));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, `shops/${shopId}/customers`);
    return [];
  }
};

export const finalizeBotOrder = async (shopId: string, userId: string) => {
  const botUser = await getBotUser(shopId, userId);
  if (!botUser) throw new Error('Bot user not found');

  const orderItems: OrderItem[] = botUser.items.map((itemName, index) => ({
    id: `bot-item-${index}-${Date.now()}`,
    itemId: 'bot-generated',
    name: itemName,
    price: botUser.total_price / botUser.items.length, 
    quantity: 1
  }));

  const orderData: Omit<Order, 'id'> = {
    shopId,
    userId: botUser.id,
    customerName: botUser.name || 'Bot Customer',
    customerPhone: botUser.phone || '',
    shippingAddress: botUser.address || '',
    items: orderItems,
    totalAmount: botUser.total_price,
    status: 'pending',
    paymentMethod: botUser.payment_method as any || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: botUser.summary || ''
  };

  const orderId = await createOrder(shopId, orderData);

  await updateBotUser(shopId, userId, {
    order_state: 'COMPLETED',
    items: [],
    total_price: 0,
    name: '',
    phone: '',
    address: '',
    payment_method: ''
  });

  return orderId;
};
