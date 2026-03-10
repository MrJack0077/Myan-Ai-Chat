import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query, 
  where,
  addDoc,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Shop, VendorItem, FAQ, ShopAIConfig, Category, Order, OrderStatus } from '../types';

// Secondary Firebase App for creating users without affecting admin session
const secondaryAppConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const secondaryApp = initializeApp(secondaryAppConfig, 'SecondaryApp');
const secondaryAuth = getAuth(secondaryApp);

// Shops
export const getShop = async (shopId: string): Promise<Shop | null> => {
  const docRef = doc(db, 'shops', shopId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? (docSnap.data() as Shop) : null;
};

export const getAllShops = async (): Promise<Shop[]> => {
  const colRef = collection(db, 'shops');
  const querySnap = await getDocs(colRef);
  return querySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop));
};

export const createVendorUser = async (email: string, password: string, shopId: string) => {
  try {
    // Create user in Firebase Auth using secondary app to avoid signing out admin
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const user = userCredential.user;

    // Create user profile in Firestore
    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, {
      email,
      role: 'VENDOR',
      shopId,
      createdAt: new Date().toISOString()
    });

    // Sign out from secondary app immediately
    await signOut(secondaryAuth);
    
    return user.uid;
  } catch (error) {
    console.error('Error creating vendor user:', error);
    throw error;
  }
};

export const saveShop = async (shop: Partial<Shop> & { vendorCredentials?: { email: string, password?: string } }) => {
  const colRef = collection(db, 'shops');
  if (shop.id) {
    const docRef = doc(db, 'shops', shop.id);
    await setDoc(docRef, shop, { merge: true });
    return shop.id;
  } else {
    const docRef = await addDoc(colRef, {
      ...shop,
      createdAt: new Date().toISOString(),
      status: shop.status || 'active',
      size: 0
    });
    return docRef.id;
  }
};

export const deleteShop = async (shopId: string) => {
  const docRef = doc(db, 'shops', shopId);
  await deleteDoc(docRef);
};

export const updateShopAIConfig = async (shopId: string, config: ShopAIConfig) => {
  const docRef = doc(db, 'shops', shopId);
  await setDoc(docRef, { aiConfig: config }, { merge: true });
};

// Items (AI-Optimized)
export const getItems = async (shopId: string): Promise<VendorItem[]> => {
  const colRef = collection(db, 'shops', shopId, 'items');
  const querySnap = await getDocs(colRef);
  return querySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorItem));
};

export const saveItem = async (shopId: string, item: Partial<VendorItem>) => {
  const colRef = collection(db, 'shops', shopId, 'items');
  if (item.id) {
    const docRef = doc(db, 'shops', shopId, 'items', item.id);
    await setDoc(docRef, item, { merge: true });
    return item.id;
  } else {
    const docRef = await addDoc(colRef, item);
    return docRef.id;
  }
};

export const deleteItem = async (shopId: string, itemId: string) => {
  const docRef = doc(db, 'shops', shopId, 'items', itemId);
  await deleteDoc(docRef);
};

// FAQs
export const getFAQs = async (shopId: string): Promise<FAQ[]> => {
  const colRef = collection(db, 'shops', shopId, 'faqs');
  const querySnap = await getDocs(colRef);
  return querySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FAQ));
};

export const saveFAQ = async (shopId: string, faq: Partial<FAQ>) => {
  const colRef = collection(db, 'shops', shopId, 'faqs');
  if (faq.id) {
    const docRef = doc(db, 'shops', shopId, 'faqs', faq.id);
    await setDoc(docRef, faq, { merge: true });
    return faq.id;
  } else {
    const docRef = await addDoc(colRef, faq);
    return docRef.id;
  }
};

export const deleteFAQ = async (shopId: string, faqId: string) => {
  const docRef = doc(db, 'shops', shopId, 'faqs', faqId);
  await deleteDoc(docRef);
};

// Categories
export const getCategories = async (shopId: string): Promise<Category[]> => {
  const colRef = collection(db, 'shops', shopId, 'categories');
  const querySnap = await getDocs(colRef);
  return querySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
};

export const addCategory = async (shopId: string, name: string) => {
  const colRef = collection(db, 'shops', shopId, 'categories');
  const docRef = await addDoc(colRef, { name });
  return docRef.id;
};

export const deleteCategory = async (shopId: string, categoryId: string) => {
  const docRef = doc(db, 'shops', shopId, 'categories', categoryId);
  await deleteDoc(docRef);
};

// Orders
export const getOrders = async (shopId: string): Promise<Order[]> => {
  const colRef = collection(db, 'shops', shopId, 'orders');
  const querySnap = await getDocs(colRef);
  return querySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
};

export const updateOrderStatus = async (shopId: string, orderId: string, status: OrderStatus) => {
  const docRef = doc(db, 'shops', shopId, 'orders', orderId);
  await setDoc(docRef, { status, updatedAt: new Date().toISOString() }, { merge: true });
};

export const getOrder = async (shopId: string, orderId: string): Promise<Order | null> => {
  const docRef = doc(db, 'shops', shopId, 'orders', orderId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? ({ id: docSnap.id, ...docSnap.data() } as Order) : null;
};

// Chat Services
export interface ChatMessage {
  id?: string;
  sender: string;
  message: string;
  timestamp: string;
  senderRole: 'VENDOR' | 'ADMIN';
}

export interface ChatSession {
  id: string;
  shopName: string;
  lastMessage?: string;
  lastTimestamp?: string;
  unreadCount?: number;
}

export const sendMessage = async (shopId: string, message: Omit<ChatMessage, 'id'>) => {
  const colRef = collection(db, 'chats', shopId, 'messages');
  await addDoc(colRef, message);
  
  // Update session summary
  const sessionRef = doc(db, 'chats', shopId);
  await setDoc(sessionRef, {
    lastMessage: message.message,
    lastTimestamp: message.timestamp,
    shopId: shopId,
    updatedAt: message.timestamp
  }, { merge: true });
};

export const subscribeToMessages = (shopId: string, callback: (messages: ChatMessage[]) => void) => {
  const colRef = collection(db, 'chats', shopId, 'messages');
  const q = query(colRef); // You might want to order by timestamp
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
    // Sort by timestamp client-side for simplicity if needed, or use orderBy in query
    callback(messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()));
  });
};

export const subscribeToChatSessions = (callback: (sessions: ChatSession[]) => void) => {
  const colRef = collection(db, 'chats');
  return onSnapshot(colRef, (snapshot) => {
    const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
    callback(sessions);
  });
};
