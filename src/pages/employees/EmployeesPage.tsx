import React from 'react';
import { Box, Typography, Chip, IconButton, Tooltip, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField, Grid, MenuItem, CircularProgress, Alert } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useQueryClient } from '@tanstack/react-query';
import type { GridColDef } from '@mui/x-data-grid';
import { Edit as EditIcon, Delete as DeleteIcon, Visibility as ViewIcon, Add as AddIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../../components/common/DataTable';
import { EmployeeService } from '../../api/employee.service';
import apiClient from '../../api/client';
import type { Employee } from '../../types/employee';

const ROLE_COLORS: Record<string, 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' | 'default'> = {
  SUPER_ADMIN: 'secondary',
  ADMIN: 'primary',
  SUPERVISOR: 'warning',
  EMPLOYEE: 'info',
  SECURITY_GUARD: 'info',
  JANITOR: 'default',
  MAINTENANCE: 'default',
};

const editSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().min(10, 'Phone is required'),
  role: z.string(),
  joiningDate: z.date(),
});
type EditSchema = z.infer<typeof editSchema>;

const EmployeesPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [employeeToDelete, setEmployeeToDelete] = React.useState<Employee | null>(null);
  const [employeeToEdit, setEmployeeToEdit] = React.useState<Employee | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  const { control, handleSubmit, reset, formState: { errors } } = useForm<EditSchema>({
    resolver: zodResolver(editSchema),
  });

  const handleEditClick = (employee: Employee) => {
    const parts = employee.fullName.split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    
    reset({
      firstName,
      lastName,
      email: employee.email || '',
      phone: employee.phone || '',
      role: employee.role || 'EMPLOYEE',
      joiningDate: employee.joiningDate ? new Date(employee.joiningDate) : new Date(),
    });
    setEmployeeToEdit(employee);
    setApiError(null);
  };

  const handleCloseEdit = () => {
    setEmployeeToEdit(null);
    setApiError(null);
  };

  const onEditSubmit = async (data: EditSchema) => {
    if (!employeeToEdit) return;
    setIsEditing(true);
    setApiError(null);
    try {
      const payload = {
        fullName: `${data.firstName} ${data.lastName}`,
        email: data.email,
        phone: data.phone,
        role: data.role,
        joiningDate: data.joiningDate.toISOString(),
      };
      await EmployeeService.updateEmployee(employeeToEdit.id, payload);
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      handleCloseEdit();
    } catch (error: any) {
      console.error("Failed to update employee", error);
      const errData = (error.code && error.message) ? error : (error.response?.data?.error || error.response?.data);
      setApiError(errData?.message || 'Failed to update employee. Please try again.');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteClick = (employee: Employee) => {
    setEmployeeToDelete(employee);
  };

  const handleDeleteConfirm = async () => {
    if (!employeeToDelete) return;
    setIsDeleting(true);
    try {
      await EmployeeService.deleteEmployee(employeeToDelete.id);
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    } catch (error: any) {
      console.error("Failed to delete employee", error);
      const errData = (error.code && error.message) ? error : (error.response?.data?.error || error.response?.data);
      alert('Failed to delete employee: ' + (errData?.message || error.message));
    } finally {
      setIsDeleting(false);
      setEmployeeToDelete(null);
    }
  };
  const { data: employeesData, isLoading: isEmployeesLoading, error: employeesError } = useQuery({
    queryKey: ['employees'],
    queryFn: () => EmployeeService.getEmployees(),
  });

  const { data: sitesData } = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiClient.get('/sites'),
  });

  const sitesMap = React.useMemo(() => {
    const map = new Map<string, string>();
    const sites = (sitesData as any)?.data || [];
    sites.forEach((site: any) => map.set(site.id, site.name));
    return map;
  }, [sitesData]);

  const columns: GridColDef[] = [
    {
      field: 'fullName',
      headerName: 'Full Name',
      width: 220,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            {params.value}
          </Typography>
        </Box>
      )
    },
    { 
      field: 'email', 
      headerName: 'Email', 
      width: 220,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            {params.value || '-'}
          </Typography>
        </Box>
      )
    },
    { 
      field: 'phone', 
      headerName: 'Phone', 
      width: 150,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
            {params.value}
          </Typography>
        </Box>
      )
    },
    { 
      field: 'role', 
      headerName: 'Role', 
      width: 160,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Chip 
            label={params.value?.replace('_', ' ')} 
            color={ROLE_COLORS[params.value] || 'default'} 
            size="small" 
            sx={{ 
              fontWeight: 700, 
              fontSize: '0.7rem',
              borderRadius: '6px',
              textTransform: 'uppercase'
            }}
          />
        </Box>
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      headerAlign: 'center',
      align: 'center',
      valueGetter: () => 'ACTIVE', // API does not provide isActive in EmployeeResponseDto
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Chip 
            label={params.value} 
            color="success" 
            size="small" 
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        </Box>
      ),
    },
    { 
      field: 'siteId', 
      headerName: 'Site', 
      width: 180,
      headerAlign: 'center',
      align: 'center',
      valueGetter: (value) => sitesMap.get(value) || 'Unassigned',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2">
            {params.value}
          </Typography>
        </Box>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 150,
      headerAlign: 'center',
      align: 'center',
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Tooltip title="View">
            <IconButton size="small"><ViewIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" color="primary" onClick={() => handleEditClick(params.row as Employee)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error" onClick={() => handleDeleteClick(params.row as Employee)}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  if (employeesError) {
    return (
      <Box sx={{ p: 3, textAlign: 'center' }}>
        <Typography color="error">Error loading employees. Please try again later.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" fontWeight={700} gutterBottom>
            Employees
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your workforce and view their status.
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate('/employees/onboard')}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
        >
          Onboard Employee
        </Button>
      </Box>

      <DataTable
        rows={(employeesData as any)?.data || []}
        columns={columns}
        loading={isEmployeesLoading}
        getRowId={(row) => row.id}
      />

      {/* Delete Dialog */}
      <Dialog open={!!employeeToDelete} onClose={() => !isDeleting && setEmployeeToDelete(null)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete employee <strong>{employeeToDelete?.fullName}</strong>? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEmployeeToDelete(null)} color="inherit" disabled={isDeleting}>Cancel</Button>
          <Button onClick={handleDeleteConfirm} color="error" variant="contained" disabled={isDeleting}>
            {isDeleting ? <CircularProgress size={24} color="inherit" /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!employeeToEdit} onClose={handleCloseEdit} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Employee</DialogTitle>
        <DialogContent dividers>
          {apiError && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{apiError}</Alert>
          )}
          <Box component="form" id="edit-employee-form" onSubmit={handleSubmit(onEditSubmit)} sx={{ mt: 1 }}>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="firstName"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="First Name" variant="outlined" error={!!errors.firstName} helperText={errors.firstName?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="lastName"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Last Name" variant="outlined" error={!!errors.lastName} helperText={errors.lastName?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Email" variant="outlined" error={!!errors.email} helperText={errors.email?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Phone" variant="outlined" error={!!errors.phone} helperText={errors.phone?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth select label="Role" variant="outlined" error={!!errors.role} helperText={errors.role?.message}>
                      <MenuItem value="EMPLOYEE">Employee</MenuItem>
                      <MenuItem value="SUPERVISOR">Supervisor</MenuItem>
                      <MenuItem value="ADMIN">Admin</MenuItem>
                      <MenuItem value="SUPER_ADMIN">Super Admin</MenuItem>
                      <MenuItem value="CLIENT">Client</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="joiningDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker 
                      label="Joining Date"
                      value={field.value}
                      onChange={(date) => field.onChange(date)}
                      slotProps={{ textField: { fullWidth: true, variant: 'outlined', error: !!errors.joiningDate, helperText: errors.joiningDate?.message } }}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseEdit} color="inherit" disabled={isEditing}>Cancel</Button>
          <Button type="submit" form="edit-employee-form" variant="contained" disabled={isEditing}>
            {isEditing ? <CircularProgress size={24} color="inherit" /> : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmployeesPage;
