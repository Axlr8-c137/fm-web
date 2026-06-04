import React, { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography as MuiTypography,
  Button,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Grid,
  MenuItem,
  CircularProgress,
  Alert,
  alpha,
  Divider,
  Switch,
  Paper,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Autocomplete,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  LocationOn as LocationIcon,
  Business as SiteIcon,
  Edit as EditIcon,
  Block as BlockIcon,
  Person as PersonIcon,
  MyLocation as MapIcon,
  Payments as PaymentsIcon,
  ExpandMore as ExpandMoreIcon,
  Delete as DeleteIcon,
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
import { DataTable } from '../../components/common/DataTable';
import { useAuthStore } from '../../stores/auth.store';
import type { GridColDef } from '@mui/x-data-grid';
import type { Site } from '../../types/site';

// Validation Schema for Site
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
            // Calculate geofence bounds to zoom and fit in view
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

export default function SiteListPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  // Auth state
  const currentUser = useAuthStore((state) => state.user);
  const organizationId = currentUser?.organizationId;

  // Dialog & Form State
  const [siteToEdit, setSiteToEdit] = useState<Site | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [siteToDeactivate, setSiteToDeactivate] = useState<Site | null>(null);
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [addressOptions, setAddressOptions] = useState<any[]>([]);
  const [isAddressLoading, setIsAddressLoading] = useState(false);
  const [addressSearchQuery, setAddressSearchQuery] = useState('');

  const { control, handleSubmit, reset, setValue, watch, formState: { errors } } = useForm<SiteSchema>({
    resolver: zodResolver(siteSchema) as any,
    defaultValues: {
      name: '',
      address: '',
      latitude: undefined,
      longitude: undefined,
      radius: 150,
      supervisorId: '',
      status: 'ACTIVE',
      isPayrollVisible: false,
    },
  });

  const watchLatitude = watch('latitude');
  const watchLongitude = watch('longitude');
  const watchRadius = watch('radius');

  const watchLat = (watchLatitude !== undefined && !isNaN(Number(watchLatitude))) ? Number(watchLatitude) : 18.5204;
  const watchLng = (watchLongitude !== undefined && !isNaN(Number(watchLongitude))) ? Number(watchLongitude) : 73.8567;
  const watchRad = (watchRadius !== undefined && !isNaN(Number(watchRadius))) ? Number(watchRadius) : 150;

  // Queries
  const { data, isLoading: isSitesLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: () => SiteService.getSites(),
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => EmployeeService.getEmployees(),
  });

  // Dynamic Data Mapping
  const rawSites = data?.data || [];
  const employees = (employeesData as any)?.data || [];

  const sites = React.useMemo(() => {
    return rawSites
      .filter((site: any) => site.status === 'ACTIVE') // Filter out deactivated/deleted sites
      .map((site: any) => {
        const siteEmployees = employees.filter((emp: any) => emp.siteId === site.id);
        const activeEmployees = siteEmployees.filter((emp: any) => emp.status === 'ACTIVE');
        const supervisor = siteEmployees.find((emp: any) => emp.role === 'SUPERVISOR');

        return {
          ...site,
          employeeCount: activeEmployees.length,
          supervisorName: supervisor ? supervisor.fullName : 'Unassigned',
          supervisorId: supervisor ? supervisor.id : '',
        };
      });
  }, [rawSites, employees]);

  const supervisors = React.useMemo(() => {
    return employees.filter((emp: any) => emp.role === 'SUPERVISOR');
  }, [employees]);

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

  // Form Handlers
  const handleCreateClick = () => {
    reset({
      name: '',
      address: '',
      latitude: undefined,
      longitude: undefined,
      radius: 150,
      supervisorId: '',
      status: 'ACTIVE',
      isPayrollVisible: false,
    });
    setSiteToEdit(null);
    setApiError(null);
    setIsFormOpen(true);
  };

  const handleEditClick = (site: Site & { supervisorId?: string }) => {
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
    setSiteToEdit(site);
    setApiError(null);
    setIsFormOpen(true);
  };

  const handleCloseModal = () => {
    setIsFormOpen(false);
    setSiteToEdit(null);
    setApiError(null);
  };

  const onFormSubmit = async (formData: any) => {
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

      let savedSite: any;
      if (siteToEdit) {
        const response = await SiteService.updateSite(siteToEdit.id, sitePayload);
        savedSite = response?.data || response;
      } else {
        const response = await SiteService.createSite(sitePayload);
        savedSite = response?.data || response;
      }

      // Reassign Supervisor
      const siteId = savedSite?.id || siteToEdit?.id;
      if (siteId) {
        // Find previous supervisor for this site
        const prevSupervisor = employees.find(
          (emp: any) => emp.siteId === siteId && emp.role === 'SUPERVISOR'
        );

        // Clear previous supervisor if supervisor changed
        if (prevSupervisor && String(prevSupervisor.id) !== String(formData.supervisorId)) {
          await EmployeeService.updateEmployee(prevSupervisor.id, {
            ...prevSupervisor,
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

      queryClient.invalidateQueries({ queryKey: ['sites'] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      handleCloseModal();
    } catch (err: any) {
      console.error('Failed to save site', err);
      const errMsg = err.response?.data?.message || err.message || 'Failed to save site. Please try again.';
      setApiError(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeactivateConfirm = async () => {
    if (!siteToDeactivate) return;
    setIsDeactivating(true);
    try {
      await SiteService.deactivateSite(siteToDeactivate.id);
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      setSiteToDeactivate(null);
    } catch (err: any) {
      console.error('Failed to deactivate site', err);
      alert('Failed to deactivate site: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!siteToDelete) return;
    const deletedId = siteToDelete.id;
    setIsDeleting(true);
    // Optimistically close dialog immediately
    setSiteToDelete(null);
    try {
      await SiteService.deactivateSite(deletedId);
      // Optimistically remove from cache before refetch
      queryClient.setQueryData(['sites'], (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          data: (oldData.data || []).filter((s: any) => s.id !== deletedId),
        };
      });
      queryClient.invalidateQueries({ queryKey: ['sites'] });
    } catch (err: any) {
      console.error('Failed to delete site', err);
      // Restore site in list on error
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      alert('Failed to delete site: ' + (err.response?.data?.message || err.message));
    } finally {
      setIsDeleting(false);
    }
  };

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Site Name',
      flex: 1.2,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, height: '100%' }}>
          <Box
            sx={{
              p: 0.75,
              borderRadius: 2,
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
              color: theme.palette.primary.main,
              display: 'flex',
            }}
          >
            <SiteIcon fontSize="small" />
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 650 }}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'address',
      headerName: 'Address',
      flex: 1.5,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, height: '100%' }}>
          <LocationIcon fontSize="small" sx={{ color: 'text.secondary', opacity: 0.7 }} />
          <Typography variant="body2" color="text.secondary" noWrap>
            {params.value || 'No address provided'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'supervisorName',
      headerName: 'Supervisor',
      flex: 1,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, height: '100%' }}>
          <PersonIcon fontSize="small" sx={{ color: 'text.secondary', opacity: 0.7 }} />
          <Typography 
            variant="body2" 
            sx={{ 
              fontWeight: params.value !== 'Unassigned' ? 600 : 400,
              color: params.value !== 'Unassigned' ? 'text.primary' : 'text.secondary'
            }}
          >
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'employeeCount',
      headerName: 'Employees',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Chip
            label={params.value || 0}
            size="small"
            variant="outlined"
            color="primary"
            sx={{ fontWeight: 700, borderRadius: 1.5, px: 0.5 }}
          />
        </Box>
      ),
    },
    {
      field: 'isPayrollVisible',
      headerName: 'Payroll Enabled',
      width: 130,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Chip
            label={params.value ? 'YES' : 'NO'}
            size="small"
            color={params.value ? 'primary' : 'default'}
            sx={{ 
              fontWeight: 700, 
              borderRadius: 1.5,
              fontSize: '0.75rem',
            }}
          />
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Chip
            label={params.value}
            size="small"
            color={params.value === 'ACTIVE' ? 'success' : 'default'}
            sx={{ 
              fontWeight: 700, 
              borderRadius: 1.5,
              fontSize: '0.75rem',
              letterSpacing: 0.5 
            }}
          />
        </Box>
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', height: '100%' }}>
          <Tooltip title="View Details">
            <IconButton
              size="small"
              onClick={() => navigate(`/sites/${params.row.id}`)}
              color="primary"
            >
              <ViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit Site">
            <IconButton
              size="small"
              onClick={() => handleEditClick(params.row as any)}
              sx={{ color: theme.palette.info.main }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {params.row.status === 'ACTIVE' && (
            <Tooltip title="Deactivate Site">
              <IconButton
                size="small"
                onClick={() => setSiteToDeactivate(params.row as Site)}
                color="error"
              >
                <BlockIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip title="Delete Site">
            <IconButton
              size="small"
              onClick={() => setSiteToDelete(params.row as Site)}
              sx={{ color: theme.palette.error.main }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      {/* Title Header */}
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 4,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 800 }} gutterBottom>
            Site Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your operational sites and geofences
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={handleCreateClick}
          sx={{
            borderRadius: 2.5,
            px: 3,
            py: 1,
            textTransform: 'none',
            fontWeight: 700,
            boxShadow: theme.shadows[4],
          }}
        >
          Create New Site
        </Button>
      </Box>

      {/* Main Table */}
      <DataTable
        rows={sites}
        columns={columns}
        loading={isSitesLoading}
        getRowId={(row) => row.id}
      />

      {/* Create / Edit Dialog */}
      <Dialog 
        open={isFormOpen} 
        onClose={handleCloseModal} 
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
          {siteToEdit ? 'Edit Site Details' : 'Create Operational Site'}
        </DialogTitle>
        
        <DialogContent dividers sx={{ py: 3 }}>
          {apiError && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {apiError}
            </Alert>
          )}
          
          <Box component="form" id="site-crud-form" onSubmit={handleSubmit(onFormSubmit)}>
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
                                          onClick={() => geocodeCustomAddress(field.value || '')}
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
          <Button onClick={handleCloseModal} color="inherit" disabled={isSubmitting} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="site-crud-form"
            variant="contained"
            disabled={isSubmitting}
            sx={{ borderRadius: 2, px: 4 }}
          >
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : siteToEdit ? 'Save Changes' : 'Create Site'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Deactivate Confirmation Dialog */}
      <Dialog
        open={!!siteToDeactivate}
        onClose={() => !isDeactivating && setSiteToDeactivate(null)}
        slotProps={{
          paper: {
            sx: { borderRadius: 3, p: 1 }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 700 }}>Deactivate Site</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to deactivate operational site <strong>{siteToDeactivate?.name}</strong>? 
            This sets status to INACTIVE.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSiteToDeactivate(null)} color="inherit" disabled={isDeactivating} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button 
            onClick={handleDeactivateConfirm} 
            color="error" 
            variant="contained" 
            disabled={isDeactivating}
            sx={{ borderRadius: 2 }}
          >
            {isDeactivating ? <CircularProgress size={24} color="inherit" /> : 'Deactivate'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!siteToDelete}
        onClose={() => !isDeleting && setSiteToDelete(null)}
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
            Are you sure you want to delete site <strong>{siteToDelete?.name}</strong>?
          </DialogContentText>
          <Alert severity="warning" sx={{ borderRadius: 2, border: `1px solid ${alpha(theme.palette.warning.main, 0.3)}` }}>
            <strong>WARNING:</strong> This action will mark the site as <strong>INACTIVE</strong>, immediately disable its geofence boundaries, and prevent employees from punching in or out at this location.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setSiteToDelete(null)} color="inherit" disabled={isDeleting} sx={{ borderRadius: 2 }}>
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
    </Box>
  );
}
