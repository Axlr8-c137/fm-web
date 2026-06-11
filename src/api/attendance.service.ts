import apiClient from './client';
import type { ApiResponse } from './employee.service';
import type { AttendanceLog, AttendanceReport } from '../types/attendance';

export const AttendanceService = {
  getLogs: async (params: {
    siteId?: string;
    employeeId?: string;
    start?: string;
    end?: string;
    page?: number;   // 1-indexed (backend PageRequestDto is 1-based)
    limit?: number;  // max 100 (backend enforces @Max(100))
  }) => {
    const queryParams = new URLSearchParams();
    if (params.siteId) queryParams.append('siteId', params.siteId);
    if (params.employeeId) queryParams.append('employeeId', params.employeeId);
    if (params.start) queryParams.append('start', params.start);
    if (params.end) queryParams.append('end', params.end);

    // Backend PageRequestDto uses 'page' (1-indexed) and 'limit' (max 100)
    queryParams.append('page', String(Math.max(1, params.page ?? 1)));
    queryParams.append('limit', String(Math.min(100, params.limit ?? 100)));

    return apiClient.get<ApiResponse<AttendanceLog[]>>(`/attendance/logs?${queryParams.toString()}`);
  },

  getTodayAttendance: async (siteId?: string) => {
    if (!siteId) {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      const res = await AttendanceService.getLogs({
        start: todayStart.toISOString(),
        end: todayEnd.toISOString(),
        limit: 1000 // Get a large batch for today
      });
      return (res.data as any) || []; // Extract the raw array
    }
    const res = await apiClient.get<any>(`/attendance/site/${siteId}`);
    return (res as any)?.data || [];
  },

  getReport: async (params: {
    siteId?: string;
    employeeId?: string;
    start?: string;
    end?: string;
  }) => {
    const queryParams = new URLSearchParams();
    if (params.siteId) queryParams.append('siteId', params.siteId);
    if (params.employeeId) queryParams.append('employeeId', params.employeeId);
    if (params.start) queryParams.append('start', params.start);
    if (params.end) queryParams.append('end', params.end);

    return apiClient.get<ApiResponse<AttendanceReport[]>>(`/attendance/report?${queryParams.toString()}`);
  },

  exportAttendance: async (entity: string, filters: any) => {
    return apiClient.post(`/admin/export/${entity}`, filters, {
      responseType: 'blob',
    });
  },

  createManualLog: async (data: any) => {
    return apiClient.post<ApiResponse<AttendanceLog>>('/attendance/logs', data);
  },

  createBulkManualLog: async (data: any) => {
    return apiClient.post<ApiResponse<AttendanceLog[]>>('/attendance/logs/bulk', data);
  },

  updateManualLog: async (id: string, data: any) => {
    return apiClient.put<ApiResponse<AttendanceLog>>(`/attendance/logs/${id}`, data);
  },

  deleteManualLog: async (id: string) => {
    return apiClient.delete<ApiResponse<void>>(`/attendance/logs/${id}`);
  },
};