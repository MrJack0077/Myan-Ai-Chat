import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import { NotificationProvider } from './contexts/NotificationContext';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import VendorDashboard from './pages/VendorDashboard';
import ShopsPage from './pages/ShopsPage';
import SupportPage from './pages/SupportPage';
import OrderTracking from './pages/OrderTracking';
import DashboardLayout from './components/DashboardLayout';
import './i18n';

function PrivateRoute({ children, allowedRoles }: { children: React.ReactNode, allowedRoles?: ('ADMIN' | 'VENDOR')[] }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="w-10 h-10 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role as any)) {
    return <Navigate to="/" />;
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
      
      <Route path="/" element={
        <PrivateRoute>
          {user?.role === 'ADMIN' ? <Navigate to="/admin" /> : <Navigate to="/vendor" />}
        </PrivateRoute>
      } />

      <Route path="/admin/*" element={
        <PrivateRoute allowedRoles={['ADMIN']}>
          <Routes>
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/shops" element={<ShopsPage />} />
            <Route path="/support" element={<SupportPage />} />
          </Routes>
        </PrivateRoute>
      } />

      <Route path="/vendor/*" element={
        <PrivateRoute allowedRoles={['ADMIN', 'VENDOR']}>
          <Routes>
            <Route path="/" element={<VendorDashboard />} />
            <Route path="/:shopId/*" element={<VendorDashboard />} />
          </Routes>
        </PrivateRoute>
      } />

      <Route path="/track/:shopId/:orderId" element={<OrderTracking />} />
      
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <ToastProvider>
          <NotificationProvider>
            <div className="min-h-screen bg-zinc-50">
              <AppRoutes />
            </div>
          </NotificationProvider>
        </ToastProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
