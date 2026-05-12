import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  role?: 'ADMIN' | 'VENDOR';
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (role && user.role !== role) {
    // Allow ADMIN to access VENDOR routes for management purposes
    if (user.role === 'ADMIN' && role === 'VENDOR') {
      return <>{children}</>;
    }
    return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/vendor'} replace />;
  }

  return <>{children}</>;
}
