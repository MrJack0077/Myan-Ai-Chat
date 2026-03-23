import { initializeApp } from 'firebase/app';
import { GoogleGenAI } from "@google/genai";
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
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
  onSnapshot,
  orderBy,
  updateDoc,
  writeBatch,
  vector
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Shop, VendorItem, FAQ, ShopAIConfig, Category, Order, OrderStatus, OrderItem, PaymentStatus } from '../types';

// Secondary Firebase App for creating users without affecting admin session
const secondaryFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

const secondaryApp = initializeApp(secondaryFirebaseConfig, 'SecondaryApp');
const secondaryAuth = getAuth(secondaryApp);

// Bot User Types
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

// Shops
export const getShop = async (shopId: string): Promise<Shop | null> => {
  const path = `shops/${shopId}`;
  try {
    const docRef = doc(db, 'shops', shopId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? (docSnap.data() as Shop) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
    return null;
  }
};

export const getAllShops = async (): Promise<Shop[]> => {
  const path = 'shops';
  try {
    const colRef = collection(db, 'shops');
    const q = query(colRef, orderBy('createdAt', 'desc'));
    const querySnap = await getDocs(q);
    return querySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
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
  const path = shop.id ? `shops/${shop.id}` : 'shops';
  try {
    const colRef = collection(db, 'shops');
    if (shop.id) {
      const docRef = doc(db, 'shops', shop.id);
      await setDoc(docRef, shop, { merge: true });
      await clearShopCache(shop.id);
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
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
};

export const deleteShop = async (shopId: string) => {
  const docRef = doc(db, 'shops', shopId);
  await deleteDoc(docRef);
};

/**
 * Clears both the Firestore semantic_cache subcollection and the external API cache for a shop.
 * Call this whenever shop data (products, services, settings, AI config, etc.) is updated.
 */
export const clearShopCache = async (shopId: string) => {
  try {
    console.log(`[clearShopCache] Starting cache clear for shop: ${shopId}`);
    
    // 1. Clear semantic_cache subcollection
    const cacheCollectionRef = collection(db, 'shops', shopId, 'semantic_cache');
    const cacheSnapshot = await getDocs(cacheCollectionRef);
    
    if (!cacheSnapshot.empty) {
      const batch = writeBatch(db);
      cacheSnapshot.forEach((docSnap) => {
        batch.delete(docSnap.ref);
      });
      await batch.commit();
      console.log(`[clearShopCache] Deleted ${cacheSnapshot.size} documents from semantic_cache`);
    }

    // 2. Call external API to clear backend cache
    await fetch(`https://allchat.ddnsfree.com/api/clear-cache/${shopId}`, {
      method: 'GET',
      mode: 'no-cors'
    });
    console.log(`[clearShopCache] External API cache clear triggered for ${shopId}`);
  } catch (error) {
    console.error(`[clearShopCache] Error clearing cache for ${shopId}:`, error);
  }
};

/**
 * Updates specific configuration fields in a shop document and clears its semantic cache.
 * This is useful when shop policies, delivery info, or payment methods change,
 * requiring the AI to fetch fresh data instead of using stale cached responses.
 * 
 * @param shopId The ID of the shop to update.
 * @param updatedData An object containing the fields to update.
 * @returns An object indicating success or failure.
 */
export const updateShopSettings = async (
  shopId: string,
  updatedData: Record<string, any>
): Promise<{ success: boolean; error?: string }> => {
  try {
    console.log(`[updateShopSettings] Starting update for shop: ${shopId}`);

    const shopRef = doc(db, 'shops', shopId);
    
    // Check old currency before updating
    const shopDoc = await getDoc(shopRef);
    const oldCurrency = shopDoc.exists() ? shopDoc.data().currency : undefined;

    // Step 1: Update the main shop document with the new settings
    await updateDoc(shopRef, updatedData);
    console.log(`[updateShopSettings] Successfully updated shop document for ${shopId}`);

    // Step 2: If currency changed, reindex inventory in the background so AI embeddings use the new currency
    if (updatedData.currency && updatedData.currency !== oldCurrency) {
      console.log(`[updateShopSettings] Currency changed from ${oldCurrency} to ${updatedData.currency}. Reindexing inventory...`);
      reindexShopInventory(shopId).catch(err => console.error('Failed to reindex inventory after currency change:', err));
    }

    return { success: true };
  } catch (error) {
    // Step 5: Error handling with clear console messages
    console.error(`[updateShopSettings] Error updating shop settings for ${shopId}:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
};

export const updateShopAIConfig = async (shopId: string, config: ShopAIConfig) => {
  const docRef = doc(db, 'shops', shopId);
  await setDoc(docRef, { aiConfig: config }, { merge: true });
};

// Helper for generating document IDs from names
const generateSlug = (text: string) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '_')
    .replace(/^-+|-+$/g, '');
};

// Items (AI-Optimized)
export const getItems = async (shopId: string): Promise<VendorItem[]> => {
  if (!shopId) return [];
  const colRef = collection(db, 'shops', shopId, 'items');
  const querySnap = await getDocs(colRef);
  const items = querySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorItem));
  
  // Sort in memory to handle missing created_at fields safely
  return items.sort((a, b) => {
    if (a.sort_order !== undefined && b.sort_order !== undefined) {
      return a.sort_order - b.sort_order;
    }
    if (a.sort_order !== undefined) return -1;
    if (b.sort_order !== undefined) return 1;

    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });
};

export const saveItem = async (shopId: string, item: Partial<VendorItem>, skipCacheClear: boolean = false) => {
  // Fetch shop to get currency
  const shopDoc = await getDoc(doc(db, 'shops', shopId));
  const shopCurrency = shopDoc.exists() ? (shopDoc.data().currency || 'MMK') : 'MMK';

  // Prepare item data for embedding
  const status = (item.is_available && (item.stock_quantity || 0) > 0) ? "Available" : "Out of Stock";
  const textToEmbed = `Product: ${item.name || ''}. Price: ${item.price || 0} ${shopCurrency}. Status: ${status}. Description: ${item.description || ''}.`.trim();

  let embedding: number[] | undefined = item.embedding && item.embedding.length > 0 ? item.embedding : undefined;
  
  try {
    if (!embedding && textToEmbed.length > 5) {
      embedding = await generateEmbedding(textToEmbed);
    }
  } catch (error) {
    console.error('Failed to generate embedding for item:', error);
  }

  // Determine the document ID
  const itemId = item.id || (item.name ? generateSlug(item.name) : Math.random().toString(36).substring(7));
  const docRef = doc(db, 'shops', shopId, 'items', itemId);

  const finalItem = { 
    ...item,
    id: itemId,
    updated_at: new Date().toISOString(),
    ...(embedding ? { embedding: vector(embedding) } : {})
  };

  if (!item.id) {
    (finalItem as any).created_at = new Date().toISOString();
    (finalItem as any).status = item.status || 'active';
  }

  await setDoc(docRef, finalItem, { merge: true });

  return itemId;
};

// RAG & Embedding Services
export const generateEmbedding = async (text: string): Promise<number[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const result = await ai.models.embedContent({
    model: 'gemini-embedding-2-preview',
    contents: [text],
    config: {
      outputDimensionality: 768
    }
  });
  
  if (!result.embeddings || result.embeddings.length === 0) {
    throw new Error('Failed to generate embedding');
  }
  
  let embeddingArray = result.embeddings[0].values;
  
  if (!embeddingArray) {
    throw new Error('Embedding values are undefined');
  }
  
  // Ensure it doesn't exceed 768 dimensions as a safety measure
  if (embeddingArray.length > 768) {
    embeddingArray = embeddingArray.slice(0, 768);
  }
  
  return embeddingArray;
};

export const updateItemEmbedding = async (shopId: string, itemId: string) => {
  const shopDoc = await getDoc(doc(db, 'shops', shopId));
  const shopCurrency = shopDoc.exists() ? (shopDoc.data().currency || 'MMK') : 'MMK';

  const itemDoc = await getDoc(doc(db, 'shops', shopId, 'items', itemId));
  if (!itemDoc.exists()) return;

  const item = itemDoc.data() as VendorItem;
  const textToEmbed = `
    Item Name: ${item.name}
    Category: ${item.category}
    Price: ${item.price} ${shopCurrency}
    Description: ${item.description || ''}
    Specs: ${item.specifications || ''}
    AI Description: ${item.ai_custom_description || ''}
    Keywords: ${item.ai_keywords || ''}
  `.trim();

  const embedding = await generateEmbedding(textToEmbed);
  await updateDoc(doc(db, 'shops', shopId, 'items', itemId), {
    embedding,
    updated_at: new Date().toISOString()
  });
};

/**
 * Performs a semantic search for items.
 */
export const searchInventoryRAG = async (shopId: string, query: string, limitCount: number = 5): Promise<VendorItem[]> => {
  try {
    const queryEmbedding = await generateEmbedding(query);
    const items = await getItems(shopId);
    
    // Simple cosine similarity calculation
    const scoredItems = items
      .filter(item => item.embedding && item.status === 'active')
      .map(item => {
        const similarity = dotProduct(queryEmbedding, item.embedding!) / 
                          (magnitude(queryEmbedding) * magnitude(item.embedding!));
        return { ...item, similarity };
      });

    return scoredItems
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limitCount);
  } catch (error) {
    console.error('RAG Search failed:', error);
    return [];
  }
};

// Helper functions for vector math
const dotProduct = (a: number[], b: number[]) => a.reduce((sum, val, i) => sum + val * b[i], 0);
const magnitude = (a: number[]) => Math.sqrt(a.reduce((sum, val) => sum + val * val, 0));

export const reindexShopInventory = async (shopId: string) => {
  const items = await getItems(shopId);
  for (const item of items) {
    await saveItem(shopId, item, true);
  }
};

export const deleteItem = async (shopId: string, itemId: string) => {
  const path = `shops/${shopId}/items/${itemId}`;
  try {
    const docRef = doc(db, 'shops', shopId, 'items', itemId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const subscribeToItems = (shopId: string, callback: (items: VendorItem[]) => void) => {
  const colRef = collection(db, 'shops', shopId, 'items');
  return onSnapshot(colRef, (snapshot) => {
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorItem));
    callback(items);
  });
};

export const bulkSaveItems = async (shopId: string, items: Partial<VendorItem>[]) => {
  const results = [];
  for (const item of items) {
    // Ensure default values for required fields if missing
    const preparedItem: Partial<VendorItem> = {
      item_type: 'product',
      status: 'active',
      stock_type: 'status',
      is_available: true,
      ...item
    };
    const id = await saveItem(shopId, preparedItem, true); // Skip cache clear per item
    results.push(id);
  }
  return results;
};

// FAQs
export const getFAQs = async (shopId: string): Promise<FAQ[]> => {
  if (!shopId) return [];
  const colRef = collection(db, 'shops', shopId, 'faqs');
  const q = query(colRef, orderBy('question', 'asc'));
  const querySnap = await getDocs(q);
  return querySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FAQ));
};

export const saveFAQ = async (shopId: string, faq: Partial<FAQ>) => {
  const colRef = collection(db, 'shops', shopId, 'faqs');
  let id = faq.id;
  if (id) {
    const docRef = doc(db, 'shops', shopId, 'faqs', id);
    await setDoc(docRef, faq, { merge: true });
  } else {
    const docRef = await addDoc(colRef, faq);
    id = docRef.id;
  }
  return id;
};

export const deleteFAQ = async (shopId: string, faqId: string) => {
  const docRef = doc(db, 'shops', shopId, 'faqs', faqId);
  await deleteDoc(docRef);
};

// Categories
export const getCategories = async (shopId: string): Promise<Category[]> => {
  if (!shopId) return [];
  const colRef = collection(db, 'shops', shopId, 'categories');
  const q = query(colRef, orderBy('name', 'asc'));
  const querySnap = await getDocs(q);
  return querySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
};

export const addCategory = async (shopId: string, name: string) => {
  const colRef = collection(db, 'shops', shopId, 'categories');
  const docRef = await addDoc(colRef, { name });
  return docRef.id;
};

export const deleteCategory = async (shopId: string, categoryId: string) => {
  const path = `shops/${shopId}/categories/${categoryId}`;
  try {
    const docRef = doc(db, 'shops', shopId, 'categories', categoryId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

// Orders
export const getOrders = async (shopId: string): Promise<Order[]> => {
  if (!shopId) return [];
  
  // Try subcollection first
  const subColRef = collection(db, 'shops', shopId, 'orders');
  const subSnap = await getDocs(subColRef);
  
  let ordersData = subSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  
  // If subcollection is empty, try root collection with shopId filter
  if (ordersData.length === 0) {
    const rootColRef = collection(db, 'orders');
    const q = query(rootColRef, where('shopId', '==', shopId));
    const rootSnap = await getDocs(q);
    ordersData = rootSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // If still empty, maybe the user has a single shop setup or uses a different field
    if (ordersData.length === 0) {
      const allRootSnap = await getDocs(rootColRef);
      // Fallback: if no shopId field exists, and it's a small collection, maybe they are all for this shop
      // or we just show them if they match the user's data structure
      ordersData = allRootSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((data: any) => !data.shopId || data.shopId === shopId);
    }
  }

  const orders = ordersData.map((data: any) => {
    // Normalize items if they are strings instead of objects
    const normalizedItems = (data.items || []).map((item: any) => {
      if (typeof item === 'string') {
        return {
          id: Math.random().toString(36).substr(2, 9),
          itemId: 'manual',
          name: item,
          price: 0,
          quantity: 1
        };
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
      // Normalize date fields
      createdAt: data.createdAt || data.created_at || new Date().toISOString(),
      updatedAt: data.updatedAt || data.updated_at || data.createdAt || data.created_at || new Date().toISOString()
    } as Order;
  });

  // Sort in memory to handle different field names safely
  return orders.sort((a, b) => {
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
};

export const createOrder = async (shopId: string, order: Omit<Order, 'id'>) => {
  const colRef = collection(db, 'shops', shopId, 'orders');
  
  // Sanitize order to remove undefined values which Firestore doesn't support
  const sanitizedOrder = JSON.parse(JSON.stringify(order));

  const now = new Date().toISOString();
  const orderData = {
    ...sanitizedOrder,
    shopId,
    // Include both camelCase and snake_case for compatibility
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
};

export const updateOrderStatus = async (shopId: string, orderId: string, status: OrderStatus) => {
  const docRef = doc(db, 'shops', shopId, 'orders', orderId);
  
  // If status is moving to 'processing', deduct stock
  if (status === 'processing') {
    const orderSnap = await getDoc(docRef);
    if (orderSnap.exists()) {
      const orderData = orderSnap.data() as Order;
      let stockUpdated = false;
      for (const item of orderData.items) {
        if (item.itemId && item.itemId !== 'bot-generated') {
          const itemRef = doc(db, 'shops', shopId, 'items', item.itemId);
          const itemSnap = await getDoc(itemRef);
          if (itemSnap.exists()) {
            const itemData = itemSnap.data() as VendorItem;
            const currentStock = itemData.stock_quantity || 0;
            const newStock = Math.max(0, currentStock - item.quantity);
            
            // Use saveItem to ensure embeddings are updated
            await saveItem(shopId, { ...itemData, stock_quantity: newStock }, true);
            stockUpdated = true;
          }
        }
      }
    }
  }

  await setDoc(docRef, { status, updatedAt: new Date().toISOString() }, { merge: true });
};

export const updateOrderPaymentStatus = async (shopId: string, orderId: string, paymentStatus: PaymentStatus) => {
  const docRef = doc(db, 'shops', shopId, 'orders', orderId);
  await setDoc(docRef, { paymentStatus, updatedAt: new Date().toISOString() }, { merge: true });
};

export const getCustomerOrderHistory = async (shopId: string, customerPhone: string): Promise<Order[]> => {
  const colRef = collection(db, 'shops', shopId, 'orders');
  const q = query(colRef, where('customerPhone', '==', customerPhone));
  const snap = await getDocs(q);
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
};

export const subscribeToOrders = (shopId: string, callback: (orders: Order[]) => void) => {
  const subColRef = collection(db, 'shops', shopId, 'orders');
  const rootColRef = collection(db, 'orders');
  
  // Create a combined listener logic
  const handleSnapshot = (snapshot: any, isRoot: boolean) => {
    const orders = snapshot.docs.map((doc: any) => {
      const data = doc.data();
      // Normalize items if they are strings instead of objects
      const normalizedItems = (data.items || []).map((item: any) => {
        if (typeof item === 'string') {
          return {
            id: Math.random().toString(36).substr(2, 9),
            itemId: 'manual',
            name: item,
            price: 0,
            quantity: 1
          };
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

    // Filter root orders by shopId
    const filteredOrders = isRoot 
      ? orders.filter((o: any) => !o.shopId || o.shopId === shopId)
      : orders;
    
    return filteredOrders;
  };

  // We'll listen to both and merge, or just one if the other is empty?
  // For simplicity and real-time feel, let's listen to both and merge in the callback
  let subOrders: Order[] = [];
  let rootOrders: Order[] = [];

  const unsubSub = onSnapshot(subColRef, (snapshot) => {
    subOrders = handleSnapshot(snapshot, false);
    const merged = [...subOrders, ...rootOrders].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    callback(merged);
  });

  const unsubRoot = onSnapshot(rootColRef, (snapshot) => {
    rootOrders = handleSnapshot(snapshot, true);
    const merged = [...subOrders, ...rootOrders].sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    callback(merged);
  });

  return () => {
    unsubSub();
    unsubRoot();
  };
};

export const getOrder = async (shopId: string, orderId: string): Promise<Order | null> => {
  const docRef = doc(db, 'shops', shopId, 'orders', orderId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return null;
  
  const data = docSnap.data();
  // Normalize items if they are strings instead of objects
  const normalizedItems = (data.items || []).map((item: any) => {
    if (typeof item === 'string') {
      return {
        id: Math.random().toString(36).substr(2, 9),
        itemId: 'manual',
        name: item,
        price: 0,
        quantity: 1
      };
    }
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
};

// Bot User Management
export const getBotUser = async (userId: string): Promise<BotUser | null> => {
  const docRef = doc(db, 'bot_users', userId);
  const docSnap = await getDoc(docRef);
  return docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } as BotUser : null;
};

export const updateBotUser = async (userId: string, data: Partial<Omit<BotUser, 'id'>>) => {
  const docRef = doc(db, 'bot_users', userId);
  await setDoc(docRef, { ...data, last_updated: new Date().toISOString() }, { merge: true });
};

export const subscribeToBotUsers = (callback: (users: BotUser[]) => void) => {
  const colRef = collection(db, 'bot_users');
  const q = query(colRef, orderBy('last_updated', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BotUser));
    callback(users);
  });
};

export const getBotUsers = async (shopId: string): Promise<BotUser[]> => {
  try {
    const colRef = collection(db, 'bot_users');
    // We try to fetch all and filter by shopId if it exists in the document
    // In a real app, you'd want a proper shopId field on bot_users
    const snap = await getDocs(colRef);
    return snap.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as BotUser))
      .filter(user => (user as any).shopId === shopId || user.id.startsWith(shopId));
  } catch (error) {
    console.error('Failed to fetch bot users:', error);
    return [];
  }
};

export const finalizeBotOrder = async (shopId: string, userId: string) => {
  const botUser = await getBotUser(userId);
  if (!botUser) throw new Error('Bot user not found');

  // Map bot items to OrderItems (simplified mapping)
  const orderItems: OrderItem[] = botUser.items.map((itemName, index) => ({
    id: `bot-item-${index}-${Date.now()}`,
    itemId: 'bot-generated', // In a real app, you'd look up the actual item ID
    name: itemName,
    price: botUser.total_price / botUser.items.length, // Simplified price distribution
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
    paymentMethod: botUser.payment_method || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: botUser.summary || ''
  };

  // Create the real order
  const orderId = await createOrder(shopId, orderData);

  // Reset bot user state
  await updateBotUser(userId, {
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
  const q = query(colRef, orderBy('timestamp', 'asc'));
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
    callback(messages);
  });
};

export const subscribeToChatSessions = (callback: (sessions: ChatSession[]) => void) => {
  const colRef = collection(db, 'chats');
  const q = query(colRef, orderBy('updatedAt', 'desc'));
  return onSnapshot(q, (snapshot) => {
    const sessions = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatSession));
    callback(sessions);
  });
};
