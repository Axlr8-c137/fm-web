export type AttendanceStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'EARLY_EXIT' | 'ON_LEAVE';
export type PunchType = 'IN' | 'OUT';

export interface AttendanceLog {
  id: string;
  employeeId: string;
  employeeName: string;
  siteId: string;
  siteName: string;
  timestamp: string;
  type: PunchType;
  latitude: number;
  longitude: number;
  isVerified: boolean;
  verificationMethod: 'FACE' | 'MANUAL' | 'OTP';
  imageUrl?: string;
}

export interface AttendanceReport {
  id: string;
  employeeId: string;
  employeeName: string;
  date: string;
  checkIn?: string;
  checkOut?: string;
  status: AttendanceStatus;
  workHours: number;
  siteName: string;
}
