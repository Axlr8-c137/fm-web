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
  getEmployees: async (includeAllSites: boolean = false) => {
    const params = includeAllSites ? '?includeAllSites=true' : '';
    return apiClient.get<ApiResponse<Employee[]>>(`/employees${params}`);
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
   * Approve or reject an employee onboarding request
   */
  approveEmployee: async (id: string, isApproved: boolean) => {
    return apiClient.put<ApiResponse<Employee>>(`/employees/${id}/approve?isApproved=${isApproved}`);
  },

  /**
   * Delete an employee
   */
  deleteEmployee: async (id: string) => {
    return apiClient.delete<ApiResponse<any>>(`/employees/${id}`);
  },

  uploadDocumentFile: async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', 'employee_documents');
    // apiClient unwraps axios response to res.data, so response = MediaConfirmResponseDto
    // Backend returns: { fileKey, cdnUrl, thumbnailUrl }
    const response: any = await apiClient.post('/media/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    
    // Recursively extract URL from backend payload which might be wrapped differently
    const extractUrl = (obj: any): string => {
      if (!obj) return '';
      if (typeof obj === 'string') return obj;
      if (obj.cdnUrl) return obj.cdnUrl;
      if (obj.fileUrl) return obj.fileUrl;
      if (obj.url) return obj.url;
      if (obj.data) return extractUrl(obj.data);
      return '';
    };

    return extractUrl(response);
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

  /**
   * Get the authenticated user's own profile.
   */
  getMyProfile: async () => {
    return apiClient.get<ApiResponse<Employee>>('/employees/me');
  },

  /**
   * Update the authenticated user's bank details.
   */
  updateMyBankDetails: async (bankDetails: { bankName: string; bankAccountNumber: string; bankIfscCode: string }) => {
    return apiClient.patch<ApiResponse<Employee>>('/employees/me/bank-details', bankDetails);
  },

  /**
   * Update the authenticated user's preferred language.
   */
  updateMyLanguage: async (lang: string) => {
    return apiClient.patch<ApiResponse<any>>(`/employees/me/language?lang=${encodeURIComponent(lang)}`);
  },

  /**
   * Get archived employees (deleted within last 90 days)
   */
  getArchivedEmployees: async (query?: string) => {
    const qParam = query ? `?query=${encodeURIComponent(query)}` : '';
    const limitParam = query ? `&limit=100` : '?limit=100';
    return apiClient.get<ApiResponse<Employee[]>>(`/employees/archived${qParam}${limitParam}`);
  },

  /**
   * Restore an archived employee
   */
  restoreEmployee: async (id: string) => {
    return apiClient.post<ApiResponse<Employee>>(`/employees/${id}/restore`);
  },
};

