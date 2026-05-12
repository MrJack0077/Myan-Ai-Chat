import { 
  collection, 
  doc, 
  query, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  setDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

export interface ChatMessage {
  id: string;
  sender: string;
  text: string;
  timestamp: string;
  senderRole: 'VENDOR' | 'ADMIN';
  isRead: boolean;
}

export interface ChatSession {
  id: string;
  shopId: string;
  lastMessage: string;
  lastTimestamp: string;
  unreadCount: number;
}

export const subscribeToMessages = (room: string, callback: (messages: ChatMessage[]) => void) => {
  const path = `support_chats/${room}/messages`;
  try {
    const q = query(collection(db, path), orderBy('timestamp', 'asc'));
    return onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        timestamp: doc.data().timestamp?.toDate().toISOString() || new Date().toISOString()
      })) as ChatMessage[];
      callback(messages);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return () => {};
  }
};

export const sendMessage = async (room: string, message: Omit<ChatMessage, 'id' | 'isRead' | 'timestamp'>) => {
  const path = `support_chats/${room}/messages`;
  try {
    // Add the message
    await addDoc(collection(db, path), {
      ...message,
      isRead: false,
      timestamp: serverTimestamp()
    });

    // Update the session
    const sessionRef = doc(db, 'support_sessions', room);
    await setDoc(sessionRef, {
      shopId: room,
      lastMessage: message.text,
      lastTimestamp: serverTimestamp(),
      unreadCount: message.senderRole === 'VENDOR' ? 1 : 0 // Admin will read it
    }, { merge: true });

  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
};

export const subscribeToChatSessions = (callback: (sessions: ChatSession[]) => void) => {
  const path = 'support_sessions';
  try {
    const q = query(collection(db, path), orderBy('lastTimestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const sessions = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        lastTimestamp: doc.data().lastTimestamp?.toDate().toISOString() || new Date().toISOString()
      })) as ChatSession[];
      callback(sessions);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
    return () => {};
  }
};
