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
   * Upload a real file to the media service, returns the CDN file URL
   */
  uploadDocumentFile: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'employee_documents');
    const response: any = await apiClient.post('/media/upload', formData);
    // The media endpoint returns { fileUrl, key, ... }
    return response?.fileUrl || response?.data?.fileUrl || response?.url || '';
  },

  /**
   * Register a document URL for an employee (after actual file upload)
   */
  uploadDocument: async (id: string, type: string, fileUrl: string) => {
    return apiClient.post<ApiResponse<any>>(`/employees/${id}/documents?type=${type}&fileUrl=${encodeURIComponent(fileUrl)}`);
  },

  /**
   * Verify (approve/reject) an employee document
   */
  verifyDocument: async (docId: string, isApproved: boolean, reason?: string) => {
    const reasonParam = reason ? `&reason=${encodeURIComponent(reason)}` : '';
    return apiClient.put<ApiResponse<any>>(`/employees/documents/${docId}/verify?isApproved=${isApproved}${reasonParam}`);
  },

  /**
   * Register employee face (multi-pose)
   */
  registerFace: async (id: string, embeddings: any[]) => {
    return apiClient.post<ApiResponse<any>>(`/employees/${id}/face`, embeddings);
  },
};

