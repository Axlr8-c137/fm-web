import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography as MuiTypography,
  Paper,
  Tabs,
  Tab,
  Grid,
  Chip,
  Button,
  IconButton,
  Divider,
  alpha,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  Switch,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete,
  Tooltip,
  Avatar,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon,
  History as HistoryIcon,
  Layers as GeofenceIcon,
  MyLocation as MapIcon,
  Business as SiteIcon,
  Payments as PaymentsIcon,
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
  Block as BlockIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const Typography = MuiTypography as any;
const MapContainerAny = MapContainer as any;
const TileLayerAny = TileLayer as any;
const MarkerAny = Marker as any;
const CircleAny = Circle as any;
import { SiteService } from '../../api/site.service';
import { EmployeeService } from '../../api/employee.service';
import { AttendanceService } from '../../api/attendance.service';
import apiClient from '../../api/client';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { DataTable } from '../../components/common/DataTable';
import { GoogleMapPickerModal } from '../../components/common/GoogleMapPickerModal';
import { useAuthStore } from '../../stores/auth.store';
import type { GridColDef } from '@mui/x-data-grid';



// Validation Schema for Site Form
const siteSchema = z.object({
  name: z.string().min(1, 'Site name is required'),
  address: z.string().min(1, 'Address is required'),
  latitude: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
    z.number({ message: 'Latitude must be a number' })
      .min(-90, 'Latitude must be between -90 and 90')
      .max(90, 'Latitude must be between -90 and 90')
  ),
  longitude: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
    z.number({ message: 'Longitude must be a number' })
      .min(-180, 'Longitude must be between -180 and 180')
      .max(180, 'Longitude must be between -180 and 180')
  ),
  radius: z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : Number(val)),
    z.number({ message: 'Radius must be a number' })
      .min(10, 'Radius must be at least 10 meters')
      .max(1000, 'Radius cannot exceed 1000 meters')
  ),
  supervisorId: z.string().optional().or(z.literal('')),
  status: z.enum(['ACTIVE', 'INACTIVE']),
  isPayrollVisible: z.boolean().default(false),
});

type SiteSchema = z.infer<typeof siteSchema>;

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`site-tabpanel-${index}`}
      aria-labelledby={`site-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

const ROLE_COLORS: Record<string, 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' | 'default'> = {
  SUPER_ADMIN: 'secondary',
  ADMIN: 'primary',
  SUPERVISOR: 'warning',
  EMPLOYEE: 'info',
};

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

function MapEvents({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e: any) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function ChangeView({ center, radius }: { center: [number, number]; radius?: number }) {
  const map = useMap();
  React.useEffect(() => {
    if (center[0] && center[1] && !isNaN(center[0]) && !isNaN(center[1])) {
      try {
        const size = map.getSize();
        if (size.x > 0 && size.y > 0) {
          if (radius && radius > 0 && !isNaN(radius)) {
            const circle = L.circle(center, { radius });
            const bounds = circle.getBounds();
            map.fitBounds(bounds, { animate: true, padding: [20, 20] });
          } else {
            map.setView(center, 15, { animate: true });
          }
        } else {
          map.setView(center, 15, { animate: false });
        }
      } catch (e) {
        console.warn('Map boundary scaling failed:', e);
        try {
          map.setView(center, 15, { animate: false });
        } catch (setViewError) {
          console.error('Map fallback setView failed:', setViewError);
        }
      }
    }
  }, [center, radius, map]);
  return null;
}

function TriggerInvalidateSize() {
  const map = useMap();
  React.useEffect(() => {
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 400);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

export default function SiteDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const queryClient = useQueryClient();

  const [tabValue, setTabValue] = useState(0);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isMapPickerOpen, setIsMapPickerOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [addressOptions, setAddressOptions] = useState<any[]>([]);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [addressSearchQuery, setAddressSearchQuery] = useState('');


  const currentUser = useAuthStore((state) => state.user);
  const organizationId = currentUser?.organizationId;

  // Form Setup
  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<SiteSchema>({
    resolver: zodResolver(siteSchema) as any,
  });

  const watchLatitude = watch('latitude');
  const watchLongitude = watch('longitude');
  const watchRadius = watch('radius');

  const watchLat = watchLatitude || 18.5204;
  const watchLng = watchLongitude || 73.8567;
  const watchRad = watchRadius || 150;

  // Geocoding and Map helpers
  React.useEffect(() => {
    if (!addressSearchQuery || addressSearchQuery.length < 3) {
      setAddressOptions([]);
      return;
    }

    const delayDebounceFn = setTimeout(async () => {
      setIsAddressLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(addressSearchQuery)}`,
          {
            headers: {
              'Accept-Language': 'en',
            }
          }
        );
        const searchData = await response.json();
        if (Array.isArray(searchData)) {
          setAddressOptions(searchData);
          if (searchData.length > 0) {
            const topResult = searchData[0];
            setValue('latitude', Number(topResult.lat));
            setValue('longitude', Number(topResult.lon));
          }
        } else {
          setAddressOptions([]);
        }
      } catch (err) {
        console.error('Failed to fetch address suggestions', err);
        setAddressOptions([]);
      } finally {
        setIsAddressLoading(false);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [addressSearchQuery]);

  const lastGeocodedAddressRef = React.useRef('');

  // Queries
  const { data: siteData, isLoading: isSiteLoading } = useQuery({
    queryKey: ['site', id],
    queryFn: () => SiteService.getSiteById(id!),
    enabled: !!id,
  });

  const { data: employeesData, isLoading: isEmployeesLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: () => EmployeeService.getEmployees(),
  });

  const { data: siteAttendanceData, isLoading: isSiteAttendanceLoading } = useQuery({
    queryKey: ['site-attendance', id],
    queryFn: () => AttendanceService.getTodayAttendance(id!),
    enabled: !!id,
  });

  const { data: siteUpdatesResponse, isLoading: isSiteUpdatesLoading } = useQuery({
    queryKey: ['site-updates', id],
    queryFn: () => apiClient.get(`/site-updates/site/${id}`),
    enabled: !!id,
  });

  if (isSiteLoading || isEmployeesLoading || isSiteAttendanceLoading || isSiteUpdatesLoading) return <LoadingScreen />;

  const rawSite = siteData?.data;
  const employees = (employeesData as any)?.data || [];
  const siteAttendance = (siteAttendanceData as any)?.data || [];
  const siteUpdates = (siteUpdatesResponse as any)?.data || [];

  if (!rawSite) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" sx={{ mb: 2 }}>Site not found</Typography>
        <Button onClick={() => navigate('/sites')} startIcon={<BackIcon />} variant="contained">
          Back to Sites
        </Button>
      </Box>
    );
  }

  // Filter employees for this site
  const siteEmployees = employees.filter((emp: any) => emp.siteId === rawSite.id);
  const activeEmployees = siteEmployees.filter((emp: any) => emp.status === 'ACTIVE');
  const supervisor = siteEmployees.find((emp: any) => emp.role === 'SUPERVISOR');

  const supervisors = employees.filter((emp: any) => emp.role === 'SUPERVISOR');

  const site = {
    ...rawSite,
    employeeCount: activeEmployees.length,
    supervisorName: supervisor ? supervisor.fullName : 'Unassigned',
    supervisorId: supervisor ? supervisor.id : '',
  };

  const todayAttendanceRate = activeEmployees.length > 0
    ? `${Math.round((siteAttendance.length / activeEmployees.length) * 100)}%`
    : '0%';

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  const handleEditClick = () => {
    reset({
      name: site.name,
      address: site.address || '',
      latitude: site.latitude || undefined,
      longitude: site.longitude || undefined,
      radius: site.radius || 150,
      supervisorId: site.supervisorId || '',
      status: site.status,
      isPayrollVisible: site.isPayrollVisible || false,
    });
    setApiError(null);
    setIsEditOpen(true);
  };

  const handleCloseEdit = () => {
    setIsEditOpen(false);
    setApiError(null);
  };

  const parseDisplayName = (displayName: string) => {
    if (!displayName) return { main: '', secondary: '' };
    const parts = displayName.split(',');
    const main = parts[0] || '';
    const secondary = parts.slice(1).join(',').trim();
    return { main, secondary };
  };

  const geocodeCustomAddress = async (addr: string) => {
    if (!addr || addr.trim().length < 3) return;
    if (addr === lastGeocodedAddressRef.current) return;

    setIsAddressLoading(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(addr)}`,
        {
          headers: {
            'Accept-Language': 'en',
          }
        }
      );
      const searchData = await response.json();
      if (Array.isArray(searchData) && searchData.length > 0) {
        const topResult = searchData[0];
        setValue('latitude', Number(topResult.lat));
        setValue('longitude', Number(topResult.lon));
        lastGeocodedAddressRef.current = addr;
      }
    } catch (err) {
      console.error('Failed to geocode custom address', err);
    } finally {
      setIsAddressLoading(false);
    }
  };

  const reverseGeocode = async (lat: number, lon: number) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`
      );
      const reverseData = await response.json();
      if (reverseData && reverseData.display_name) {
        setValue('address', reverseData.display_name);
        lastGeocodedAddressRef.current = reverseData.display_name;
      }
    } catch (err) {
      console.error('Failed to reverse geocode', err);
    }
  };

  const handleMapClick = (lat: number, lon: number) => {
    setValue('latitude', lat);
    setValue('longitude', lon);
    reverseGeocode(lat, lon);
  };

  const handleSelectLocationFromPicker = (lat: number, lng: number, address: string) => {
    setValue('latitude', lat, { shouldValidate: true, shouldDirty: true });
    setValue('longitude', lng, { shouldValidate: true, shouldDirty: true });
    setValue('address', address, { shouldValidate: true, shouldDirty: true });
  };

  const onEditSubmit = async (formData: any) => {

    setIsSubmitting(true);
    setApiError(null);
    try {
      const sitePayload = {
        name: formData.name,
        address: formData.address || '',
        latitude: formData.latitude,
        longitude: formData.longitude,
        radius: formData.radius,
        status: formData.status,
        isPayrollVisible: formData.isPayrollVisible,
        organizationId: organizationId,
      };

      const response = await SiteService.updateSite(site.id, sitePayload);
      const savedSite = response?.data || response;

      // Handle Supervisor Reassignment
      const siteId = savedSite?.id || site.id;
      if (siteId) {
        // Clear previous supervisor if supervisor changed
        if (supervisor && String(supervisor.id) !== String(formData.supervisorId)) {
          await EmployeeService.updateEmployee(supervisor.id, {
            ...supervisor,
            siteId: null,
          });
        }

        // Set new supervisor
        if (formData.supervisorId) {
          const newSupervisor = employees.find((emp: any) => emp.id === formData.supervisorId);
          if (newSupervisor && newSupervisor.siteId !== siteId) {
            await EmployeeService.updateEmployee(newSupervisor.id, {
              ...newSupervisor,
              siteId: siteId,
            });
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['site', id] });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      handleCloseEdit();
    } catch (err: any) {
      console.error('Failed to update site', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to update site. Please try again.';
      setApiError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await SiteService.deactivateSite(site.id);
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      setIsDeleteOpen(false);
      navigate('/sites');
    } catch (err: any) {
      console.error('Failed to delete site', err);
      alert('Failed to delete site: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsDeleting(false);
    }
  };

  // Columns for the Employees DataTable
  const employeeColumns: GridColDef[] = [
    {
      field: 'fullName',
      headerName: 'Full Name',
      flex: 1.2,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'email',
      headerName: 'Email',
      flex: 1.2,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            {params.value || '-'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'phone',
      headerName: 'Phone',
      flex: 1,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'role',
      headerName: 'Role',
      width: 150,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Chip
            label={params.value?.replace('_', ' ')}
            color={ROLE_COLORS[params.value] || 'default'}
            size="small"
            sx={{ fontWeight: 700, borderRadius: 1.5, fontSize: '0.7rem' }}
          />
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Chip
            label={params.value}
            color={params.value === 'ACTIVE' ? 'success' : 'default'}
            size="small"
            variant="outlined"
            sx={{ fontWeight: 600, borderRadius: 1.5 }}
          />
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => navigate('/sites')} sx={{ backgroundColor: theme.palette.background.paper, boxShadow: theme.shadows[1] }}>
          <BackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" fontWeight={800}>
              {site.name}
            </Typography>
            <Chip
              label={site.status}
              color={site.status === 'ACTIVE' ? 'success' : 'default'}
              size="small"
              sx={{ fontWeight: 700, borderRadius: 1.5 }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <LocationIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {site.address || 'No address provided'}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          onClick={handleEditClick}
          sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 650, px: 3, mr: 1 }}
        >
          Edit Site
        </Button>
        <Button
          variant="contained"
          color="error"
          startIcon={<DeleteIcon />}
          onClick={() => setIsDeleteOpen(true)}
          sx={{ borderRadius: 2.5, textTransform: 'none', fontWeight: 650, px: 3 }}
        >
          Delete Site
        </Button>
      </Box>

      {/* Main Content */}
      <Paper
        elevation={0}
        sx={{
          borderRadius: 4,
          border: `1px solid ${theme.palette.divider}`,
          overflow: 'hidden',
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 1 }}>
          <Tabs
            value={tabValue}
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 700,
                minWidth: 120,
                fontSize: '0.95rem',
              }
            }}
          >
            <Tab label="Overview" />
            <Tab label="Geofence" />
            <Tab label="Employees" />
            <Tab label="Recent Updates" />
          </Tabs>
        </Box>

        <Box sx={{ px: 3, pb: 3 }}>
          <CustomTabPanel value={tabValue} index={0}>
            <Grid container spacing={4}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Site Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
                      SUPERVISOR
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>{site.supervisorName}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
                      CLIENT
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>{site.clientName || 'N/A'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
                      CONTACT
                    </Typography>
                    <Typography variant="body1" fontWeight={500}>{site.managerEmail || 'No email provided'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block', mb: 0.5 }}>
                      PAYROLL VISIBILITY
                    </Typography>
                    <Chip
                      label={site.isPayrollVisible ? 'ENABLED FOR SITE' : 'DISABLED FOR SITE'}
                      color={site.isPayrollVisible ? 'primary' : 'default'}
                      size="small"
                      sx={{ fontWeight: 700, borderRadius: 1 }}
                    />
                  </Box>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Key Metrics
                </Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  {[
                    {
                      label: 'Total Employees',
                      value: site.employeeCount,
                      icon: <PeopleIcon color="primary" />,
                      onClick: () => setTabValue(2)
                    },
                    {
                      label: 'Today Attendance',
                      value: todayAttendanceRate,
                      icon: <HistoryIcon color="success" />,
                      onClick: () => navigate('/attendance')
                    },
                    {
                      label: 'Geofence Status',
                      value: site.status === 'ACTIVE' ? 'Active' : 'Inactive',
                      icon: <GeofenceIcon color="info" />,
                      onClick: () => setTabValue(1)
                    },
                  ].map((stat, i) => (
                    <Grid size={{ xs: 6 }} key={i}>
                      <Paper
                        variant="outlined"
                        onClick={stat.onClick}
                        sx={{
                          p: 2,
                          borderRadius: 3,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          backgroundColor: alpha(theme.palette.primary.main, 0.01),
                          cursor: 'pointer',
                          transition: 'all 0.2s ease-in-out',
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.04),
                            borderColor: theme.palette.primary.main,
                            transform: 'translateY(-2px)',
                            boxShadow: theme.shadows[2],
                          },
                        }}
                      >
                        <Box sx={{ p: 1, borderRadius: 2, backgroundColor: alpha(theme.palette.background.paper, 0.8), display: 'flex', boxShadow: theme.shadows[1] }}>
                          {stat.icon}
                        </Box>
                        <Box>
                          <Typography variant="h6" fontWeight={700}>{stat.value}</Typography>
                          <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            </Grid>
          </CustomTabPanel>

          <CustomTabPanel value={tabValue} index={1}>
            <Grid container spacing={4}>
              <Grid size={{ xs: 12, md: 5 }}>
                <Typography variant="h6" fontWeight={700} gutterBottom sx={{ mb: 2 }}>
                  Geofence Boundary Info
                </Typography>
                <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block' }}>
                      TYPE
                    </Typography>
                    <Chip label="Circular Geofence" size="small" color="primary" sx={{ mt: 0.5, fontWeight: 700, borderRadius: 1 }} />
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block' }}>
                      LATITUDE
                    </Typography>
                    <Typography variant="body1" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
                      {site.latitude !== null && site.latitude !== undefined ? site.latitude : 'Not Configured'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block' }}>
                      LONGITUDE
                    </Typography>
                    <Typography variant="body1" fontWeight={600} sx={{ fontFamily: 'monospace' }}>
                      {site.longitude !== null && site.longitude !== undefined ? site.longitude : 'Not Configured'}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ display: 'block' }}>
                      RADIUS BOUNDARY
                    </Typography>
                    <Typography variant="body1" fontWeight={600}>
                      {site.radius !== null && site.radius !== undefined ? `${site.radius} meters` : 'Not Configured'}
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, md: 7 }}>
                {site.latitude !== null && site.latitude !== undefined && site.longitude !== null && site.longitude !== undefined && !isNaN(Number(site.latitude)) && !isNaN(Number(site.longitude)) ? (
                  <Box
                    sx={{
                      height: 320,
                      width: '100%',
                      borderRadius: 4,
                      overflow: 'hidden',
                      border: `1px solid ${theme.palette.divider}`,
                      position: 'relative',
                    }}
                  >
                    <MapContainerAny
                      center={[Number(site.latitude), Number(site.longitude)]}
                      zoom={15}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayerAny
                        attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <ChangeView center={[Number(site.latitude), Number(site.longitude)]} radius={Number(site.radius) || 150} />
                      <TriggerInvalidateSize />

                      <MarkerAny
                        position={[Number(site.latitude), Number(site.longitude)]}
                        icon={createMarkerIcon(theme.palette.primary.main)}
                      />
                      <CircleAny
                        center={[Number(site.latitude), Number(site.longitude)]}
                        radius={Number(site.radius) || 150}
                        pathOptions={{
                          color: theme.palette.primary.main,
                          fillColor: theme.palette.primary.main,
                          fillOpacity: 0.12,
                          weight: 2,
                          className: 'pulsing-geofence-circle'
                        }}
                      />
                    </MapContainerAny>
                  </Box>
                ) : (
                  <Box
                    sx={{
                      height: 320,
                      backgroundColor: alpha(theme.palette.primary.main, 0.02),
                      borderRadius: 4,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: `2px dashed ${alpha(theme.palette.primary.main, 0.15)}`,
                    }}
                  >
                    <LocationIcon sx={{ fontSize: 48, color: alpha(theme.palette.primary.main, 0.3), mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" fontWeight={600}>
                      Geofence Not Configured
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Edit site to set location coordinates and radius
                    </Typography>
                  </Box>
                )}
              </Grid>
            </Grid>
          </CustomTabPanel>

          <CustomTabPanel value={tabValue} index={2}>
            {siteEmployees.length > 0 ? (
              <DataTable
                rows={siteEmployees}
                columns={employeeColumns}
                getRowId={(row) => row.id}
                pageSize={5}
              />
            ) : (
              <Box sx={{ p: 4, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: 3 }}>
                <PeopleIcon sx={{ fontSize: 40, color: 'text.secondary', opacity: 0.5, mb: 1 }} />
                <Typography variant="body1" color="text.secondary" fontWeight={500}>
                  No employees are currently assigned to this site.
                </Typography>
              </Box>
            )}
          </CustomTabPanel>

          <CustomTabPanel value={tabValue} index={3}>
            {siteUpdates.length > 0 ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                {siteUpdates.map((update: any) => (
                  <Paper
                    key={update.id}
                    variant="outlined"
                    sx={{
                      p: 2.5,
                      borderRadius: 3.5,
                      borderColor: theme.palette.divider,
                      backgroundColor: theme.palette.background.paper,
                      transition: 'all 0.2s',
                      '&:hover': {
                        boxShadow: theme.shadows[1],
                      }
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ bgcolor: theme.palette.primary.main, width: 36, height: 36, fontSize: '0.9rem', fontWeight: 600 }}>
                          {update.employeeName?.split(' ').map((n: any) => n[0]).join('').toUpperCase() || 'U'}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight={750} sx={{ fontSize: '0.85rem' }}>
                            {update.employeeName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Field Officer / Supervisor
                          </Typography>
                        </Box>
                      </Box>
                      <Typography variant="caption" color="text.secondary" fontWeight={500}>
                        {new Date(update.recordedAt || update.createdAt).toLocaleString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Typography>
                    </Box>
                    <Typography variant="body2" color="text.primary" sx={{ lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {update.text}
                    </Typography>

                    {update.mediaUrls && update.mediaUrls.length > 0 && (
                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 2 }}>
                        {update.mediaUrls.map((url: string, idx: number) => (
                          <Box
                            key={idx}
                            component="img"
                            src={url}
                            alt={`Update attachment ${idx + 1}`}
                            sx={{
                              width: 120,
                              height: 120,
                              objectFit: 'cover',
                              borderRadius: 2,
                              border: `1px solid ${theme.palette.divider}`,
                              cursor: 'pointer',
                              transition: 'transform 0.2s',
                              '&:hover': {
                                transform: 'scale(1.05)',
                              }
                            }}
                            onClick={() => window.open(url, '_blank')}
                          />
                        ))}
                      </Box>
                    )}
                  </Paper>
                ))}
              </Box>
            ) : (
              <Box sx={{ p: 4, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: 3 }}>
                <HistoryIcon sx={{ fontSize: 40, color: 'text.secondary', opacity: 0.5, mb: 1 }} />
                <Typography variant="body1" color="text.secondary" fontWeight={500}>
                  No reports or site updates have been submitted yet.
                </Typography>
              </Box>
            )}
          </CustomTabPanel>
        </Box>
      </Paper>

      {/* Edit Dialog */}
      <Dialog
        open={isEditOpen}
        onClose={handleCloseEdit}
        maxWidth="md"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              borderRadius: 4,
              backgroundImage: 'none',
              boxShadow: theme.shadows[10],
            }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, pt: 3, pb: 1 }}>
          Edit Site Details
        </DialogTitle>

        <DialogContent dividers sx={{ py: 3 }}>
          {apiError && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {apiError}
            </Alert>
          )}

          <Box component="form" id="site-edit-details-form" onSubmit={handleSubmit(onEditSubmit)}>
            <Grid container spacing={3}>
              {/* Left Column - General Details */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 700 }}>
                    <SiteIcon fontSize="inherit" color="primary" /> General Details
                  </Typography>

                  <Controller
                    name="name"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        label="Site Name"
                        placeholder="e.g. Pune Corporate Office"
                        variant="outlined"
                        error={!!errors.name}
                        helperText={errors.name?.message}
                        slotProps={{ input: { sx: { borderRadius: 2 } } }}
                      />
                    )}
                  />

                  <Controller
                    name="supervisorId"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        select
                        label="Assign Supervisor"
                        variant="outlined"
                        error={!!errors.supervisorId}
                        helperText={errors.supervisorId?.message}
                        slotProps={{ input: { sx: { borderRadius: 2 } } }}
                      >
                        <MenuItem value="">
                          <em>Unassigned</em>
                        </MenuItem>
                        {supervisors.map((sup: any) => (
                          <MenuItem key={sup.id} value={sup.id}>
                            {sup.fullName}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                  />

                  <Controller
                    name="status"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth
                        select
                        label="Operational Status"
                        variant="outlined"
                        error={!!errors.status}
                        helperText={errors.status?.message}
                        slotProps={{ input: { sx: { borderRadius: 2 } } }}
                      >
                        <MenuItem value="ACTIVE">ACTIVE</MenuItem>
                        <MenuItem value="INACTIVE">INACTIVE</MenuItem>
                      </TextField>
                    )}
                  />

                  {/* Payroll Toggle Section */}
                  <Paper
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 3,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: alpha(theme.palette.primary.main, 0.01),
                      border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`,
                    }}
                  >
                    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                      <Box sx={{ p: 0.75, borderRadius: 2, backgroundColor: alpha(theme.palette.primary.main, 0.08), color: theme.palette.primary.main, display: 'flex' }}>
                        <PaymentsIcon fontSize="small" />
                      </Box>
                      <Box>
                        <Typography variant="subtitle2" sx={{ fontSize: '0.85rem', fontWeight: 700 }}>
                          Allow Payroll Visibility
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25, fontSize: '0.72rem' }}>
                          If enabled, site-specific employees can view payslips.
                        </Typography>
                      </Box>
                    </Box>
                    <Controller
                      name="isPayrollVisible"
                      control={control}
                      render={({ field }) => (
                        <Switch
                          checked={field.value}
                          onChange={(e) => field.onChange(e.target.checked)}
                          color="primary"
                        />
                      )}
                    />
                  </Paper>

                  <Divider sx={{ my: 1 }} />

                  <Typography variant="subtitle2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 700 }}>
                    <MapIcon fontSize="inherit" color="primary" /> Geofence Configuration
                  </Typography>

                  {/* Geofence Radius Slider */}
                  <Controller
                    name="radius"
                    control={control}
                    render={({ field }) => {
                      const radiusVal = field.value === undefined || (field.value as any) === '' ? 150 : Number(field.value);
                      return (
                        <Box sx={{ mt: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                            <Typography variant="body2" sx={{ fontWeight: 650, color: 'text.secondary' }}>
                              Geofence Radius:
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 800, color: 'primary.main' }}>
                              {radiusVal} meters
                            </Typography>
                          </Box>
                          <Slider
                            value={radiusVal}
                            min={10}
                            max={1000}
                            step={10}
                            onChange={(_, val) => field.onChange(val as number)}
                            valueLabelDisplay="auto"
                            sx={{ mb: 1 }}
                          />
                        </Box>
                      );
                    }}
                  />
                </Box>
              </Grid>

              {/* Right Column - Address search, Advanced Accordion & Map */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 0.5, fontWeight: 700 }}>
                  <LocationIcon fontSize="inherit" color="primary" /> Location & Geofence
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  {/* Autocomplete address selection */}
                  <Controller
                    name="address"
                    control={control}
                    render={({ field }) => (
                      <Autocomplete
                        freeSolo
                        options={addressOptions}
                        loading={isAddressLoading}
                        getOptionLabel={(option) => {
                          if (!option) return '';
                          if (typeof option === 'string') return option;
                          return option.display_name || '';
                        }}
                        filterOptions={(x) => x}
                        value={field.value || ''}
                        onInputChange={(_, newInputValue, reason) => {
                          field.onChange(newInputValue);
                          if (reason === 'input') {
                            setAddressSearchQuery(newInputValue);
                          }
                        }}
                        onChange={(_, newValue) => {
                          if (newValue && typeof newValue === 'object') {
                            const opt = newValue as any;
                            field.onChange(opt.display_name);
                            setValue('latitude', Number(opt.lat));
                            setValue('longitude', Number(opt.lon));
                            lastGeocodedAddressRef.current = opt.display_name;
                          } else if (typeof newValue === 'string') {
                            field.onChange(newValue);
                            geocodeCustomAddress(newValue);
                          }
                        }}
                        renderOption={(props, option: any) => {
                          const { key, ...restProps } = props as any;
                          const nameStr = typeof option === 'string' ? option : option.display_name || '';
                          const { main, secondary } = parseDisplayName(nameStr);
                          return (
                            <li key={key || nameStr} {...restProps} style={{ display: 'flex', alignItems: 'flex-start', padding: '10px 16px' }}>
                              <LocationIcon color="primary" sx={{ mr: 1.5, mt: 0.5, fontSize: 20, flexShrink: 0 }} />
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {main}
                                </Typography>
                                {secondary && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                                    {secondary}
                                  </Typography>
                                )}
                              </Box>
                            </li>
                          );
                        }}
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Search Address"
                            placeholder="Type address..."
                            variant="outlined"
                            error={!!errors.address}
                            helperText={errors.address?.message}
                            onBlur={() => {
                              geocodeCustomAddress(field.value || '');
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                geocodeCustomAddress(field.value || '');
                              }
                            }}
                            slotProps={{
                              inputLabel: { shrink: true },
                              input: {
                                sx: { borderRadius: 2 },
                                endAdornment: (
                                  <React.Fragment>
                                    {isAddressLoading ? (
                                      <CircularProgress color="inherit" size={20} sx={{ mr: 1 }} />
                                    ) : (
                                      <Tooltip title="Search and pin on Map">
                                        <IconButton
                                          size="small"
                                          onClick={() => setIsMapPickerOpen(true)}
                                          sx={{ mr: 0.5 }}
                                        >
                                          <MapIcon fontSize="small" />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    {(params as any).InputProps?.endAdornment}
                                  </React.Fragment>
                                ),
                              }
                            }}
                          />
                        )}
                      />
                    )}
                  />

                  {/* Accordion for Advanced Coordinates */}
                  <Accordion
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      '&:before': { display: 'none' }, // Remove default line
                      border: `1px solid ${theme.palette.divider}`,
                      overflow: 'hidden',
                    }}
                  >
                    <AccordionSummary
                      expandIcon={<ExpandMoreIcon />}
                      sx={{ backgroundColor: alpha(theme.palette.action.hover, 0.04) }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                        Advanced Coordinates (Manual Override)
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 2, pb: 1 }}>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 6 }}>
                          <Controller
                            name="latitude"
                            control={control}
                            render={({ field }) => (
                              <TextField
                                {...field}
                                type="number"
                                fullWidth
                                label="Latitude"
                                placeholder="e.g. 18.5204"
                                variant="outlined"
                                error={!!errors.latitude}
                                helperText={errors.latitude?.message}
                                slotProps={{
                                  htmlInput: { step: 'any' },
                                  inputLabel: { shrink: true },
                                  input: { sx: { borderRadius: 2 } }
                                }}
                                onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
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
                                type="number"
                                fullWidth
                                label="Longitude"
                                placeholder="e.g. 73.8567"
                                variant="outlined"
                                error={!!errors.longitude}
                                helperText={errors.longitude?.message}
                                slotProps={{
                                  htmlInput: { step: 'any' },
                                  inputLabel: { shrink: true },
                                  input: { sx: { borderRadius: 2 } }
                                }}
                                onChange={(e) => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))}
                              />
                            )}
                          />
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>



                  {/* Leaflet Map Box */}
                  <Box
                    sx={{
                      height: 250,
                      width: '100%',
                      borderRadius: 3,
                      overflow: 'hidden',
                      border: `1px solid ${theme.palette.divider}`,
                      position: 'relative',
                    }}
                  >
                    <MapContainerAny
                      center={[watchLat, watchLng]}
                      zoom={15}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayerAny
                        attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      />
                      <ChangeView center={[watchLat, watchLng]} radius={watchRad} />
                      <MapEvents onMapClick={handleMapClick} />
                      <TriggerInvalidateSize />

                      {watchLatitude !== undefined && watchLatitude !== null && !isNaN(Number(watchLatitude)) &&
                        watchLongitude !== undefined && watchLongitude !== null && !isNaN(Number(watchLongitude)) && (
                          <>
                            <MarkerAny
                              position={[Number(watchLatitude), Number(watchLongitude)]}
                              icon={createMarkerIcon(theme.palette.primary.main)}
                            />
                            <CircleAny
                              center={[Number(watchLatitude), Number(watchLongitude)]}
                              radius={watchRad}
                              pathOptions={{
                                color: theme.palette.primary.main,
                                fillColor: theme.palette.primary.main,
                                fillOpacity: 0.12,
                                weight: 2,
                                className: 'pulsing-geofence-circle'
                              }}
                            />
                          </>
                        )}
                    </MapContainerAny>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: -1 }}>
                    * Start typing an address to select from suggestions, or click directly on the map to pin the location and auto-resolve the address.
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2.5, gap: 1 }}>
          <Button onClick={handleCloseEdit} color="inherit" disabled={isSubmitting} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="site-edit-details-form"
            variant="contained"
            disabled={isSubmitting}
            sx={{ borderRadius: 2, px: 4 }}
          >
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={isDeleteOpen}
        onClose={() => !isDeleting && setIsDeleteOpen(false)}
        slotProps={{
          paper: {
            sx: { borderRadius: 3, p: 1 }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700, color: theme.palette.error.main, display: 'flex', alignItems: 'center', gap: 1 }}>
          <BlockIcon color="error" /> Delete Operational Site
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Are you sure you want to delete site <strong>{site.name}</strong>?
          </DialogContentText>
          <Alert severity="warning" sx={{ borderRadius: 2, border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}` }}>
            <strong>WARNING:</strong> This action will mark the site as <strong>INACTIVE</strong>, immediately disable its geofence boundaries, and prevent employees from punching in or out at this location.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setIsDeleteOpen(false)} color="inherit" disabled={isDeleting} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            onClick={handleDeleteConfirm}
            color="error"
            variant="contained"
            disabled={isDeleting}
            sx={{ borderRadius: 2 }}
          >
            {isDeleting ? <CircularProgress size={24} color="inherit" /> : 'Confirm Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      <GoogleMapPickerModal
        open={isMapPickerOpen}
        onClose={() => setIsMapPickerOpen(false)}
        onSelectLocation={handleSelectLocationFromPicker}
        initialLat={watchLatitude}
        initialLng={watchLongitude}
        initialAddress={watch('address')}
      />
    </Box>
  );
}

