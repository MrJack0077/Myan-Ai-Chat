import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  addDoc,
  deleteDoc,
  onSnapshot,
  vector,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { VendorItem } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { clearShopCache, generateEmbedding } from './shopService'; // Will break shopService out next

export const getItems = async (shopId: string): Promise<VendorItem[]> => {
  if (!shopId) {
    console.error('[inventoryService] No shopId provided');
    return [];
  }
  
  const path = `shops/${shopId}/items`;
  try {
    const colRef = collection(db, 'shops', shopId, 'items');
    const querySnap = await getDocs(colRef);
    const items = querySnap.docs.map(doc => {
      const data = doc.data();
      return { 
        id: doc.id, 
        name: data.name || doc.id.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase()),
        item_type: data.item_type || 'product',
        status: data.status || 'active',
        price: data.price || 0,
        stock_quantity: data.stock_quantity || 0,
        is_available: data.is_available !== undefined ? data.is_available : true,
        category: data.category || 'General',
        ...data 
      } as VendorItem;
    });

    return items.sort((a, b) => {
      if (a.sort_order !== undefined && b.sort_order !== undefined) return a.sort_order - b.sort_order;
      if (a.sort_order !== undefined) return -1;
      if (b.sort_order !== undefined) return 1;
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return [];
  }
};

export const saveItem = async (shopId: string, item: Partial<VendorItem>, skipCacheClear: boolean = false): Promise<string> => {
  const shopDoc = await getDoc(doc(db, 'shops', shopId));
  const shopCurrency = shopDoc.exists() ? (shopDoc.data().currency || 'MMK') : 'MMK';

  const status = (item.is_available && (item.stock_quantity || 0) > 0) ? "Available" : "Out of Stock";
  const textToEmbed = `
    Product: ${item.name || ''}
    Brand: ${item.brand || ''}
    Category: ${item.category || ''}
    Price: ${item.price || 0} ${shopCurrency}
    Status: ${status}
    Description: ${item.description || ''}
    Specifications: ${item.specifications || ''}
    Marketing/AI Description: ${item.ai_custom_description || ''}
    Keywords: ${item.ai_keywords || ''}
    Usage Instructions: ${item.usage_instructions || ''}
    Target Audience: ${item.target_audience || ''}
  `.trim();

  let embedding: number[] | undefined = undefined;
  
  try {
    if (textToEmbed.length > 5) {
      embedding = await generateEmbedding(textToEmbed);
    }
  } catch (error) {
    console.error('Failed to generate embedding for item:', error);
    embedding = item.embedding && item.embedding.length > 0 ? item.embedding : undefined;
  }

  const itemId = item.id || (item.name ? item.name.toLowerCase().replace(/[\\s]+/g, '_').replace(/[^a-z0-9_]/g, '').substring(0, 50) : Math.random().toString(36).substring(7));
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

  try {
    await setDoc(docRef, finalItem, { merge: true });
    if (!skipCacheClear) {
      await clearShopCache(shopId, finalItem.name).catch(err => console.error('Failed to clear cache:', err));
    }
    return itemId;
  } catch(error) {
    handleFirestoreError(error, OperationType.WRITE, `shops/${shopId}/items/${itemId}`);
    throw error;
  }
};

export const deleteItem = async (shopId: string, itemId: string): Promise<void> => {
  const path = `shops/${shopId}/items/${itemId}`;
  try {
    const docRef = doc(db, 'shops', shopId, 'items', itemId);
    const docSnap = await getDoc(docRef);
    let itemName = '';
    if (docSnap.exists()) {
      itemName = docSnap.data().name || '';
    }
    await deleteDoc(docRef);
    await clearShopCache(shopId, itemName).catch(err => console.error('Failed to clear cache:', err));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
    throw error;
  }
};

export const subscribeToItems = (shopId: string, callback: (items: VendorItem[]) => void) => {
  const colRef = collection(db, 'shops', shopId, 'items');
  return onSnapshot(colRef, (snapshot) => {
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VendorItem));
    callback(items);
  }, (error) => {
    handleFirestoreError(error, OperationType.LIST, `shops/${shopId}/items`);
  });
};

export const bulkSaveItems = async (shopId: string, items: Partial<VendorItem>[]) => {
  const results = [];
  for (const item of items) {
    const preparedItem: Partial<VendorItem> = {
      item_type: 'product',
      status: 'active',
      stock_type: 'status',
      is_available: true,
      ...item
    };
    const id = await saveItem(shopId, preparedItem, true);
    await new Promise(r => setTimeout(r, 2000));
    results.push(id);
  }
  return results;
};

export const reindexShopInventory = async (shopId: string) => {
  try {
    const items = await getItems(shopId);
    for (const item of items) {
      await saveItem(shopId, item, true);
    }
  } catch (error) {
    console.error('Failed to reindex inventory:', error);
  }
};

