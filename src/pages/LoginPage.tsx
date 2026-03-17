import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, ShieldCheck, Store } from 'lucide-react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useToast } from '../components/Toast';
import { Loader2, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function LoginPage() {
  const { showToast } = useToast();
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') {
        navigate('/admin');
      } else {
        navigate('/vendor');
      }
    }
  }, [user, navigate]);

  const handleSetupAdmin = async () => {
    setIsSettingUp(true);
    setError('');
    const adminEmail = 'admin@gmail.com';
    const adminPassword = '0xc0d3';

    try {
      let userCredential;
      try {
        userCredential = await createUserWithEmailAndPassword(auth, adminEmail, adminPassword);
        showToast('Super Admin account created!', 'success');
      } catch (err: any) {
        if (err.code === 'auth/email-already-in-use') {
          userCredential = await signInWithEmailAndPassword(auth, adminEmail, adminPassword);
        } else {
          throw err;
        }
      }

      const user = userCredential.user;
      
      // Ensure Firestore document exists
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        await setDoc(userDocRef, {
          email: adminEmail,
          role: 'ADMIN',
          createdAt: new Date().toISOString()
        });
        showToast('Admin profile initialized in Firestore', 'success');
      } else if (userDoc.data().role !== 'ADMIN') {
        await setDoc(userDocRef, { role: 'ADMIN' }, { merge: true });
        showToast('User role upgraded to ADMIN', 'success');
      }

      showToast('Super Admin setup complete', 'success');
    } catch (err: any) {
      console.error('Setup error:', err);
      setError(err.message || 'Failed to setup super admin');
    } finally {
      setIsSettingUp(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // The AuthContext will handle the profile fetching and navigation
      // via the onAuthStateChanged listener.
      // However, we can also navigate here if we want immediate feedback.
      // But it's safer to wait for the listener to confirm the role.
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err.message || 'Invalid credentials');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-zinc-200 overflow-hidden">
        <div className="p-8">
          <div className="flex justify-center mb-8">
            <div className="w-16 h-16 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
              <LogIn className="text-white w-8 h-8" />
            </div>
          </div>
          
          <h2 className="text-2xl font-bold text-center text-zinc-900 mb-2">{t('login.welcome')}</h2>
          <p className="text-zinc-500 text-center mb-8">{t('login.subtitle')}</p>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl mb-6 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">{t('login.email')}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="admin@example.com"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-2">{t('login.password')}</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-zinc-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl shadow-lg shadow-indigo-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isLoading ? t('login.logging_in') : t('login.login_btn')}
            </button>
          </form>

          <div className="mt-8 pt-8 border-t border-zinc-100 grid grid-cols-2 gap-4">
            <button
              onClick={() => {
                setEmail('admin@gmail.com');
                setPassword('0xc0d3');
                setTimeout(() => document.querySelector('form')?.requestSubmit(), 0);
              }}
              className="text-center p-4 rounded-xl hover:bg-zinc-50 transition-all group"
            >
              <div className="flex justify-center mb-2">
                <ShieldCheck className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('login.quick_admin')}</span>
              <p className="text-[10px] text-zinc-500 mt-1">admin@gmail.com</p>
            </button>
            <button
              onClick={() => {
                setEmail('vendor@example.com');
                setPassword('password123');
                setTimeout(() => document.querySelector('form')?.requestSubmit(), 0);
              }}
              className="text-center p-4 rounded-xl hover:bg-zinc-50 transition-all group"
            >
              <div className="flex justify-center mb-2">
                <Store className="w-5 h-5 text-indigo-600 group-hover:scale-110 transition-transform" />
              </div>
              <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">{t('login.quick_vendor')}</span>
              <p className="text-[10px] text-zinc-500 mt-1">vendor@example.com</p>
            </button>
          </div>

          <div className="mt-4">
            <button
              onClick={handleSetupAdmin}
              disabled={isSettingUp}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-all disabled:opacity-50"
            >
              {isSettingUp ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4 text-amber-400" />
              )}
              {t('login.init_admin')}
            </button>
            <p className="text-[10px] text-zinc-400 text-center mt-2">
              {t('login.init_desc')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
