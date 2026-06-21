import apiClient from './client';
import type { ApiResponse } from './employee.service';
import type {
  Shift,
  ShiftAssignment,
  ScheduleResponseDto,
  CreateShiftDto,
  UpdateShiftDto,
  ShiftAssignmentDto,
  BulkShiftAssignmentDto,
  BulkAssignmentResponseDto
} from '../types/shift';

export const ShiftService = {
  /**
   * Create a new shift template
   */
  createShift: async (dto: CreateShiftDto): Promise<Shift> => {
    const response: any = await apiClient.post('/shifts', dto);
    return response;
  },

  /**
   * Update an existing shift template
   */
  updateShift: async (id: string, dto: UpdateShiftDto): Promise<Shift> => {
    const response: any = await apiClient.put(`/shifts/${id}`, dto);
    return response;
  },

  /**
   * Deactivate/Delete a shift template
   */
  deleteShift: async (id: string): Promise<void> => {
    const response: any = await apiClient.delete(`/shifts/${id}`);
    return response;
  },

  /**
   * List shifts for a site with pagination
   */
  listShifts: async (siteId: string, page = 1, limit = 100): Promise<ApiResponse<Shift[]>> => {
    const response: any = await apiClient.get(`/shifts/site/${siteId}?page=${page}&limit=${limit}`);
    return response;
  },

  /**
   * Assign an employee to a shift on a specific date
   */
  assignEmployee: async (dto: ShiftAssignmentDto): Promise<ShiftAssignment> => {
    const response: any = await apiClient.post('/shifts/assign', dto);
    return response;
  },

  /**
   * Bulk assign shifts over a date range with recurrence pattern
   */
  assignBulkShifts: async (dto: BulkShiftAssignmentDto): Promise<BulkAssignmentResponseDto> => {
    const response: any = await apiClient.post('/shifts/assign/bulk', dto);
    return response;
  },

  /**
   * Unassign an employee from a shift (removes shift assignment)
   */
  unassignEmployee: async (assignmentId: string): Promise<void> => {
    const response: any = await apiClient.delete(`/shifts/assign/${assignmentId}`);
    return response;
  },

  /**
   * Get the schedule for a date range.
   * - Employees see their own schedule.
   * - Admins/Supervisors can specify employeeId or retrieve all assignments (all=true)
   */
  getSchedule: async (params: {
    startDate: string; // YYYY-MM-DD
    endDate: string;   // YYYY-MM-DD
    employeeId?: string;
    all?: boolean;
  }): Promise<ScheduleResponseDto[]> => {
    const queryParams = new URLSearchParams();
    queryParams.append('startDate', params.startDate);
    queryParams.append('endDate', params.endDate);
    if (params.employeeId) {
      queryParams.append('employeeId', params.employeeId);
    }
    if (params.all) {
      queryParams.append('all', 'true');
    }
    const response: any = await apiClient.get(`/shifts/schedule?${queryParams.toString()}`);
    return response;
  },
};
