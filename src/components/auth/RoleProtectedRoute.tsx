import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import { LoadingScreen } from '../common/LoadingScreen';

interface RoleProtectedRouteProps {
  allowedRoles: ('ADMIN' | 'SUPERVISOR' | 'PAYROLL_ADMIN' | 'SUPER_ADMIN' | 'EMPLOYEE')[];
}

export const RoleProtectedRoute: React.FC<RoleProtectedRouteProps> = ({ allowedRoles }) => {
  const { user, isAuthenticated, isInitializing } = useAuthStore();

  if (isInitializing) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && !(allowedRoles as string[]).includes(user.role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
};
