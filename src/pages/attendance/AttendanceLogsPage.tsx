import { useState, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography as MuiTypography,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  MenuItem,
  Grid,
  CircularProgress,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Collapse,
  LinearProgress,
  Divider,
} from '@mui/material';
import {
  CalendarMonth as DateIcon,
  Login as CheckInIcon,
  Logout as CheckOutIcon,
  Verified as VerifiedIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  KeyboardArrowDown as KeyboardArrowDownIcon,
  KeyboardArrowUp as KeyboardArrowUpIcon,
  LocationOn as LocationIcon,
  Smartphone as PhoneIcon,
  AccessTime as TimeIcon,
  Search as SearchIcon,
  FilterList as FilterListIcon,
  RotateLeft as ClearIcon,
  Download as ExportIcon,
  Fingerprint as FaceIcon,
  GpsFixed as GpsIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { format } from 'date-fns';

import { AttendanceService } from '../../api/attendance.service';
import { EmployeeService } from '../../api/employee.service';
import { SiteService } from '../../api/site.service';
import { useAuthStore } from '../../stores/auth.store';

const Typography = MuiTypography as any;
const MapContainerAny = MapContainer as any;
const TileLayerAny = TileLayer as any;
const MarkerAny = Marker as any;
const CircleAny = Circle as any;

// Verification marker icon creator for Leaflet
const createMarkerIcon = (color: string) => {
  const markerHtml = `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2ZM12 11.5C10.62 11.5 9.5 10.38 9.5 9C9.5 7.62 10.62 6.5 12 6.5C13.38 6.5 14.5 7.62 14.5 9C14.5 10.38 13.38 11.5 12 11.5Z" 
            fill="${color}" stroke="white" stroke-width="1.5"/>
    </svg>
  `;
  return L.divIcon({
    className: 'custom-marker-icon',
    html: markerHtml,
    iconSize: [32, 32],
    iconAnchor: [16, 32]
  });
};

// Map Resizer component to ensure Leaflet renders correctly when parent container expands
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 250);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

// Zod schema for Manual/Edit log entries
const manualLogSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  siteId: z.string().min(1, 'Site is required'),
  punchType: z.enum(['IN', 'OUT']),
  punchTime: z.string().min(1, 'Date and time are required'),
  latitude: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
    z.number().optional()
  ),
  longitude: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
    z.number().optional()
  ),
});

type ManualLogSchema = z.infer<typeof manualLogSchema>;

export default function AttendanceLogsPage() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // State Management
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [logToEdit, setLogToEdit] = useState<any | null>(null);
  const [logToDelete, setLogToDelete] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Filters State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSiteId, setFilterSiteId] = useState('');
  const [filterPunchType, setFilterPunchType] = useState('');
  const [filterGeofence, setFilterGeofence] = useState('');
  const [filterFaceMatch, setFilterFaceMatch] = useState('');
  const [filterDatePreset, setFilterDatePreset] = useState('ALL'); // TODAY, YESTERDAY, 7DAYS, ALL
  const [isExporting, setIsExporting] = useState(false);

  // React Hook Form
  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<ManualLogSchema>({
    resolver: zodResolver(manualLogSchema) as any,
    defaultValues: {
      employeeId: '',
      siteId: '',
      punchType: 'IN',
      punchTime: '',
      latitude: undefined,
      longitude: undefined,
    },
  });

  const manualSiteId = watch('siteId');

  // Date range parameters calculated based on filterDatePreset to bypass 24h backend default limit
  const dateRangeParams = useMemo(() => {
    const now = new Date();
    switch (filterDatePreset) {
      case 'TODAY': {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        return { start: start.toISOString(), end: end.toISOString() };
      }
      case 'YESTERDAY': {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        return { start: start.toISOString(), end: end.toISOString() };
      }
      case '7DAYS': {
        const start = new Date();
        start.setDate(now.getDate() - 7);
        return { start: start.toISOString(), end: now.toISOString() };
      }
      case 'ALL':
      default: {
        const start = new Date(2020, 0, 1);
        return { start: start.toISOString(), end: now.toISOString() };
      }
    }
  }, [filterDatePreset]);

  // Queries — fetch ALL logs for the selected date range
  // Backend PageRequestDto: page is 1-indexed, limit max = 100
  const { data, isLoading } = useQuery({
    queryKey: ['attendance-logs', dateRangeParams],
    queryFn: () => AttendanceService.getLogs({
      page: 1,
      limit: 100,
      start: dateRangeParams.start,
      end: dateRangeParams.end,
    }),
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => EmployeeService.getEmployees(),
  });

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: () => SiteService.getSites(),
  });

  // Backend returns ApiResponse<List> — interceptor unwraps res.data → { success, data: [...], meta }
  // So 'data' here is { success, data: AttendanceLogDto[], meta }
  const rawLogs = useMemo(() => {
    const payload = data as any;
    // Handle both: paginated { data: [...] } and direct array
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }, [data]) as any[];

  const employees = useMemo(() => {
    const payload = employeesData as any;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }, [employeesData]);

  const sites = useMemo(() => {
    const payload = sitesData as any;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }, [sitesData]);

  const sitesMap = useMemo(() => Object.fromEntries(sites.map((s: any) => [s.id, s])), [sites]);


  // Sync manual coordinate default when site changes
  useEffect(() => {
    if (manualSiteId && !logToEdit) {
      const selectedSite = sitesMap[manualSiteId];
      if (selectedSite) {
        setValue('latitude', selectedSite.latitude);
        setValue('longitude', selectedSite.longitude);
      }
    }
  }, [manualSiteId, sitesMap, logToEdit, setValue]);

  // Date preset ranges filter calculations
  const filteredLogs = useMemo(() => {
    let result = [...rawLogs];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (log) =>
          log.employeeName?.toLowerCase().includes(q) ||
          log.siteName?.toLowerCase().includes(q)
      );
    }

    // Site filter
    if (filterSiteId) {
      result = result.filter((log) => log.siteId === filterSiteId);
    }

    // Punch Type filter
    if (filterPunchType) {
      result = result.filter((log) => log.punchType === filterPunchType);
    }

    // Geofence status filter
    if (filterGeofence) {
      const isInside = filterGeofence === 'INSIDE';
      result = result.filter((log) => log.insideGeofence === isInside);
    }

    // Face match status filter
    if (filterFaceMatch) {
      if (filterFaceMatch === 'MANUAL') {
        result = result.filter((log) => log.faceMatchScore == null);
      } else if (filterFaceMatch === 'SUSPICIOUS') {
        result = result.filter((log) => log.faceMatchScore != null && log.faceMatchScore < 0.75);
      } else if (filterFaceMatch === 'VERIFIED') {
        result = result.filter((log) => log.faceMatchScore != null && log.faceMatchScore >= 0.75);
      }
    }

    // Date Presets filter
    const now = new Date();
    result = result.filter((log) => {
      if (!log.punchTime) return false;
      const logDate = new Date(log.punchTime);
      
      switch (filterDatePreset) {
        case 'TODAY':
          return logDate.toDateString() === now.toDateString();
        case 'YESTERDAY':
          const yesterday = new Date(now);
          yesterday.setDate(now.getDate() - 1);
          return logDate.toDateString() === yesterday.toDateString();
        case '7DAYS':
          const sevenDaysAgo = new Date(now);
          sevenDaysAgo.setDate(now.getDate() - 7);
          return logDate >= sevenDaysAgo;
        case 'ALL':
        default:
          return true;
      }
    });

    return result;
  }, [rawLogs, searchQuery, filterSiteId, filterPunchType, filterGeofence, filterFaceMatch, filterDatePreset]);

  // Aggregate KPI stats
  const kpiStats = useMemo(() => {
    const todayLogs = rawLogs.filter((log) => {
      if (!log.punchTime) return false;
      return new Date(log.punchTime).toDateString() === new Date().toDateString();
    });

    const totalToday = todayLogs.length;
    const checkIns = todayLogs.filter((l) => l.punchType === 'IN').length;
    const checkOuts = todayLogs.filter((l) => l.punchType === 'OUT').length;
    
    const geofenceCompliance = totalToday > 0 
      ? Math.round((todayLogs.filter((l) => l.insideGeofence).length / totalToday) * 100) 
      : 100;

    const scoredLogs = todayLogs.filter((l) => l.faceMatchScore != null);
    const avgFaceMatch = scoredLogs.length > 0
      ? Math.round((scoredLogs.reduce((acc, curr) => acc + curr.faceMatchScore, 0) / scoredLogs.length) * 100)
      : 0;

    const activeSites = new Set(todayLogs.map((l) => l.siteId)).size;

    return {
      totalToday,
      checkIns,
      checkOuts,
      geofenceCompliance,
      avgFaceMatch,
      activeSites,
    };
  }, [rawLogs]);

  // Pagination Handlers
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Export CSV handler
  const handleExport = async () => {
    setIsExporting(true);
    try {
      const filters = {
        siteId: filterSiteId || undefined,
        start: filterDatePreset === 'TODAY' ? new Date(new Date().setHours(0,0,0,0)).toISOString() : undefined,
      };
      const res: any = await AttendanceService.exportAttendance('ATTENDANCE', filters);
      const downloadUrl = res?.data?.downloadUrl || (res as any)?.downloadUrl;
      if (downloadUrl) {
        window.open(downloadUrl, '_blank');
      } else {
        alert('Export successfully processed, check admin exports panel.');
      }
    } catch (err: any) {
      console.error('Export failed', err);
      alert('Failed to export data: ' + (err.message || 'Server error'));
    } finally {
      setIsExporting(false);
    }
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setFilterSiteId('');
    setFilterPunchType('');
    setFilterGeofence('');
    setFilterFaceMatch('');
    setFilterDatePreset('ALL');
  };

  // Add / Edit Handlers
  const handleAddClick = () => {
    reset({
      employeeId: '',
      siteId: '',
      punchType: 'IN',
      punchTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
      latitude: undefined,
      longitude: undefined,
    });
    setLogToEdit(null);
    setApiError(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (log: any) => {
    reset({
      employeeId: log.employeeId || '',
      siteId: log.siteId || '',
      punchType: log.punchType || 'IN',
      punchTime: log.punchTime ? format(new Date(log.punchTime), "yyyy-MM-dd'T'HH:mm") : '',
      latitude: log.latitude || undefined,
      longitude: log.longitude || undefined,
    });
    setLogToEdit(log);
    setApiError(null);
    setIsFormOpen(true);
  };

  const onFormSubmit = async (formData: ManualLogSchema) => {
    setIsSubmitting(true);
    setApiError(null);
    try {
      const payload = {
        employeeId: formData.employeeId,
        siteId: formData.siteId,
        punchType: formData.punchType,
        punchTime: new Date(formData.punchTime).toISOString(),
        latitude: formData.latitude,
        longitude: formData.longitude,
      };

      if (logToEdit) {
        await AttendanceService.updateManualLog(logToEdit.id, payload);
      } else {
        await AttendanceService.createManualLog(payload);
      }

      queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
      setIsFormOpen(false);
      setLogToEdit(null);
    } catch (err: any) {
      console.error('Failed to save attendance punch log', err);
      setApiError(err.response?.data?.message || err.message || 'Failed to save attendance log.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!logToDelete) return;
    setIsDeleting(true);
    try {
      await AttendanceService.deleteManualLog(logToDelete.id);
      queryClient.invalidateQueries({ queryKey: ['attendance-logs'] });
      setLogToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete attendance log', err);
      alert('Failed to delete attendance log: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsDeleting(false);
    }
  };

  const paginatedRows = useMemo(() => {
    return filteredLogs.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);
  }, [filteredLogs, page, rowsPerPage]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={850} gutterBottom sx={{ letterSpacing: '-0.5px' }}>
            Attendance Operations Hub
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Real-time geofenced verification, facial biometrics diagnostics, and telemetry analysis
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Button
            variant="outlined"
            startIcon={isExporting ? <CircularProgress size={16} /> : <ExportIcon />}
            onClick={handleExport}
            disabled={isExporting}
            sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 700, px: 2.5 }}
          >
            Export Logs
          </Button>
          {isSuperAdmin && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddClick}
              sx={{ borderRadius: 2.5, px: 3, py: 1, textTransform: 'none', fontWeight: 700, boxShadow: theme.shadows[2] }}
            >
              Add Manual Punch
            </Button>
          )}
        </Box>
      </Box>

      {/* Interactive KPI Metrics Panel */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          {
            title: "Today's Clock-Ins",
            value: kpiStats.totalToday,
            subtitle: `${kpiStats.checkIns} IN / ${kpiStats.checkOuts} OUT`,
            color: theme.palette.primary.main,
            icon: <CheckInIcon />,
            onClick: () => {
              setFilterDatePreset('TODAY');
              setFilterPunchType('');
            }
          },
          {
            title: 'Geofence Compliance',
            value: `${kpiStats.geofenceCompliance}%`,
            subtitle: 'Inside designated perimeter',
            color: kpiStats.geofenceCompliance > 90 ? theme.palette.success.main : theme.palette.warning.main,
            icon: <LocationIcon />,
            onClick: () => {
              setFilterDatePreset('TODAY');
              setFilterGeofence('OUTSIDE');
            }
          },
          {
            title: 'Avg Face Match Score',
            value: kpiStats.avgFaceMatch > 0 ? `${kpiStats.avgFaceMatch}%` : 'N/A',
            subtitle: 'Biometric confidence score',
            color: kpiStats.avgFaceMatch > 80 ? theme.palette.success.main : theme.palette.error.main,
            icon: <FaceIcon />,
            onClick: () => {
              setFilterDatePreset('TODAY');
              setFilterFaceMatch('SUSPICIOUS');
            }
          },
          {
            title: 'Active Sites Today',
            value: kpiStats.activeSites,
            subtitle: `Out of ${sites.length} operational sites`,
            color: theme.palette.info.main,
            icon: <GpsIcon />,
            onClick: () => {
              setFilterDatePreset('TODAY');
            }
          }
        ].map((card, idx) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={idx}>
            <Paper
              variant="outlined"
              onClick={card.onClick}
              sx={{
                p: 2.5,
                borderRadius: 4,
                borderColor: alpha(card.color, 0.2),
                backgroundColor: alpha(card.color, 0.03),
                cursor: 'pointer',
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                display: 'flex',
                alignItems: 'center',
                gap: 2.5,
                '&:hover': {
                  borderColor: card.color,
                  backgroundColor: alpha(card.color, 0.06),
                  transform: 'translateY(-3px)',
                  boxShadow: `0 8px 24px ${alpha(card.color, 0.12)}`,
                }
              }}
            >
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 3,
                  backgroundColor: alpha(card.color, 0.1),
                  color: card.color,
                  display: 'flex'
                }}
              >
                {card.icon}
              </Box>
              <Box>
                <Typography variant="h4" fontWeight={900} sx={{ color: card.color, lineHeight: 1.1, letterSpacing: '-1px' }}>
                  {card.value}
                </Typography>
                <Typography variant="subtitle2" fontWeight={700} color="text.primary" sx={{ mt: 0.5 }}>
                  {card.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {card.subtitle}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Advanced Filters Panel */}
      <Paper
        variant="outlined"
        sx={{
          p: 3,
          borderRadius: 4,
          mb: 4,
          backgroundColor: alpha(theme.palette.background.paper, 0.8),
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
          <FilterListIcon color="action" />
          <Typography variant="subtitle1" fontWeight={750}>
            Filter & Telemetry Query Panel
          </Typography>
        </Box>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 3 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search by Employee or Site Name"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: <SearchIcon color="action" sx={{ mr: 1, fontSize: 20 }} />,
                  sx: { borderRadius: 2 }
                }
              }}
            />
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 2 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Select Site"
              value={filterSiteId}
              onChange={(e) => setFilterSiteId(e.target.value)}
              slotProps={{ input: { sx: { borderRadius: 2 } } }}
            >
              <MenuItem value="">All Sites</MenuItem>
              {sites.map((s: any) => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 1.5 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Punch Type"
              value={filterPunchType}
              onChange={(e) => setFilterPunchType(e.target.value)}
              slotProps={{ input: { sx: { borderRadius: 2 } } }}
            >
              <MenuItem value="">All Punches</MenuItem>
              <MenuItem value="IN">CHECK-IN</MenuItem>
              <MenuItem value="OUT">CHECK-OUT</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 4, md: 1.5 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Geofence Status"
              value={filterGeofence}
              onChange={(e) => setFilterGeofence(e.target.value)}
              slotProps={{ input: { sx: { borderRadius: 2 } } }}
            >
              <MenuItem value="">All Statuses</MenuItem>
              <MenuItem value="INSIDE">Inside Perimeter</MenuItem>
              <MenuItem value="OUTSIDE">Outside Boundary</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 6, sm: 6, md: 2 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Biometric Verification"
              value={filterFaceMatch}
              onChange={(e) => setFilterFaceMatch(e.target.value)}
              slotProps={{ input: { sx: { borderRadius: 2 } } }}
            >
              <MenuItem value="">All Methods</MenuItem>
              <MenuItem value="VERIFIED">High Confidence (&ge; 75%)</MenuItem>
              <MenuItem value="SUSPICIOUS">Suspicious Mismatch (&lt; 75%)</MenuItem>
              <MenuItem value="MANUAL">Manual / Bypassed Face Match</MenuItem>
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, sm: 6, md: 2 }}>
            <TextField
              select
              fullWidth
              size="small"
              label="Date Range Preset"
              value={filterDatePreset}
              onChange={(e) => setFilterDatePreset(e.target.value)}
              slotProps={{ input: { sx: { borderRadius: 2 } } }}
            >
              <MenuItem value="TODAY">Today Only</MenuItem>
              <MenuItem value="YESTERDAY">Yesterday</MenuItem>
              <MenuItem value="7DAYS">Last 7 Days</MenuItem>
              <MenuItem value="ALL">All Records (Cached)</MenuItem>
            </TextField>
          </Grid>
        </Grid>
        <Box sx={{ mt: 2.5, display: 'flex', justifyItems: 'flex-end', justifyContent: 'flex-end', gap: 1.5 }}>
          <Button
            size="small"
            color="inherit"
            startIcon={<ClearIcon />}
            onClick={handleResetFilters}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Clear Queries
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center', ml: 'auto' }}>
            Showing <strong>{filteredLogs.length}</strong> matching attendance logs
          </Typography>
        </Box>
      </Paper>

      {/* Custom expandable data logs table */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          border: `1px solid ${theme.palette.divider}`,
          overflow: 'hidden',
          backgroundColor: theme.palette.background.paper,
        }}
      >
        {isLoading ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 2 }}>
            <CircularProgress />
            <Typography variant="body2" color="text.secondary">Fetching verification logs from telemetry service...</Typography>
          </Box>
        ) : filteredLogs.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 8 }}>
            <LocationIcon sx={{ fontSize: 52, color: theme.palette.text.disabled, mb: 1.5 }} />
            <Typography variant="h6" fontWeight={700}>No Logs Found</Typography>
            <Typography variant="body2" color="text.secondary">Try clearing filters or search query parameters.</Typography>
          </Box>
        ) : (
          <TableContainer>
            <Table size="medium">
              <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.03) }}>
                <TableRow>
                  <TableCell style={{ width: 40 }} />
                  <TableCell sx={{ fontWeight: 750 }}>Punch Time</TableCell>
                  <TableCell sx={{ fontWeight: 750 }}>Employee</TableCell>
                  <TableCell sx={{ fontWeight: 750 }}>Site</TableCell>
                  <TableCell sx={{ fontWeight: 750 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 750 }}>Geofence</TableCell>
                  <TableCell sx={{ fontWeight: 750 }}>Biometrics Match</TableCell>
                  {isSuperAdmin && <TableCell sx={{ fontWeight: 750 }} align="center">Actions</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {paginatedRows.map((log) => {
                  const site = sitesMap[log.siteId];
                  return (
                    <AttendanceRow
                      key={log.id}
                      log={log}
                      site={site}
                      theme={theme}
                      isSuperAdmin={isSuperAdmin}
                      onEdit={handleEditClick}
                      onDelete={(l) => setLogToDelete(l)}
                    />
                  );
                })}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={filteredLogs.length}
              page={page}
              onPageChange={handleChangePage}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleChangeRowsPerPage}
              rowsPerPageOptions={[5, 10, 25, 50]}
            />
          </TableContainer>
        )}
      </Paper>

      {/* Manual Add / Edit Dialog */}
      <Dialog
        open={isFormOpen}
        onClose={() => !isSubmitting && setIsFormOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 4 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pt: 3, pb: 1 }}>
          {logToEdit ? 'Modify Attendance Dispatch Log' : 'Provision Manual Attendance Record'}
        </DialogTitle>
        <DialogContent dividers sx={{ py: 3 }}>
          {apiError && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {apiError}
            </Alert>
          )}
          <Box component="form" id="manual-log-form" onSubmit={handleSubmit(onFormSubmit as any)}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  <Controller
                    name="employeeId"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        select
                        label="Select Employee"
                        variant="outlined"
                        error={!!errors.employeeId}
                        helperText={errors.employeeId?.message}
                        slotProps={{ input: { sx: { borderRadius: 2 } } }}
                      >
                        <MenuItem value=""><em>Select Employee</em></MenuItem>
                        {employees.map((emp: any) => (
                          <MenuItem key={emp.id} value={emp.id}>
                            {emp.fullName} ({emp.role})
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />

                  <Controller
                    name="siteId"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        select
                        label="Select Site"
                        variant="outlined"
                        error={!!errors.siteId}
                        helperText={errors.siteId?.message}
                        slotProps={{ input: { sx: { borderRadius: 2 } } }}
                      >
                        <MenuItem value=""><em>Select Site</em></MenuItem>
                        {sites.map((site: any) => (
                          <MenuItem key={site.id} value={site.id}>
                            {site.name}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Controller
                        name="punchType"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            select
                            label="Punch Type"
                            variant="outlined"
                            error={!!errors.punchType}
                            helperText={errors.punchType?.message}
                            slotProps={{ input: { sx: { borderRadius: 2 } } }}
                          >
                            <MenuItem value="IN">CHECK-IN</MenuItem>
                            <MenuItem value="OUT">CHECK-OUT</MenuItem>
                          </TextField>
                        )}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Controller
                        name="punchTime"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            type="datetime-local"
                            label="Punch Time"
                            variant="outlined"
                            error={!!errors.punchTime}
                            helperText={errors.punchTime?.message}
                            slotProps={{
                              input: { sx: { borderRadius: 2 } },
                              inputLabel: { shrink: true }
                            }}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>

                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>
                    Override GPS Coordinates
                  </Typography>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6 }}>
                      <Controller
                        name="latitude"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            type="number"
                            label="Latitude Override"
                            variant="outlined"
                            slotProps={{
                              htmlInput: { step: 'any' },
                              input: { sx: { borderRadius: 2 } }
                            }}
                          />
                        )}
                      />
                    </Grid>
                    <Grid size={{ xs: 6 }}>
                      <Controller
                        name="longitude"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            fullWidth
                            type="number"
                            label="Longitude Override"
                            variant="outlined"
                            slotProps={{
                              htmlInput: { step: 'any' },
                              input: { sx: { borderRadius: 2 } }
                            }}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </Box>
              </Grid>

              {/* Interactive map coordinates picker for manual punch */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" fontWeight={750} gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <LocationIcon fontSize="inherit" color="primary" /> Pin Coordinates Map
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Select a site to view coordinates. Drag or click on the map to manually override target punch coordinates.
                </Typography>
                <Box
                  sx={{
                    height: 330,
                    width: '100%',
                    borderRadius: 3,
                    overflow: 'hidden',
                    border: `1px solid ${theme.palette.divider}`,
                    position: 'relative',
                  }}
                >
                  {manualSiteId && sitesMap[manualSiteId] ? (
                    (() => {
                      const selectedSite = sitesMap[manualSiteId];
                      const lat = watch('latitude') || selectedSite.latitude;
                      const lng = watch('longitude') || selectedSite.longitude;

                      return (
                        <MapContainerAny
                          center={[selectedSite.latitude, selectedSite.longitude]}
                          zoom={15}
                          style={{ height: '100%', width: '100%' }}
                        >
                          <TileLayerAny
                            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          <CircleAny
                            center={[selectedSite.latitude, selectedSite.longitude]}
                            radius={selectedSite.radius || 150}
                            pathOptions={{ color: theme.palette.primary.main, fillOpacity: 0.1 }}
                          />
                          <MarkerAny
                            position={[lat, lng]}
                            icon={createMarkerIcon(theme.palette.primary.main)}
                            draggable
                            eventHandlers={{
                              dragend: (e: any) => {
                                const marker = e.target;
                                const position = marker.getLatLng();
                                setValue('latitude', position.lat);
                                setValue('longitude', position.lng);
                              }
                            }}
                          />
                          <MapResizer />
                        </MapContainerAny>
                      );
                    })()
                  ) : (
                    <Box sx={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 1, backgroundColor: alpha(theme.palette.primary.main, 0.01) }}>
                      <LocationIcon sx={{ fontSize: 44, color: theme.palette.text.disabled }} />
                      <Typography variant="body2" color="text.secondary">Select site to show interactive picker map</Typography>
                    </Box>
                  )}
                </Box>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2.5, gap: 1 }}>
          <Button onClick={() => setIsFormOpen(false)} color="inherit" disabled={isSubmitting} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="manual-log-form"
            variant="contained"
            disabled={isSubmitting}
            sx={{ borderRadius: 2, px: 4, fontWeight: 700 }}
          >
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : logToEdit ? 'Save Override Changes' : 'Record Punch'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!logToDelete}
        onClose={() => !isDeleting && setLogToDelete(null)}
        slotProps={{
          paper: {
            sx: { borderRadius: 3, p: 1 }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Revoke Verification Log</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete the attendance punch log for <strong>{logToDelete?.employeeName}</strong>?
            This will remove the entry from verification logs permanently.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setLogToDelete(null)} color="inherit" disabled={isDeleting} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={isDeleting}
            sx={{ borderRadius: 2 }}
          >
            {isDeleting ? <CircularProgress size={24} color="inherit" /> : 'Confirm Revoke'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Expandable Table Row component handling inline Leaflet rendering & telemetry diagnostics
function AttendanceRow({ log, site, theme, isSuperAdmin, onEdit, onDelete }: {
  log: any;
  site: any;
  theme: any;
  isSuperAdmin: boolean;
  onEdit: (log: any) => void;
  onDelete: (log: any) => void;
}) {
  const [open, setOpen] = useState(false);

  // Math sync latency logic
  const syncLatencySec = useMemo(() => {
    if (!log.punchTime || !log.createdAt) return 0;
    const diff = Math.abs(new Date(log.createdAt).getTime() - new Date(log.punchTime).getTime());
    return Math.round(diff / 1000);
  }, [log]);

  const syncLatencyText = useMemo(() => {
    if (syncLatencySec < 10) return 'Real-time (<10s)';
    if (syncLatencySec < 60) return `Real-time (${syncLatencySec}s)`;
    const mins = Math.round(syncLatencySec / 60);
    if (mins < 60) return `${mins}m Delay (Cached Punch)`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m Delay (Offline Sync)`;
  }, [syncLatencySec]);

  // Face Match Score details
  const faceMatchPercent = log.faceMatchScore != null ? Math.round(log.faceMatchScore * 100) : null;
  const isFaceMatchValid = faceMatchPercent != null && faceMatchPercent >= 75;

  // GPS precision accuracy styling
  const getAccuracyColor = (acc: number) => {
    if (acc <= 5) return theme.palette.success.main;
    if (acc <= 15) return theme.palette.warning.main;
    return theme.palette.error.main;
  };

  return (
    <>
      <TableRow hover sx={{ '& > *': { borderBottom: 'unset' } }}>
        <TableCell>
          <IconButton size="small" onClick={() => setOpen(!open)}>
            {open ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
          </IconButton>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <DateIcon fontSize="small" color="action" />
            <Box>
              <Typography variant="body2" fontWeight={600}>
                {log.punchTime ? format(new Date(log.punchTime), 'MMM dd, HH:mm') : '—'}
              </Typography>
              {syncLatencySec > 60 && (
                <Chip label="OFFLINE" size="small" color="warning" sx={{ height: 16, fontSize: '0.6rem', fontWeight: 700, borderRadius: 0.5, mt: 0.2 }} />
              )}
            </Box>
          </Box>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Avatar
              sx={{
                width: 32,
                height: 32,
                fontSize: '0.8rem',
                bgcolor: alpha(theme.palette.primary.main, 0.08),
                color: theme.palette.primary.main,
                fontWeight: 700,
              }}
            >
              {log.employeeName ? log.employeeName.charAt(0) : 'E'}
            </Avatar>
            <Typography variant="body2" fontWeight={600}>
              {log.employeeName || 'Unknown Employee'}
            </Typography>
          </Box>
        </TableCell>
        <TableCell>
          <Typography variant="body2" fontWeight={500}>{log.siteName || '—'}</Typography>
        </TableCell>
        <TableCell>
          <Chip
            icon={log.punchType === 'IN' ? <CheckInIcon sx={{ fontSize: '0.9rem !important' }} /> : <CheckOutIcon sx={{ fontSize: '0.9rem !important' }} />}
            label={log.punchType === 'IN' ? 'CHECK-IN' : 'CHECK-OUT'}
            size="small"
            color={log.punchType === 'IN' ? 'success' : 'warning'}
            variant="outlined"
            sx={{ fontWeight: 700, borderRadius: 1.5, fontSize: '0.72rem' }}
          />
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
            <Chip
              label={log.insideGeofence ? 'INSIDE' : 'OUTSIDE'}
              size="small"
              color={log.insideGeofence ? 'success' : 'error'}
              sx={{ fontSize: '0.68rem', fontWeight: 800, borderRadius: 1 }}
            />
            {log.insideGeofence && <VerifiedIcon color="success" sx={{ fontSize: 16 }} />}
          </Box>
        </TableCell>
        <TableCell>
          {faceMatchPercent != null ? (
            <Chip
              icon={<FaceIcon sx={{ fontSize: '0.9rem !important' }} />}
              label={`${faceMatchPercent}% MATCH`}
              size="small"
              color={isFaceMatchValid ? 'success' : 'error'}
              sx={{ fontWeight: 700, borderRadius: 1.5, fontSize: '0.72rem' }}
            />
          ) : (
            <Chip
              label="MANUAL BYPASS"
              size="small"
              variant="outlined"
              sx={{ fontWeight: 650, borderRadius: 1.5, fontSize: '0.68rem', borderStyle: 'dashed' }}
            />
          )}
        </TableCell>
        {isSuperAdmin && (
          <TableCell align="center">
            <Box sx={{ display: 'flex', gap: 0.5, justifyContent: 'center' }}>
              <Tooltip title="Edit Punch">
                <IconButton size="small" color="primary" onClick={() => onEdit(log)}>
                  <EditIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Delete/Revoke Log">
                <IconButton size="small" color="error" onClick={() => onDelete(log)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </TableCell>
        )}
      </TableRow>

      {/* Expandable row containing interactive map overlay & diagnostics */}
      <TableRow>
        <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={isSuperAdmin ? 8 : 7}>
          <Collapse in={open} timeout="auto" unmountOnExit>
            <Box sx={{ py: 3, px: 2, borderLeft: `4px solid ${log.insideGeofence ? theme.palette.success.main : theme.palette.error.main}`, backgroundColor: alpha(theme.palette.primary.main, 0.005) }}>
              <Typography variant="subtitle2" fontWeight={850} color="text.secondary" gutterBottom sx={{ textTransform: 'uppercase', letterSpacing: 0.8, fontSize: '0.72rem', mb: 2 }}>
                Check-In Verification Telemetry
              </Typography>
              <Grid container spacing={3.5}>
                
                {/* 1. Biometric Diagnostic Details */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, height: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <FaceIcon color="primary" />
                      <Typography variant="subtitle2" fontWeight={750}>Biometric Recognition</Typography>
                    </Box>
                    {faceMatchPercent != null ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <Typography variant="body2" color="text.secondary">Verification Match Score:</Typography>
                          <Typography variant="h6" fontWeight={800} color={isFaceMatchValid ? 'success.main' : 'error.main'}>
                            {faceMatchPercent}%
                          </Typography>
                        </Box>
                        <LinearProgress
                          variant="determinate"
                          value={faceMatchPercent}
                          color={isFaceMatchValid ? 'success' : 'error'}
                          sx={{ height: 8, borderRadius: 2 }}
                        />
                        <Alert severity={isFaceMatchValid ? 'success' : 'error'} icon={false} sx={{ py: 0.5, borderRadius: 2, fontSize: '0.75rem' }}>
                          {isFaceMatchValid
                            ? 'Biometric verified: Selfie matches original enrollment.'
                            : 'Fails safety check: Similarity score below threshold.'}
                        </Alert>
                      </Box>
                    ) : (
                      <Box sx={{ textAlign: 'center', py: 2 }}>
                        <Typography variant="body2" color="text.secondary">
                          Face match was bypassed. Log entry registered manually by Administrator.
                        </Typography>
                      </Box>
                    )}
                  </Paper>
                </Grid>

                {/* 2. Geofence & GPS Accuracy Map */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <LocationIcon color="primary" />
                      <Typography variant="subtitle2" fontWeight={750}>Geofence GPS Coordinates</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1.5 }}>
                      <Typography variant="caption" color="text.secondary">
                        [{log.latitude?.toFixed(5)}, {log.longitude?.toFixed(5)}]
                      </Typography>
                      {log.accuracy != null && (
                        <Typography variant="caption" fontWeight={700} sx={{ color: getAccuracyColor(log.accuracy) }}>
                          GPS: ±{log.accuracy.toFixed(1)}m
                        </Typography>
                      )}
                    </Box>
                    
                    {/* Inline row map centered at punch coordinates */}
                    {log.latitude && log.longitude ? (
                      <Box
                        sx={{
                          height: 150,
                          width: '100%',
                          borderRadius: 2,
                          overflow: 'hidden',
                          border: `1px solid ${theme.palette.divider}`,
                          mt: 'auto',
                        }}
                      >
                        <MapContainerAny
                          center={[log.latitude, log.longitude]}
                          zoom={15}
                          zoomControl={false}
                          style={{ height: '100%', width: '100%' }}
                        >
                          <TileLayerAny
                            attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          />
                          {site && site.latitude && site.longitude && (
                            <CircleAny
                              center={[site.latitude, site.longitude]}
                              radius={site.radius || 150}
                              pathOptions={{ color: theme.palette.primary.main, fillOpacity: 0.08, weight: 1.5 }}
                            />
                          )}
                          <MarkerAny
                            position={[log.latitude, log.longitude]}
                            icon={createMarkerIcon(log.insideGeofence ? theme.palette.success.main : theme.palette.error.main)}
                          />
                          <MapResizer />
                        </MapContainerAny>
                      </Box>
                    ) : (
                      <Box sx={{ height: 150, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(theme.palette.primary.main, 0.01), borderRadius: 2 }}>
                        <Typography variant="caption" color="text.secondary">Coordinates unavailable</Typography>
                      </Box>
                    )}
                  </Paper>
                </Grid>

                {/* 3. Device Diagnostics & Synchronization timings */}
                <Grid size={{ xs: 12, md: 4 }}>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, height: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                      <PhoneIcon color="primary" />
                      <Typography variant="subtitle2" fontWeight={750}>Device Telemetry</Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.2 }}>
                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block">AUTHENTICATION TERMINAL</Typography>
                        <Typography variant="body2" fontWeight={600}>
                          {log.deviceInfo?.brand || log.deviceInfo?.manufacturer || 'Unknown'} {log.deviceInfo?.model || 'Device'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          OS Version: {log.deviceInfo?.osVersion || 'N/A'} (SDK {log.deviceInfo?.sdkVersion || 'N/A'})
                        </Typography>
                      </Box>
                      
                      <Divider />

                      <Box>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                          <TimeIcon fontSize="inherit" /> SYNCHRONIZATION LATENCY
                        </Typography>
                        <Typography variant="body2" fontWeight={700} color={syncLatencySec > 60 ? 'warning.main' : 'success.main'}>
                          {syncLatencyText}
                        </Typography>
                        {log.createdAt && log.punchTime && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Server registered: {format(new Date(log.createdAt), 'HH:mm:ss')} (Punch: {format(new Date(log.punchTime), 'HH:mm:ss')})
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Paper>
                </Grid>

              </Grid>
            </Box>
          </Collapse>
        </TableCell>
      </TableRow>
    </>
  );
}
