import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import DashboardLayout from './components/DashboardLayout';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import SupportPage from './pages/SupportPage';
import VendorDashboard from './pages/VendorDashboard';
import ShopsPage from './pages/ShopsPage';
import { ToastProvider } from './components/Toast';

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            
            {/* Admin Routes */}
            <Route 
              path="/admin" 
              element={
                <ProtectedRoute role="ADMIN">
                  <DashboardLayout>
                    <AdminDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/shops" 
              element={
                <ProtectedRoute role="ADMIN">
                  <DashboardLayout>
                    <ShopsPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/admin/support" 
              element={
                <ProtectedRoute role="ADMIN">
                  <DashboardLayout>
                    <SupportPage />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />

            {/* Vendor Routes */}
            <Route 
              path="/vendor/:shopId?" 
              element={
                <ProtectedRoute role="VENDOR">
                  <DashboardLayout>
                    <VendorDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/vendor/:shopId/orders" 
              element={
                <ProtectedRoute role="VENDOR">
                  <DashboardLayout>
                    <VendorDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/vendor/:shopId/inventory" 
              element={
                <ProtectedRoute role="VENDOR">
                  <DashboardLayout>
                    <VendorDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/vendor/:shopId/categories" 
              element={
                <ProtectedRoute role="VENDOR">
                  <DashboardLayout>
                    <VendorDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/vendor/:shopId/analytics" 
              element={
                <ProtectedRoute role="VENDOR">
                  <DashboardLayout>
                    <VendorDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/vendor/:shopId/reviews" 
              element={
                <ProtectedRoute role="VENDOR">
                  <DashboardLayout>
                    <VendorDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/vendor/:shopId/ai-training" 
              element={
                <ProtectedRoute role="VENDOR">
                  <DashboardLayout>
                    <VendorDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />
            <Route 
              path="/vendor/:shopId/settings" 
              element={
                <ProtectedRoute role="VENDOR">
                  <DashboardLayout>
                    <VendorDashboard />
                  </DashboardLayout>
                </ProtectedRoute>
              } 
            />

            {/* Default Redirects */}
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ToastProvider>
  );
}
