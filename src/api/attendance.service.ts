import apiClient from './client';
import type { ApiResponse } from './employee.service';
import type { AttendanceLog, AttendanceReport } from '../types/attendance';

export const AttendanceService = {
  getLogs: async (params: {
    siteId?: string;
    employeeId?: string;
    start?: string;
    end?: string;
    page?: number;
    limit?: number;
  }) => {
    const queryParams = new URLSearchParams();
    if (params.siteId) queryParams.append('siteId', params.siteId);
    if (params.employeeId) queryParams.append('employeeId', params.employeeId);
    if (params.start) queryParams.append('start', params.start);
    if (params.end) queryParams.append('end', params.end);
    if (params.page !== undefined) queryParams.append('page', params.page.toString());
    if (params.limit !== undefined) queryParams.append('limit', params.limit.toString());

    return apiClient.get<ApiResponse<AttendanceLog[]>>(`/attendance/logs?${queryParams.toString()}`);
  },

  getTodayAttendance: async (siteId?: string) => {
    const url = siteId ? `/attendance/site/${siteId}` : '/attendance/today';
    return apiClient.get<ApiResponse<AttendanceReport[]>>(url);
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

  exportAttendance: async (entity: 'ATTENDANCE' | 'EMPLOYEES' | 'SITES', filters: any) => {
    return apiClient.post<ApiResponse<{ downloadUrl: string }>>(`/admin/export/${entity}`, filters);
  },
  
  createManualLog: async (data: any) => {
    return apiClient.post<ApiResponse<AttendanceLog>>('/attendance/logs', data);
  },

  updateManualLog: async (id: string, data: any) => {
    return apiClient.put<ApiResponse<AttendanceLog>>(`/attendance/logs/${id}`, data);
  },

  deleteManualLog: async (id: string) => {
    return apiClient.delete<ApiResponse<void>>(`/attendance/logs/${id}`);
  },
};
