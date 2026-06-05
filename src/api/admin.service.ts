import apiClient from './client';
import type { ApiResponse } from './employee.service';

export interface AutoAssignResponse {
  totalEligibleEmployees: number;
  updatedCount: number;
  thresholdDate: string;
}

export interface SystemConfig {
  config: Record<string, any>;
}

export interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalEmployees: number;
  totalSites: number;
  activeSites: number;
  totalClients: number;
  todayAttendanceCount: number;
  totalPayrollRuns: number;
}

export const AdminService = {
  /**
   * Run yearly auto-assignment of employees meeting the 1-year threshold on April 1st.
   */
  autoAssignEmployees: async (siteId: string, organizationId?: string) => {
    return apiClient.post<ApiResponse<AutoAssignResponse>>('/admin/employees/auto-assign', {
      siteId,
      organizationId: organizationId || undefined,
    });
  },

  /**
   * Get the current system configuration from Redis.
   */
  getSystemConfig: async () => {
    return apiClient.get<ApiResponse<SystemConfig>>('/admin/config');
  },

  /**
   * Update system configuration entries in Redis.
   */
  updateSystemConfig: async (config: Record<string, any>) => {
    return apiClient.put<ApiResponse<SystemConfig>>('/admin/config', { config });
  },

  /**
   * Get dashboard metrics and counts.
   */
  getDashboardStats: async (orgId?: string) => {
    const params = orgId ? { orgId } : undefined;
    return apiClient.get<ApiResponse<SystemStats>>('/admin/dashboard/stats', { params });
  },

  /**
   * Export entity data (users, employees, sites) as CSV.
   * Returns a raw CSV file as a blob.
   */
  exportData: async (entity: 'users' | 'employees' | 'sites', orgId?: string) => {
    const params = orgId ? { orgId } : undefined;
    return apiClient.post(`/admin/export/${entity}`, null, {
      params,
      responseType: 'blob',
    });
  },

  /**
   * List organizations with pagination.
   */
  listOrganizations: async (page = 1, limit = 20) => {
    return apiClient.get<ApiResponse<any>>('/admin/organizations', {
      params: { page, limit },
    });
  },

  /**
   * Get organization by ID.
   */
  getOrganizationById: async (id: string) => {
    return apiClient.get<ApiResponse<any>>(`/admin/organizations/${id}`);
  },

  /**
   * Create a new organization.
   */
  createOrganization: async (name: string) => {
    return apiClient.post<ApiResponse<any>>('/admin/organizations', { name });
  },

  /**
   * Update organization details.
   */
  updateOrganization: async (id: string, name: string) => {
    return apiClient.put<ApiResponse<any>>(`/admin/organizations/${id}`, { name });
  },

  /**
   * Delete organization.
   */
  deleteOrganization: async (id: string) => {
    return apiClient.delete<ApiResponse<void>>(`/admin/organizations/${id}`);
  },

  /**
   * Get audit logs with optional filters and pagination.
   */
  getAuditLogs: async (params: { userId?: string; action?: string; page?: number; limit?: number }) => {
    return apiClient.get<ApiResponse<any>>('/admin/audit-logs', { params });
  },
};
