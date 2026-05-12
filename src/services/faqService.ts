import { 
  collection, 
  doc, 
  getDocs, 
  setDoc,
  addDoc,
  deleteDoc,
  query,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FAQ } from '../types';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export const getFAQs = async (shopId: string): Promise<FAQ[]> => {
  if (!shopId) return [];
  try {
    const colRef = collection(db, 'shops', shopId, 'faqs');
    const q = query(colRef, orderBy('question', 'asc'));
    const querySnap = await getDocs(q);
    return querySnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as FAQ));
  } catch(error) {
    handleFirestoreError(error, OperationType.LIST, `shops/${shopId}/faqs`);
    return [];
  }
};

export const saveFAQ = async (shopId: string, faq: Partial<FAQ>) => {
  try {
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
  } catch(error) {
    handleFirestoreError(error, OperationType.WRITE, `shops/${shopId}/faqs`);
    throw error;
  }
};

export const deleteFAQ = async (shopId: string, faqId: string) => {
  try {
    const docRef = doc(db, 'shops', shopId, 'faqs', faqId);
    await deleteDoc(docRef);
  } catch(error) {
    handleFirestoreError(error, OperationType.DELETE, `shops/${shopId}/faqs/${faqId}`);
  }
};
