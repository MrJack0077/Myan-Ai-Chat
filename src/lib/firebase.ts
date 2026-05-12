import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, initializeFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

const firestoreDbId = (firebaseConfig as any).firestoreDatabaseId;
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true
}, firestoreDbId && firestoreDbId !== '(default)' ? firestoreDbId : undefined);

export const storage = getStorage(app);

export default app;
