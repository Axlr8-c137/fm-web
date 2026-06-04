import { useState } from 'react';
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
} from '@mui/material';
import {
  CalendarMonth as DateIcon,
  Login as CheckInIcon,
  Logout as CheckOutIcon,
  Verified as VerifiedIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AttendanceService } from '../../api/attendance.service';
import { EmployeeService } from '../../api/employee.service';
import { SiteService } from '../../api/site.service';
import { DataTable } from '../../components/common/DataTable';
import { useAuthStore } from '../../stores/auth.store';
import type { GridColDef } from '@mui/x-data-grid';
import { format } from 'date-fns';

const Typography = MuiTypography as any;

const manualLogSchema = z.object({
  employeeId: z.string().min(1, 'Employee is required'),
  siteId: z.string().min(1, 'Site is required'),
  punchType: z.enum(['IN', 'OUT']),
  punchTime: z.string().min(1, 'Date and time are required'),
});

type ManualLogSchema = z.infer<typeof manualLogSchema>;

export default function AttendanceLogsPage() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((state) => state.user);
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // Form & Dialog States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [logToEdit, setLogToEdit] = useState<any | null>(null);
  const [logToDelete, setLogToDelete] = useState<any | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // React Hook Form
  const { control, handleSubmit, reset, formState: { errors } } = useForm<ManualLogSchema>({
    resolver: zodResolver(manualLogSchema),
    defaultValues: {
      employeeId: '',
      siteId: '',
      punchType: 'IN',
      punchTime: '',
    },
  });

  // Queries
  const { data, isLoading } = useQuery({
    queryKey: ['attendance-logs'],
    queryFn: () => AttendanceService.getLogs({ page: 0, size: 100 }),
  });

  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => EmployeeService.getEmployees(),
    enabled: isSuperAdmin,
  });

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: () => SiteService.getSites(),
    enabled: isSuperAdmin,
  });

  const employees = (employeesData as any)?.data || [];
  const sites = sitesData?.data || [];

  const handleAddClick = () => {
    reset({
      employeeId: '',
      siteId: '',
      punchType: 'IN',
      punchTime: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
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
      console.error('Failed to save manual attendance log', err);
      setApiError(err.response?.data?.message || err.message || 'Failed to save attendance log. Please try again.');
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

  const baseColumns: GridColDef[] = [
    {
      field: 'punchTime',
      headerName: 'Time',
      width: 180,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DateIcon fontSize="small" color="action" />
          <Typography variant="body2" fontWeight={500}>
            {params.value ? format(new Date(params.value), 'MMM dd, HH:mm') : '-'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'employeeName',
      headerName: 'Employee',
      flex: 1,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar
            sx={{
              width: 32,
              height: 32,
              fontSize: '0.875rem',
              bgcolor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              fontWeight: 700,
            }}
          >
            {params.value ? params.value.charAt(0) : 'E'}
          </Avatar>
          <Typography variant="body2" fontWeight={600}>
            {params.value || 'Unknown Employee'}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'siteName',
      headerName: 'Site',
      flex: 1,
    },
    {
      field: 'punchType',
      headerName: 'Type',
      width: 120,
      renderCell: (params) => (
        <Chip
          icon={params.value === 'IN' ? <CheckInIcon sx={{ fontSize: '1rem !important' }} /> : <CheckOutIcon sx={{ fontSize: '1rem !important' }} />}
          label={params.value === 'IN' ? 'CHECK-IN' : 'CHECK-OUT'}
          size="small"
          color={params.value === 'IN' ? 'success' : 'warning'}
          variant="outlined"
          sx={{ fontWeight: 700, borderRadius: 1.5 }}
        />
      ),
    },
    {
      field: 'insideGeofence',
      headerName: 'Geofence Status',
      width: 150,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={params.value ? 'INSIDE' : 'OUTSIDE'}
            size="small"
            color={params.value ? 'success' : 'error'}
            sx={{ fontSize: '0.7rem', fontWeight: 700, borderRadius: 1 }}
          />
          {params.value && (
            <Tooltip title="Verified Inside Boundary">
              <VerifiedIcon color="success" sx={{ fontSize: 18 }} />
            </Tooltip>
          )}
        </Box>
      ),
    },
  ];

  const actionsColumn: GridColDef = {
    field: 'actions',
    headerName: 'Actions',
    width: 120,
    sortable: false,
    align: 'center',
    headerAlign: 'center',
    renderCell: (params) => (
      <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', height: '100%' }}>
        <Tooltip title="Edit Log">
          <IconButton
            size="small"
            color="primary"
            onClick={() => handleEditClick(params.row)}
          >
            <EditIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Delete Log">
          <IconButton
            size="small"
            color="error"
            onClick={() => setLogToDelete(params.row)}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    ),
  };

  const columns = isSuperAdmin ? [...baseColumns, actionsColumn] : baseColumns;

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Attendance Logs
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Real-time tracking of employee check-ins and check-outs
          </Typography>
        </Box>
        {isSuperAdmin && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddClick}
            sx={{ borderRadius: 2.5, px: 3, py: 1, textTransform: 'none', fontWeight: 700 }}
          >
            Add Manual Punch
          </Button>
        )}
      </Box>

      <DataTable
        rows={((data as any)?.data || []) as any[]}
        columns={columns}
        loading={isLoading}
        getRowId={(row: any) => row.id}
      />

      {/* Manual Add / Edit Dialog */}
      <Dialog
        open={isFormOpen}
        onClose={() => !isSubmitting && setIsFormOpen(false)}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: { borderRadius: 4, boxShadow: theme.shadows[10] }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, pt: 3, pb: 1 }}>
          {logToEdit ? 'Edit Attendance Log' : 'Add Manual Attendance punch'}
        </DialogTitle>
        <DialogContent dividers sx={{ py: 3 }}>
          {apiError && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {apiError}
            </Alert>
          )}

          <Box component="form" id="manual-log-form" onSubmit={handleSubmit(onFormSubmit)}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12 }}>
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
                      <MenuItem value="">
                        <em>Select Employee</em>
                      </MenuItem>
                      {employees.map((emp: any) => (
                        <MenuItem key={emp.id} value={emp.id}>
                          {emp.fullName} ({emp.role})
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12 }}>
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
                      <MenuItem value="">
                        <em>Select Site</em>
                      </MenuItem>
                      {sites.map((site: any) => (
                        <MenuItem key={site.id} value={site.id}>
                          {site.name}
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
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

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="punchTime"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth
                      type="datetime-local"
                      label="Punch Date & Time"
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
            sx={{ borderRadius: 2, px: 4 }}
          >
            {isSubmitting ? <CircularProgress size={24} color="inherit" /> : logToEdit ? 'Save Changes' : 'Add Punch'}
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
        <DialogTitle sx={{ fontWeight: 700 }}>Delete Attendance Log</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete this attendance log for <strong>{logToDelete?.employeeName}</strong>?
            This action cannot be undone.
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
            {isDeleting ? <CircularProgress size={24} color="inherit" /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
