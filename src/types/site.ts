export interface Site {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radius: number;
  status: 'ACTIVE' | 'INACTIVE';
  supervisorName?: string;
  employeeCount?: number;
  clientName?: string;
}

export interface Geofence {
  type: 'CIRCLE' | 'POLYGON';
  coordinates: number[][]; // For POLYGON: [[lat, lng], ...], For CIRCLE: [[lat, lng]]
  radius?: number; // In meters, only for CIRCLE
}

export interface SiteDetails extends Site {
  geofence?: Geofence;
  managerEmail?: string;
  managerPhone?: string;
  description?: string;
}
