import apiClient from './client';
import type { ApiResponse } from './employee.service';

export interface LiveLocation {
  employeeId: string;
  employeeName: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  battery: number;
  signal: number;
  airplaneMode: boolean;
  lastUpdated: string;
}

export interface HeatmapPoint {
  latitude: number;
  longitude: number;
  weight: number;
}

export interface HeatmapData {
  points: HeatmapPoint[];
}

export interface GeofenceAlert {
  employeeId: string;
  employeeName: string;
  siteId: string;
  siteName: string;
  lastLatitude: number;
  lastLongitude: number;
  detectedAt: string;
  minutesOutside: number;
}

export const LocationService = {
  /**
   * Get live locations of all active employees at a site.
   */
  getLiveLocations: async (siteId: string) => {
    return apiClient.get<ApiResponse<LiveLocation[]>>(`/location/live/${siteId}`);
  },

  /**
   * Get historical heatmap aggregation data for a site.
   */
  getHeatmapData: async (siteId: string, start: string, end: string) => {
    return apiClient.get<ApiResponse<HeatmapData>>(`/location/heatmap/${siteId}?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`);
  },

  /**
   * Get currently active geofence alerts across the organization.
   */
  getAlerts: async () => {
    return apiClient.get<ApiResponse<GeofenceAlert[]>>('/location/alerts');
  },
};
