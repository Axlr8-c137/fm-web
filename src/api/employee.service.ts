import apiClient from './client';
import type { Employee } from '../types/employee';

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
  error?: string;
}

export const EmployeeService = {
  /**
   * Get all employees with optional filtering
   */
  getEmployees: async () => {
    return apiClient.get<ApiResponse<Employee[]>>('/employees');
  },

  /**
   * Search employees by name or role
   */
  searchEmployees: async (query: string) => {
    return apiClient.get<ApiResponse<Employee[]>>(`/employees/search?q=${query}`);
  },

  /**
   * Get a single employee by ID
   */
  getEmployeeById: async (id: string) => {
    return apiClient.get<ApiResponse<Employee>>(`/employees/${id}`);
  },

  /**
   * Create a new employee
   */
  createEmployee: async (data: any) => {
    return apiClient.post<ApiResponse<Employee>>('/employees', data);
  },

  /**
   * Update an existing employee
   */
  updateEmployee: async (id: string, data: any) => {
    return apiClient.put<ApiResponse<Employee>>(`/employees/${id}`, data);
  },

  /**
   * Delete an employee
   */
  deleteEmployee: async (id: string) => {
    return apiClient.delete<ApiResponse<any>>(`/employees/${id}`);
  },

  /**
   * Upload an employee document
   */
  uploadDocument: async (id: string, type: string, fileUrl: string) => {
    return apiClient.post<ApiResponse<any>>(`/employees/${id}/documents?type=${type}&fileUrl=${encodeURIComponent(fileUrl)}`);
  },

  /**
   * Register employee face (multi-pose)
   */
  registerFace: async (id: string, embeddings: any[]) => {
    return apiClient.post<ApiResponse<any>>(`/employees/${id}/face`, embeddings);
  },
};
