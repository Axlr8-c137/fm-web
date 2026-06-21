export type RecurrenceType = 'DAILY' | 'WEEKLY' | 'MONTHLY';

export interface Shift {
  id: string;
  siteId: string;
  name: string;
  startTime: string; // e.g. "08:00:00" or "08:00"
  endTime: string;   // e.g. "16:00:00" or "16:00"
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ShiftAssignment {
  id: string;
  employeeId: string;
  shiftId: string;
  date: string; // YYYY-MM-DD
  createdAt?: string;
  updatedAt?: string;
}

export interface ScheduleResponseDto {
  assignmentId: string;
  employeeId: string;
  employeeName: string;
  shiftId: string;
  shiftName: string;
  siteId: string;
  siteName: string;
  startTime: string; // e.g., "08:00:00"
  endTime: string;   // e.g., "16:00:00"
  date: string;      // YYYY-MM-DD
}

export interface CreateShiftDto {
  siteId: string;
  name: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

export interface UpdateShiftDto {
  name: string;
  startTime: string; // HH:mm
  endTime: string;   // HH:mm
}

export interface ShiftAssignmentDto {
  employeeId: string;
  shiftId: string;
  date: string; // YYYY-MM-DD
}

export interface BulkShiftAssignmentDto {
  employeeId: string;
  shiftId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  recurrenceType: RecurrenceType;
  daysOfWeek?: number[];   // 1=Monday, 7=Sunday
  weeksOfMonth?: number[]; // 1-4
}

export interface BulkAssignmentResponseDto {
  assignedDates: string[];
  skippedDates: string[];
  conflictReason?: string;
}
