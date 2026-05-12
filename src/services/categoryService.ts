import { 
  collection, 
  doc, 
  getDocs, 
  addDoc,
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Category } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export const getCategories = async (shopId: string): Promise<Category[]> => {
  if (!shopId) return [];
  try {
    const colRef = collection(db, 'shops', shopId, 'categories');
    const q = query(colRef, orderBy('name', 'asc'));
    const querySnap = await getDocs(q);
    return querySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category));
  } catch(error) {
    handleFirestoreError(error, OperationType.LIST, `shops/${shopId}/categories`);
    return [];
  }
};

export const addCategory = async (shopId: string, name: string) => {
  try {
    const colRef = collection(db, 'shops', shopId, 'categories');
    const docRef = await addDoc(colRef, { name });
    return docRef.id;
  } catch(error) {
    handleFirestoreError(error, OperationType.WRITE, `shops/${shopId}/categories`);
    throw error;
  }
};

export const deleteCategory = async (shopId: string, categoryId: string) => {
  try {
    const docRef = doc(db, 'shops', shopId, 'categories', categoryId);
    await deleteDoc(docRef);
  } catch(error) {
    handleFirestoreError(error, OperationType.DELETE, `shops/${shopId}/categories/${categoryId}`);
  }
};
