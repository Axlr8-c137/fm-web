import React, { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography as MuiTypography,
  Grid,
  Paper,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Chip,
  IconButton,
  Card,
  alpha,
  useTheme,
  Divider,
} from '@mui/material';
import {
  Map as MapIcon,
  Warning as AlertIcon,
  Settings as ConfigIcon,
  Refresh as RefreshIcon,
  GpsFixed as LocateIcon,
  BatteryChargingFull as BatteryIcon,
  SignalCellularAlt as SignalIcon,
  Flight as AirplaneIcon,
  Download as ExportIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { MapContainer, TileLayer, Marker, Circle, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';

// API Services
import { LocationService } from '../../api/location.service';
import type { LiveLocation, GeofenceAlert } from '../../api/location.service';
import { AdminService } from '../../api/admin.service';
import { SiteService } from '../../api/site.service';
import { useAuthStore } from '../../stores/auth.store';

const Typography = MuiTypography as any;
const MapContainerAny = MapContainer as any;
const TileLayerAny = TileLayer as any;
const MarkerAny = Marker as any;
const CircleAny = Circle as any;

// Leaflet Marker Icon Creators
const createEmployeeIcon = (color: string, isBreached: boolean) => {
  const markerHtml = `
    <div style="position: relative; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center;">
      ${isBreached ? `
        <div style="
          position: absolute;
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background-color: ${color};
          opacity: 0.4;
          animation: marker-pulse 1.2s infinite ease-out;
        "></div>
      ` : ''}
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="z-index: 2;">
        <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" 
              fill="${color}" stroke="white" stroke-width="1.5"/>
      </svg>
    </div>
  `;

  if (!document.getElementById('leaflet-marker-pulse-css')) {
    const style = document.createElement('style');
    style.id = 'leaflet-marker-pulse-css';
    style.innerHTML = `
      @keyframes marker-pulse {
        0% { transform: scale(0.5); opacity: 0.8; }
        100% { transform: scale(1.6); opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }

  return L.divIcon({
    className: 'custom-leaflet-marker-icon',
    html: markerHtml,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

const createSiteIcon = (color: string) => {
  const markerHtml = `
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 3L2 12H5V20H9V14H15V20H19V12H22L12 3Z" fill="${color}" stroke="white" stroke-width="1.5"/>
    </svg>
  `;
  return L.divIcon({
    className: 'custom-site-marker-icon',
    html: markerHtml,
    iconSize: [36, 36],
    iconAnchor: [18, 18]
  });
};

function MapUpdater({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export default function OperationsPage() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // State
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [focusedEmployeeId, setFocusedEmployeeId] = useState<string | null>(null);
  const [focusedCoordinate, setFocusedCoordinate] = useState<[number, number] | null>(null);

  // Redis Config CRUD States
  const [configList, setConfigList] = useState<{ key: string; value: string; isSaving?: boolean }[]>([]);
  const [isConfigLoading, setIsConfigLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [newConfigKey, setNewConfigKey] = useState('');
  const [newConfigVal, setNewConfigVal] = useState('');
  const [configSearch, setConfigSearch] = useState('');

  // Base Queries
  const { data: sitesData, isLoading: sitesLoading } = useQuery({
    queryKey: ['ops-sites'],
    queryFn: () => SiteService.getSites(1, 100),
  });

  const sites = useMemo(() => sitesData?.data || [], [sitesData]);
  const activeSite = useMemo(() => sites.find((s: any) => s.id === selectedSiteId), [sites, selectedSiteId]);

  // Set default site
  useEffect(() => {
    if (sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  // Live Location Query (10s polling)
  const { data: liveLocationsData, isFetching: liveLoading, refetch: refetchLive } = useQuery({
    queryKey: ['live-locations', selectedSiteId],
    queryFn: async () => {
      if (!selectedSiteId) return { success: true, data: [] as LiveLocation[] };
      return LocationService.getLiveLocations(selectedSiteId) as any;
    },
    enabled: !!selectedSiteId,
    refetchInterval: 10000,
  });

  const liveLocations = useMemo(() => ((liveLocationsData as any)?.data || []) as LiveLocation[], [liveLocationsData]);

  // Geofence Alerts Query (15s polling)
  const { data: alertsData, isFetching: alertsLoading, refetch: refetchAlerts } = useQuery({
    queryKey: ['geofence-alerts'],
    queryFn: () => LocationService.getAlerts() as any,
    refetchInterval: 15000,
  });

  const alerts = useMemo(() => ((alertsData as any)?.data || []) as GeofenceAlert[], [alertsData]);

  // Fetch Redis config on mount for Super Admins
  useEffect(() => {
    if (isSuperAdmin) {
      loadSystemConfig();
    }
  }, [isSuperAdmin]);

  const loadSystemConfig = async () => {
    setIsConfigLoading(true);
    setConfigError(null);
    try {
      const res = (await AdminService.getSystemConfig()) as any;
      const rawConfig = res.data?.config || res.config || {};
      const list = Object.entries(rawConfig).map(([key, value]) => ({
        key,
        value: typeof value === 'object' ? JSON.stringify(value) : String(value),
        isSaving: false
      }));
      setConfigList(list);
    } catch (err: any) {
      console.error('Failed to load Redis config', err);
      setConfigError(err?.message || 'Failed to sync Redis config.');
    } finally {
      setIsConfigLoading(false);
    }
  };

  // Dynamic Key-Value Save (Immediate Sync)
  const syncConfigToBackend = async (updatedList: { key: string; value: string }[]) => {
    const configMap: Record<string, any> = {};
    updatedList.forEach(item => {
      let parsedVal: any = item.value;
      try {
        if (item.value === 'true') parsedVal = true;
        else if (item.value === 'false') parsedVal = false;
        else if (!isNaN(Number(item.value))) parsedVal = Number(item.value);
        else parsedVal = JSON.parse(item.value);
      } catch {
        parsedVal = item.value;
      }
      configMap[item.key] = parsedVal;
    });

    try {
      await AdminService.updateSystemConfig(configMap);
    } catch (err: any) {
      console.error('Error syncing config', err);
      setConfigError(err?.message || 'Sync failed.');
    }
  };

  // CRUD Actions
  const handleUpdateVal = async (key: string, newVal: string) => {
    // Show spinner on the item
    setConfigList(prev => prev.map(item => item.key === key ? { ...item, value: newVal, isSaving: true } : item));
    
    const nextList = configList.map(item => item.key === key ? { ...item, value: newVal } : item);
    await syncConfigToBackend(nextList);
    
    setConfigList(prev => prev.map(item => item.key === key ? { ...item, isSaving: false } : item));
  };

  const handleCreateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newConfigKey.trim()) return;
    if (configList.some(item => item.key === newConfigKey.trim())) {
      alert('Key already exists!');
      return;
    }

    const newItem = { key: newConfigKey.trim(), value: newConfigVal, isSaving: true };
    setConfigList(prev => [...prev, newItem]);
    setNewConfigKey('');
    setNewConfigVal('');

    const nextList = [...configList, { key: newItem.key, value: newItem.value }];
    await syncConfigToBackend(nextList);
    
    setConfigList(prev => prev.map(item => item.key === newItem.key ? { ...item, isSaving: false } : item));
  };

  const handleDeleteKey = async (keyToDelete: string) => {
    if (!confirm(`Are you sure you want to delete parameter: "${keyToDelete}"?`)) return;

    setConfigList(prev => prev.map(item => item.key === keyToDelete ? { ...item, isSaving: true } : item));
    
    const nextList = configList.filter(item => item.key !== keyToDelete);
    await syncConfigToBackend(nextList);

    setConfigList(nextList);
  };

  // CSV Data Exports
  const handleCSVExport = async (entity: 'users' | 'employees' | 'sites') => {
    try {
      const res: any = await AdminService.exportData(entity);
      const blob = new Blob([res], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${entity}_export_${format(new Date(), 'yyyyMMdd')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      console.error('Export failed', err);
      alert(`Failed to export ${entity}: ` + (err?.message || 'Server error'));
    }
  };

  const handleLocateAlert = (alertItem: GeofenceAlert) => {
    if (alertItem.lastLatitude && alertItem.lastLongitude) {
      setSelectedSiteId(alertItem.siteId);
      setFocusedCoordinate([alertItem.lastLatitude, alertItem.lastLongitude]);
      setFocusedEmployeeId(alertItem.employeeId);
    }
  };

  // Map settings
  const defaultCenter: [number, number] = [19.0760, 72.8777]; // Mumbai default

  const mapCenter: [number, number] = useMemo(() => {
    if (focusedCoordinate) return focusedCoordinate;
    if (activeSite && activeSite.latitude && activeSite.longitude) {
      return [activeSite.latitude, activeSite.longitude];
    }
    return defaultCenter;
  }, [activeSite, focusedCoordinate]);

  const mapZoom = useMemo(() => (focusedCoordinate ? 16 : 14), [focusedCoordinate]);

  // Reset focus on site switch
  useEffect(() => {
    setFocusedCoordinate(null);
    setFocusedEmployeeId(null);
  }, [selectedSiteId]);

  // Filtered config list
  const filteredConfig = useMemo(() => {
    const q = configSearch.toLowerCase().trim();
    if (!q) return configList;
    return configList.filter(item => item.key.toLowerCase().includes(q) || item.value.toLowerCase().includes(q));
  }, [configList, configSearch]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Top Bar */}
      <Box sx={{ mb: 3.5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={900} gutterBottom sx={{ letterSpacing: '-0.8px' }}>
            Operations Panel
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Live GPS telemetry maps and dynamic system parameters configuration
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          <TextField
            select
            size="small"
            label="Active Site Focus"
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            sx={{ minWidth: 220 }}
            slotProps={{ input: { sx: { borderRadius: 2.5 } } }}
            disabled={sitesLoading}
          >
            {sites.map((s: any) => (
              <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            onClick={() => {
              refetchLive();
              refetchAlerts();
              if (isSuperAdmin) loadSystemConfig();
            }}
            disabled={liveLoading || alertsLoading || isConfigLoading}
            startIcon={liveLoading || alertsLoading || isConfigLoading ? <CircularProgress size={16} /> : <RefreshIcon />}
            sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 700 }}
          >
            Sync
          </Button>
        </Box>
      </Box>

      {/* Split Dashboard */}
      <Grid container spacing={3}>
        {/* Left Column: Live Telemetry Map */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card variant="outlined" sx={{ borderRadius: 4, height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: alpha(theme.palette.primary.main, 0.01) }}>
              <Typography variant="subtitle1" fontWeight={850} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <MapIcon color="primary" /> Live Tracking Map
              </Typography>
              <Chip
                label={`${liveLocations.length} Active`}
                color={liveLocations.length > 0 ? 'success' : 'default'}
                size="small"
                sx={{ fontWeight: 800 }}
              />
            </Box>

            <Box sx={{ height: '45vh', position: 'relative', width: '100%' }}>
              {!selectedSiteId ? (
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 1.5 }}>
                  <CircularProgress size={30} />
                  <Typography color="text.secondary" variant="body2">Resolving site context...</Typography>
                </Box>
              ) : (
                <MapContainerAny
                  center={mapCenter}
                  zoom={mapZoom}
                  style={{ height: '100%', width: '100%', zIndex: 1 }}
                >
                  <TileLayerAny
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <MapResizer />
                  <MapUpdater center={mapCenter} zoom={mapZoom} />

                  {/* Site Geofence Anchor */}
                  {activeSite && activeSite.latitude && activeSite.longitude && (
                    <>
                      <MarkerAny
                        position={[activeSite.latitude, activeSite.longitude]}
                        icon={createSiteIcon(theme.palette.secondary.main)}
                      >
                        <Popup>
                          <Box sx={{ p: 0.5 }}>
                            <Typography variant="subtitle2" fontWeight={800}>{activeSite.name}</Typography>
                            <Typography variant="caption" color="text.secondary" display="block">{activeSite.address}</Typography>
                            <Chip label="HQ Anchor" size="small" color="secondary" sx={{ mt: 1, height: 18, fontSize: '0.65rem' }} />
                          </Box>
                        </Popup>
                      </MarkerAny>

                      <CircleAny
                        center={[activeSite.latitude, activeSite.longitude]}
                        radius={activeSite.radius || 150}
                        pathOptions={{
                          color: theme.palette.primary.main,
                          fillColor: theme.palette.primary.main,
                          fillOpacity: 0.07,
                          weight: 1.8,
                          dashArray: '5, 5'
                        }}
                      />
                    </>
                  )}

                  {/* Pulse Employee Markers */}
                  {liveLocations.map((loc: LiveLocation) => {
                    const isInside = activeSite && activeSite.latitude && activeSite.longitude
                      ? (L.latLng(loc.latitude, loc.longitude).distanceTo(L.latLng(activeSite.latitude, activeSite.longitude)) <= (activeSite.radius || 150))
                      : true;

                    const markerColor = loc.employeeId === focusedEmployeeId 
                      ? theme.palette.info.main 
                      : isInside ? theme.palette.success.main : theme.palette.error.main;

                    return (
                      <MarkerAny
                        key={loc.employeeId}
                        position={[loc.latitude, loc.longitude]}
                        icon={createEmployeeIcon(markerColor, !isInside)}
                      >
                        <Popup>
                          <Box sx={{ p: 0.8, minWidth: 180 }}>
                            <Typography variant="subtitle2" fontWeight={850} sx={{ mb: 1 }}>{loc.employeeName}</Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1 }}>
                              <Typography variant="caption" display="flex" alignItems="center" gap={0.5}><BatteryIcon fontSize="inherit" /> Battery: {loc.battery ? `${Math.round(loc.battery * 100)}%` : 'N/A'}</Typography>
                              <Typography variant="caption" display="flex" alignItems="center" gap={0.5}><SignalIcon fontSize="inherit" /> Signal: {loc.signal ? `${Math.round(loc.signal * 100)}%` : 'N/A'}</Typography>
                              {loc.airplaneMode && <Typography variant="caption" color="warning.main" display="flex" alignItems="center" gap={0.5}><AirplaneIcon fontSize="inherit" /> Airplane Mode Active</Typography>}
                            </Box>
                            <Divider sx={{ my: 1 }} />
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Chip label={isInside ? 'Inside' : 'Breached'} color={isInside ? 'success' : 'error'} size="small" sx={{ height: 18, fontSize: '0.6rem', fontWeight: 800 }} />
                              <Typography variant="caption" color="text.secondary">{loc.lastUpdated ? format(new Date(loc.lastUpdated), 'hh:mm:ss a') : 'Just now'}</Typography>
                            </Box>
                          </Box>
                        </Popup>
                      </MarkerAny>
                    );
                  })}
                </MapContainerAny>
              )}
            </Box>

            {/* Geofence Alerts breach list */}
            <Box sx={{ flexGrow: 1, p: 2.5, borderTop: 1, borderColor: 'divider', overflowY: 'auto', maxHeight: '22vh' }}>
              <Typography variant="subtitle2" fontWeight={850} sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }} color={alerts.length > 0 ? 'error.main' : 'text.primary'}>
                <AlertIcon fontSize="small" /> Active Geofence Breaches ({alerts.length})
              </Typography>
              
              {alerts.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No active perimeter violations reported across sites.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {alerts.map((item) => (
                    <Box
                      key={item.employeeId}
                      sx={{
                        p: 1.2,
                        borderRadius: 2,
                        border: 1,
                        borderColor: alpha(theme.palette.error.main, 0.15),
                        backgroundColor: alpha(theme.palette.error.main, 0.02),
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <Box>
                        <Typography variant="subtitle2" fontWeight={800} color="error.main">{item.employeeName}</Typography>
                        <Typography variant="caption" color="text.secondary">Left site: {item.siteName} ({item.minutesOutside} mins outside)</Typography>
                      </Box>
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleLocateAlert(item)}
                      >
                        <LocateIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          </Card>
        </Grid>

        {/* Right Column: Dynamic Redis Configuration CRUD */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card variant="outlined" sx={{ borderRadius: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: alpha(theme.palette.primary.main, 0.01) }}>
              <Typography variant="subtitle1" fontWeight={850} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <ConfigIcon color="primary" /> Runtime Config CRUD
              </Typography>
              {isSuperAdmin && (
                <Chip label="Redis Linked" size="small" color="primary" sx={{ fontWeight: 800, height: 20 }} />
              )}
            </Box>

            {!isSuperAdmin ? (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <Alert severity="warning">Config CRUD parameters are only accessible under Super Admin privileges.</Alert>
                <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Button variant="outlined" startIcon={<ExportIcon />} onClick={() => handleCSVExport('users')} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>Export Users CSV</Button>
                  <Button variant="outlined" startIcon={<ExportIcon />} onClick={() => handleCSVExport('employees')} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>Export Employees CSV</Button>
                  <Button variant="outlined" startIcon={<ExportIcon />} onClick={() => handleCSVExport('sites')} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>Export Sites CSV</Button>
                </Box>
              </Box>
            ) : (
              <Box sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2, height: '100%' }}>
                {configError && <Alert severity="error" onClose={() => setConfigError(null)}>{configError}</Alert>}

                {/* Search Parameter */}
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Filter parameters..."
                  value={configSearch}
                  onChange={(e) => setConfigSearch(e.target.value)}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />

                {/* CRUD List */}
                <Box sx={{ overflowY: 'auto', maxHeight: '35vh', border: 1, borderColor: 'divider', borderRadius: 3, flexGrow: 1, p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  {isConfigLoading && configList.length === 0 ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
                  ) : filteredConfig.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 3 }}>No keys found matching query.</Typography>
                  ) : (
                    filteredConfig.map((item) => (
                      <Paper
                        key={item.key}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderRadius: 2.5,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                          position: 'relative',
                          borderColor: item.isSaving ? theme.palette.primary.main : theme.palette.divider,
                          backgroundColor: item.isSaving ? alpha(theme.palette.primary.main, 0.01) : 'transparent',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 800, color: 'primary.main', wordBreak: 'break-all', mr: 2 }}>
                            {item.key}
                          </Typography>
                          
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            {item.isSaving ? (
                              <CircularProgress size={14} sx={{ mr: 1 }} />
                            ) : (
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => handleDeleteKey(item.key)}
                              >
                                <DeleteIcon fontSize="inherit" />
                              </IconButton>
                            )}
                          </Box>
                        </Box>

                        <TextField
                          fullWidth
                          size="small"
                          variant="standard"
                          value={item.value}
                          onChange={(e) => setConfigList(prev => prev.map(p => p.key === item.key ? { ...p, value: e.target.value } : p))}
                          onBlur={(e) => handleUpdateVal(item.key, e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              (e.target as HTMLInputElement).blur();
                            }
                          }}
                          slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: '0.82rem' } } }}
                        />
                      </Paper>
                    ))
                  )}
                </Box>

                {/* Add Inline Config Form (CREATE) */}
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, backgroundColor: alpha(theme.palette.primary.main, 0.01) }}>
                  <Typography variant="caption" fontWeight={800} color="text.secondary" display="block" sx={{ mb: 1 }}>
                    PROVISION PARAMETER
                  </Typography>
                  <Box component="form" onSubmit={handleCreateKey} sx={{ display: 'flex', gap: 1 }}>
                    <TextField
                      size="small"
                      label="Key Name"
                      required
                      value={newConfigKey}
                      onChange={(e) => setNewConfigKey(e.target.value)}
                      sx={{ flex: 1 }}
                      slotProps={{ input: { sx: { borderRadius: 2, fontFamily: 'monospace', fontSize: '0.8rem' } } }}
                    />
                    <TextField
                      size="small"
                      label="Value"
                      value={newConfigVal}
                      onChange={(e) => setNewConfigVal(e.target.value)}
                      sx={{ flex: 1 }}
                      slotProps={{ input: { sx: { borderRadius: 2, fontFamily: 'monospace', fontSize: '0.8rem' } } }}
                    />
                    <IconButton
                      type="submit"
                      color="primary"
                      disabled={isConfigLoading}
                      sx={{ border: 1, borderColor: 'divider', borderRadius: 2 }}
                    >
                      <AddIcon />
                    </IconButton>
                  </Box>
                </Paper>

                {/* Quick Exports */}
                <Divider sx={{ my: 0.5 }} />
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <Button variant="outlined" size="small" startIcon={<ExportIcon />} onClick={() => handleCSVExport('employees')} sx={{ flex: 1, borderRadius: 2, textTransform: 'none', fontWeight: 700, fontSize: '0.78rem' }}>Employees</Button>
                  <Button variant="outlined" size="small" startIcon={<ExportIcon />} onClick={() => handleCSVExport('sites')} sx={{ flex: 1, borderRadius: 2, textTransform: 'none', fontWeight: 700, fontSize: '0.78rem' }}>Sites</Button>
                </Box>
              </Box>
            )}
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
