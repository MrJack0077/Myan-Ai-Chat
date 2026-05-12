import React, { createContext, useContext, useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  User as FirebaseUser 
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';

interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'VENDOR';
  shopId?: string;
  shop?: any;
}

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          // Fetch user profile/shop from Firestore
          const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            let shopData = null;
            if (userData.shopId) {
              const shopDoc = await getDoc(doc(db, 'shops', userData.shopId));
              shopData = shopDoc.exists() ? { id: shopDoc.id, ...shopDoc.data() } : null;
            }
            
            setUser({
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              role: userData.role || 'VENDOR',
              shopId: userData.shopId,
              shop: shopData
            });
          } else {
            // Fallback to localStorage for demo purposes if Firestore user doesn't exist yet
            const savedUser = localStorage.getItem('user');
            if (savedUser) {
              try {
                setUser(JSON.parse(savedUser));
              } catch (e) {
                console.error('Failed to parse saved user', e);
                setUser(null);
              }
            }
          }
        } else {
          setUser(null);
        }
      } catch (error: any) {
        console.error('Auth state change error:', error);
        if (error.code || error.message?.includes('offline') || error.message?.includes('permission')) {
          try {
            handleFirestoreError(error, OperationType.GET, firebaseUser ? `users/${firebaseUser.uid}` : 'users');
          } catch (e) {
            // Already logged by handleFirestoreError
          }
        }
        // On error, try to use saved session if available
        const savedUser = localStorage.getItem('user');
        if (savedUser) {
          try {
            setUser(JSON.parse(savedUser));
          } catch (e) {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const login = (userData: User) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
  };

  const logout = () => {
    auth.signOut();
    setUser(null);
    localStorage.removeItem('user');
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
