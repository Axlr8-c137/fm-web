import axios from 'axios';
import { useAuthStore } from '../stores/auth.store';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/v1',
  withCredentials: true, // Send httpOnly cookies for refresh
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

// Request interceptor — inject access token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  
  // Standard header to identify AJAX requests, often used for CSRF bypass in dev
  config.headers['X-Requested-With'] = 'XMLHttpRequest';
  
  return config;
});

// Response interceptor — handle token refresh on 401
apiClient.interceptors.response.use(
  (res) => res.data, // Unwrap to { success, data, meta, error }
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        await useAuthStore.getState().refreshAccessToken();
        // Update header with new token
        const newToken = useAuthStore.getState().accessToken;
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, logout user
        useAuthStore.getState().logout();
        return Promise.reject(refreshError);
      }
    }

    // Handle 403 Forbidden
    if (error.response?.status === 403) {
      window.location.href = '/forbidden';
    }
    
    return Promise.reject(error.response?.data?.error || error);
  }
);

export default apiClient;
