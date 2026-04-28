import { useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/auth.store';
import LoginPage from './pages/auth/LoginPage';
import ForbiddenPage from './pages/auth/ForbiddenPage';
import EmployeesPage from './pages/employees/EmployeesPage';
import EmployeeOnboardingPage from './pages/employees/EmployeeOnboardingPage';
import SiteListPage from './pages/sites/SiteListPage';
import SiteDetailsPage from './pages/sites/SiteDetailsPage';
import AttendanceLogsPage from './pages/attendance/AttendanceLogsPage';
import { MainLayout } from './components/layout/MainLayout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { RoleProtectedRoute } from './components/auth/RoleProtectedRoute';
import apiClient from './api/client';

function App() {
  const refreshAccessToken = useAuthStore((state) => state.refreshAccessToken);

  useEffect(() => {
    const initAuth = async () => {
      // Prime CSRF token and check session
      try {
        await apiClient.get('/health');
      } catch (e) {
        // Health check might be protected or fail, ignore
      }

      if (window.location.pathname !== '/login') {
        refreshAccessToken();
      } else {
        useAuthStore.setState({ isInitializing: false });
      }
    };

    initAuth();
  }, [refreshAccessToken]);

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/forbidden" element={<ForbiddenPage />} />
      
      {/* Protected Routes */}
      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          
          <Route element={<RoleProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR', 'PAYROLL_ADMIN']} />}>
            <Route path="dashboard" element={<div>Dashboard (Coming Soon)</div>} />
          </Route>
          
          {/* Admin & Super Admin Only Routes */}
          <Route element={<RoleProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN']} />}>
            <Route path="employees" element={<EmployeesPage />} />
            <Route path="employees/onboard" element={<EmployeeOnboardingPage />} />
            <Route path="sites" element={<SiteListPage />} />
            <Route path="sites/:id" element={<SiteDetailsPage />} />
            <Route path="admin" element={<div>Admin Settings (Coming Soon)</div>} />
          </Route>

          {/* Supervisor, Admin, Super Admin Routes */}
          <Route element={<RoleProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR']} />}>
             <Route path="attendance" element={<AttendanceLogsPage />} />
             <Route path="ops" element={<div>Live Operations (Coming Soon)</div>} />
          </Route>

          {/* Payroll, Admin, Super Admin Routes */}
          <Route element={<RoleProtectedRoute allowedRoles={['ADMIN', 'SUPER_ADMIN', 'PAYROLL_ADMIN']} />}>
             <Route path="payroll" element={<div>Payroll Management (Coming Soon)</div>} />
          </Route>
        </Route>
      </Route>
      
      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
