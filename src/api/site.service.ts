import apiClient from './client';
import type { ApiResponse } from './employee.service';
import type { Site, SiteDetails, Geofence } from '../types/site';

export const SiteService = {
  getSites: async (page = 0, size = 10) => {
    return apiClient.get<ApiResponse<Site[]>>(`/sites?page=${page}&size=${size}`);
  },

  getSiteById: async (id: string) => {
    return apiClient.get<ApiResponse<SiteDetails>>(`/sites/${id}`);
  },

  createSite: async (site: Partial<Site>) => {
    return apiClient.post<ApiResponse<Site>>('/sites', site);
  },

  updateSite: async (id: string, site: Partial<Site>) => {
    return apiClient.put<ApiResponse<Site>>(`/sites/${id}`, site);
  },

  deactivateSite: async (id: string) => {
    return apiClient.delete<ApiResponse<void>>(`/sites/${id}`);
  },

  setGeofence: async (id: string, geofence: Geofence) => {
    return apiClient.put<ApiResponse<void>>(`/sites/${id}/geofence`, geofence);
  },
};
