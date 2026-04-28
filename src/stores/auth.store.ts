import { create } from 'zustand';
import apiClient from '../api/client';

interface User {
  id: string;
  email: string;
  role: 'ADMIN' | 'SUPERVISOR' | 'PAYROLL_ADMIN' | 'SUPER_ADMIN' | 'EMPLOYEE';
  name: string;
  organizationId?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  login: (email: string, pass: string) => Promise<void>;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string) => Promise<void>;
  logout: () => void;
  refreshAccessToken: () => Promise<void>;
}

async function buildUserObject(userData: any, set: any): Promise<User> {
  // Set token temporarily so apiClient can use it immediately for the /me call
  if (userData.accessToken) {
    set({ accessToken: userData.accessToken });
    localStorage.setItem('fm_access_token', userData.accessToken);
  }

  // 1. Try to get name from raw payload
  let realName = userData.name || userData.fullName || (userData.firstName ? `${userData.firstName} ${userData.lastName || ''}`.trim() : null) || 
              userData.user?.name || userData.user?.fullName || (userData.user?.firstName ? `${userData.user.firstName} ${userData.user.lastName || ''}`.trim() : null);

  // 2. If no name found in payload, fetch from /v1/employees/me
  if (!realName && userData.accessToken) {
    try {
      const meResponse: any = await apiClient.get('/employees/me');
      const data = meResponse.data || meResponse;
      if (data.fullName) {
        realName = data.fullName;
      } else if (data.firstName) {
        realName = `${data.firstName} ${data.lastName || ''}`.trim();
      }
    } catch (e) {
      console.warn('[DEBUG AUTH] Could not fetch employee profile for real name. Proceeding with fallback.');
    }
  }

  // 3. Fallback to extracting from email prefix (e.g. "namool" from "namool@fmplatform.com")
  const emailFallback = (userData.email || userData.user?.email || '').split('@')[0];
  
  // 4. Final fallback
  const finalName = realName || emailFallback || 'User';

  return {
    id: userData.userId || userData.id || userData.user?.id,
    email: userData.email || userData.user?.email,
    role: userData.role || userData.user?.role,
    name: finalName,
    organizationId: userData.organizationId || userData.user?.organizationId,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: JSON.parse(localStorage.getItem('fm_user') || 'null'),
  accessToken: localStorage.getItem('fm_access_token'),
  refreshToken: localStorage.getItem('fm_refresh_token'),
  isAuthenticated: !!localStorage.getItem('fm_access_token'),
  isInitializing: true,

  login: async (email, password) => {
    try {
      const response: any = await apiClient.post('/auth/login', { email, password });
      const userData = response.data;
      
      const user = await buildUserObject(userData, set);
      
      localStorage.setItem('fm_user', JSON.stringify(user));
      localStorage.setItem('fm_access_token', userData.accessToken);
      localStorage.setItem('fm_refresh_token', userData.refreshToken);
      
      set({ 
        user, 
        accessToken: userData.accessToken, 
        refreshToken: userData.refreshToken, 
        isAuthenticated: true 
      });
    } catch (error) {
      console.error('Login failed', error);
      throw error;
    }
  },

  requestOtp: async (phone) => {
    try {
      await apiClient.post('/auth/otp/request', { phone });
    } catch (error) {
      console.error('OTP request failed', error);
      throw error;
    }
  },

  verifyOtp: async (phone, otp) => {
    try {
      const response: any = await apiClient.post('/auth/otp/verify', { phone, otp });
      const userData = response.data;
      
      const user = await buildUserObject(userData, set);
      
      localStorage.setItem('fm_user', JSON.stringify(user));
      localStorage.setItem('fm_access_token', userData.accessToken);
      localStorage.setItem('fm_refresh_token', userData.refreshToken);
      
      set({ 
        user, 
        accessToken: userData.accessToken, 
        refreshToken: userData.refreshToken, 
        isAuthenticated: true 
      });
    } catch (error) {
      console.error('OTP verification failed', error);
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('fm_user');
    localStorage.removeItem('fm_access_token');
    localStorage.removeItem('fm_refresh_token');
    set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  },

  refreshAccessToken: async () => {
    try {
      const currentRefreshToken = get().refreshToken;
      if (!currentRefreshToken) throw new Error('No refresh token available');

      const response: any = await apiClient.post('/auth/refresh', { 
        refreshToken: currentRefreshToken 
      });
      
      if (response.data) {
        const userData = response.data;
        const user = await buildUserObject(userData, set);
        
        localStorage.setItem('fm_user', JSON.stringify(user));
        localStorage.setItem('fm_access_token', userData.accessToken);
        
        set({ 
          user, 
          accessToken: userData.accessToken, 
          isAuthenticated: true 
        });
      }
    } catch (error) {
      console.error('Token refresh failed', error);
      if (get().isAuthenticated) {
        get().logout();
      }
    } finally {
      set({ isInitializing: false });
    }
  },
}));
