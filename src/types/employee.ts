export type EmployeeRole = 'EMPLOYEE' | 'SUPERVISOR' | 'ADMIN' | 'SUPER_ADMIN' | 'CLIENT';
export type EmployeeStatus = 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE' | 'TERMINATED';

export interface Employee {
  id: string;
  employeeId?: string;
  fullName: string;
  email?: string;
  phone: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  siteName?: string;
  joiningDate: string;
}
