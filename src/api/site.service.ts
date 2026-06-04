import apiClient from './client';
import type { ApiResponse } from './employee.service';
import type { Site, SiteDetails, Geofence } from '../types/site';

const mapSiteResponse = (raw: any): Site => ({
  id: raw.id,
  name: raw.name,
  address: raw.address,
  latitude: raw.latitude,
  longitude: raw.longitude,
  radius: raw.geofenceRadius || raw.radius || 0,
  status: (raw.isActive !== undefined ? raw.isActive : raw.active) ? 'ACTIVE' : 'INACTIVE',
  isPayrollVisible: raw.isPayrollVisible || false,
  supervisorName: raw.supervisorName,
  employeeCount: raw.employeeCount,
  clientName: raw.clientName,
});

const mapSiteDetailsResponse = (raw: any): SiteDetails => ({
  ...mapSiteResponse(raw),
  geofence: raw.geofence,
  managerEmail: raw.managerEmail,
  managerPhone: raw.managerPhone,
  description: raw.description,
});

export const SiteService = {
  getSites: async (page = 1, limit = 100) => {
    // Note: Spring-boot backend listSites uses 1-based page.
    const response: any = await apiClient.get<ApiResponse<any[]>>(`/sites?page=${page}&limit=${limit}`);
    
    // Check if the response contains paginated records under data
    if (response && response.success && Array.isArray(response.data)) {
      return {
        ...response,
        data: response.data.map(mapSiteResponse)
      } as any;
    }
    
    return response as any;
  },

  getSiteById: async (id: string) => {
    const response: any = await apiClient.get<ApiResponse<any>>(`/sites/${id}`);
    if (response && response.success && response.data) {
      return {
        ...response,
        data: mapSiteDetailsResponse(response.data)
      } as any;
    }
    return response as any;
  },

  createSite: async (site: Partial<Site> & { organizationId?: string }) => {
    const payload = {
      name: site.name,
      address: site.address,
      latitude: site.latitude,
      longitude: site.longitude,
      geofenceRadius: site.radius,
      isPayrollVisible: site.isPayrollVisible,
      organizationId: site.organizationId,
    };
    const response: any = await apiClient.post<ApiResponse<any>>('/sites', payload);
    if (response && response.success && response.data) {
      return {
        ...response,
        data: mapSiteResponse(response.data)
      } as any;
    }
    return response as any;
  },

  updateSite: async (id: string, site: Partial<Site> & { isActive?: boolean }) => {
    const payload = {
      name: site.name,
      address: site.address,
      latitude: site.latitude,
      longitude: site.longitude,
      geofenceRadius: site.radius,
      isActive: site.status !== undefined ? (site.status === 'ACTIVE') : site.isActive,
      isPayrollVisible: site.isPayrollVisible,
    };
    const response: any = await apiClient.put<ApiResponse<any>>(`/sites/${id}`, payload);
    if (response && response.success && response.data) {
      return {
        ...response,
        data: mapSiteResponse(response.data)
      } as any;
    }
    return response as any;
  },

  deactivateSite: async (id: string) => {
    return apiClient.delete<ApiResponse<void>>(`/sites/${id}`);
  },

  setGeofence: async (id: string, geofence: Geofence) => {
    return apiClient.put<ApiResponse<void>>(`/sites/${id}/geofence`, geofence);
  },
};
