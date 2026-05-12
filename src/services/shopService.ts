import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  query, 
  orderBy,
  updateDoc,
  deleteDoc,
  writeBatch,
  deleteField,
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { db } from '../lib/firebase';
import { Shop, ShopAIConfig } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import firebaseConfig from '../../firebase-applet-config.json';
import { GoogleGenAI } from "@google/genai";
import { reindexShopInventory } from './inventoryService'; // We will create this

const secondaryApp = initializeApp(firebaseConfig, 'SecondaryApp');
const secondaryAuth = getAuth(secondaryApp);

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
    const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
    const user = userCredential.user;

    const userDocRef = doc(db, 'users', user.uid);
    await setDoc(userDocRef, {
      email,
      role: 'VENDOR',
      shopId,
      createdAt: new Date().toISOString()
    });

    await signOut(secondaryAuth);
    return user.uid;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'users');
    throw error;
  }
};

export const clearShopCache = async (shopId: string, specificKeyword?: string) => {
  try {
    const cacheCollectionRef = collection(db, 'shops', shopId, 'semantic_cache');
    const cacheSnapshot = await getDocs(cacheCollectionRef);
    
    if (!cacheSnapshot.empty) {
      let docsToDelete = cacheSnapshot.docs;
      if (specificKeyword) {
        const keyword = specificKeyword.toLowerCase();
        docsToDelete = docsToDelete.filter(doc => {
          const data = doc.data();
          const q = (data.query || '').toLowerCase();
          const r = (data.reply || '').toLowerCase();
          return q.includes(keyword) || r.includes(keyword);
        });
      }

      if (docsToDelete.length > 0) {
        for (let i = 0; i < docsToDelete.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = docsToDelete.slice(i, i + 500);
          chunk.forEach((docSnap) => batch.delete(docSnap.ref));
          await batch.commit();
        }
      }
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `shops/${shopId}/semantic_cache`);
  }

  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'https://admin.myansocial.shop';
    await fetch(`${apiUrl}/api/clear-cache/${shopId}?t=${Date.now()}`, {
      method: 'GET',
      mode: 'no-cors'
    });
  } catch (error) {
    console.error(`[clearShopCache] Error triggering external API cache clear for ${shopId}:`, error);
  }
};

export const saveShop = async (shop: Partial<Shop> & { vendorCredentials?: { email: string, password?: string } }) => {
  const path = shop.id ? `shops/${shop.id}` : 'shops';
  try {
    const cleanedShop = Object.entries(shop).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key as keyof typeof shop] = value;
      } else if (shop.id) {
        acc[key as keyof typeof shop] = deleteField() as any;
      }
      return acc;
    }, {} as any);

    if (shop.id) {
      const docRef = doc(db, 'shops', shop.id);
      await setDoc(docRef, cleanedShop, { merge: true });
      await clearShopCache(shop.id);
      return shop.id;
    } else {
      const colRef = collection(db, 'shops');
      // For addDoc we can't easily use addDoc with returned ref if using id? Wait, we can just use setDoc with a random ID or addDoc. Let's just use addDoc? But `addDoc` is imported, wait, let's use `doc(collection(db, 'shops'))` instead.
      const newDocRef = doc(collection(db, 'shops'));
      await setDoc(newDocRef, {
        ...cleanedShop,
        createdAt: new Date().toISOString(),
        status: shop.status || 'active',
        size: 0
      });
      return newDocRef.id;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
    throw error;
  }
};

export const deleteShop = async (shopId: string) => {
  const path = `shops/${shopId}`;
  try {
    const docRef = doc(db, 'shops', shopId);
    await deleteDoc(docRef);
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
};

export const updateShopSettings = async (shopId: string, updatedData: Record<string, any>): Promise<{ success: boolean; error?: string }> => {
  try {
    const shopRef = doc(db, 'shops', shopId);
    const shopDoc = await getDoc(shopRef);
    const oldCurrency = shopDoc.exists() ? shopDoc.data().currency : undefined;

    await updateDoc(shopRef, updatedData);
    await clearShopCache(shopId);

    if (updatedData.currency && updatedData.currency !== oldCurrency) {
      reindexShopInventory(shopId).catch(err => console.error('Failed to reindex inventory:', err));
    }

    return { success: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `shops/${shopId}`);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
};

export const updateShopAIConfig = async (shopId: string, config: ShopAIConfig) => {
  const docRef = doc(db, 'shops', shopId);
  try {
    await setDoc(docRef, { aiConfig: config }, { merge: true });
    await clearShopCache(shopId);
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `shops/${shopId}`);
  }
};

export const generateEmbedding = async (text: string, retries = 5, delay = 5000): Promise<number[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const result = await ai.models.embedContent({
      model: 'gemini-embedding-2-preview',
      contents: [text],
      config: { outputDimensionality: 768 }
    });

    if (!result.embeddings || result.embeddings.length === 0) throw new Error('Failed to generate embedding');
    let embeddingArray = result.embeddings[0].values;
    if (!embeddingArray) throw new Error('Embedding values are undefined');
    if (embeddingArray.length > 768) embeddingArray = embeddingArray.slice(0, 768);

    return embeddingArray;
  } catch (error: any) {
    const errorStr = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
    if (retries > 0 && (errorStr.includes('Quota exceeded') || errorStr.includes('429') || error?.status === 429)) {
      await new Promise(resolve => setTimeout(resolve, delay));
      return generateEmbedding(text, retries - 1, delay * 2);
    }
    throw error;
  }
};
