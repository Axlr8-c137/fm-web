import React, { useState } from 'react';
import { Box, Typography as MuiTypography, Chip, IconButton, Tooltip, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField, Grid, MenuItem, CircularProgress, Alert, Paper, alpha, useTheme, Divider, FormControlLabel, Checkbox } from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useQueryClient } from '@tanstack/react-query';
import type { GridColDef } from '@mui/x-data-grid';
import { Edit as EditIcon, Delete as DeleteIcon, Visibility as ViewIcon, Add as AddIcon, Badge as BadgeIcon } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { DataTable } from '../../components/common/DataTable';
import { EmployeeService } from '../../api/employee.service';
import apiClient from '../../api/client';
import type { Employee } from '../../types/employee';
import { useAuthStore } from '../../stores/auth.store';

const Typography = MuiTypography as any;


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
  gender: z.string().optional().or(z.literal('')),
  dob: z.date().nullable().optional(),
  bankName: z.string().optional().or(z.literal('')),
  bankAccountNumber: z.string().optional().or(z.literal('')),
  bankIfscCode: z.string().optional().or(z.literal('')),
  pfNumber: z.string().optional().or(z.literal('')),
  uanNumber: z.string().optional().or(z.literal('')),
  esicNumber: z.string().optional().or(z.literal('')),
  designation: z.string().optional().or(z.literal('')),
  department: z.string().optional().or(z.literal('')),
  employeeId: z.string().optional().or(z.literal('')),
  employeeExternalId: z.string().optional().or(z.literal('')),
  linNumber: z.string().optional().or(z.literal('')),
  maritalStatus: z.string().optional().or(z.literal('')),
  bloodGroup: z.string().optional().or(z.literal('')),
  heightFeet: z.string().optional().or(z.literal('')),
  heightInches: z.string().optional().or(z.literal('')),
  weightKg: z.string().optional().or(z.literal('')),
  education: z.string().optional().or(z.literal('')),
  languagesKnown: z.string().optional().or(z.literal('')),
  emergencyContactNumber: z.string().optional().or(z.literal('')),
  form11Number: z.string().optional().or(z.literal('')),
  residentialAddress: z.string().optional().or(z.literal('')),
  policeVerificationStatus: z.boolean().optional(),
  residentialProofStatus: z.boolean().optional(),
  termsAndConditionsAccepted: z.boolean().optional(),
  aadhaar: z.string().regex(/^$|^\d{12}$/, 'Aadhaar must be exactly 12 digits').optional().or(z.literal('')),
  pan: z.string().regex(/^$|^[A-Z]{5}\d{4}[A-Z]$/, 'Invalid PAN format').optional().or(z.literal('')),
  siteId: z.string().optional().or(z.literal('')),
});
type EditSchema = z.infer<typeof editSchema>;

const EmployeesPage: React.FC = () => {
  const theme = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const isSupervisor = user?.role === 'SUPERVISOR';
  
  const [employeeToDelete, setEmployeeToDelete] = React.useState<Employee | null>(null);
  const [employeeToEdit, setEmployeeToEdit] = React.useState<Employee | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [isEditing, setIsEditing] = React.useState(false);
  const [apiError, setApiError] = React.useState<string | null>(null);

  // View Details & Verification States
  const [employeeToView, setEmployeeToView] = useState<Employee | null>(null);
  const [employeeDetails, setEmployeeDetails] = useState<any | null>(null);
  const [isDetailsLoading, setIsDetailsLoading] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [rejectingDocId, setRejectingDocId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const { control, handleSubmit, reset, formState: { errors } } = useForm<EditSchema>({
    resolver: zodResolver(editSchema),
  });

  const handleEditClick = (employee: any) => {
    const parts = employee.fullName.split(' ');
    const firstName = parts[0];
    const lastName = parts.slice(1).join(' ');
    
    reset({
      firstName,
      lastName,
      email: employee.email || '',
      phone: employee.phone || '',
      role: employee.role || 'EMPLOYEE',
      joiningDate: employee.joiningDate || employee.enrollmentDate ? new Date(employee.joiningDate || employee.enrollmentDate) : new Date(),
      gender: employee.gender || '',
      dob: employee.dateOfBirth || employee.dob ? new Date(employee.dateOfBirth || employee.dob) : null,
      bankName: employee.bankName || '',
      bankAccountNumber: employee.bankAccountNumber || '',
      bankIfscCode: employee.bankIfscCode || '',
      pfNumber: employee.pfNumber || '',
      uanNumber: employee.uanNumber || '',
      esicNumber: employee.esicNumber || '',
      designation: employee.designation || '',
      department: employee.department || '',
      employeeId: employee.employeeId || '',
      employeeExternalId: employee.employeeExternalId || '',
      linNumber: employee.linNumber || '',
      maritalStatus: employee.maritalStatus || '',
      bloodGroup: employee.bloodGroup || '',
      heightFeet: employee.heightFeet !== undefined && employee.heightFeet !== null ? String(employee.heightFeet) : '',
      heightInches: employee.heightInches !== undefined && employee.heightInches !== null ? String(employee.heightInches) : '',
      weightKg: employee.weightKg !== undefined && employee.weightKg !== null ? String(employee.weightKg) : '',
      education: employee.education || '',
      languagesKnown: employee.languagesKnown || '',
      emergencyContactNumber: employee.emergencyContactNumber || '',
      form11Number: employee.form11Number || '',
      residentialAddress: employee.residentialAddress || '',
      policeVerificationStatus: employee.policeVerificationStatus || false,
      residentialProofStatus: employee.residentialProofStatus || false,
      termsAndConditionsAccepted: employee.termsAndConditionsAccepted || false,
      aadhaar: employee.aadhaar || '',
      pan: employee.pan || '',
      siteId: employee.siteId || '',
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
        enrollmentDate: data.joiningDate ? data.joiningDate.toISOString().split('T')[0] : null,
        gender: data.gender || null,
        dob: data.dob ? data.dob.toISOString().split('T')[0] : null,
        dateOfBirth: data.dob ? data.dob.toISOString().split('T')[0] : null,
        bankName: data.bankName || null,
        bankAccountNumber: data.bankAccountNumber || null,
        bankIfscCode: data.bankIfscCode || null,
        pfNumber: data.pfNumber || null,
        uanNumber: data.uanNumber || null,
        esicNumber: data.esicNumber || null,
        designation: data.designation || "",
        department: data.department || "",
        employeeId: data.employeeId || "",
        employeeExternalId: data.employeeExternalId || "",
        linNumber: data.linNumber || "",
        maritalStatus: data.maritalStatus || "",
        bloodGroup: data.bloodGroup || "",
        heightFeet: data.heightFeet ? parseInt(data.heightFeet, 10) : null,
        heightInches: data.heightInches ? parseInt(data.heightInches, 10) : null,
        weightKg: data.weightKg ? parseFloat(data.weightKg) : null,
        education: data.education || "",
        languagesKnown: data.languagesKnown || "",
        emergencyContactNumber: data.emergencyContactNumber || "",
        form11Number: data.form11Number || "",
        residentialAddress: data.residentialAddress || "",
        policeVerificationStatus: data.policeVerificationStatus || false,
        residentialProofStatus: data.residentialProofStatus || false,
        termsAndConditionsAccepted: data.termsAndConditionsAccepted || false,
        aadhaar: data.aadhaar || "",
        pan: data.pan || "",
        siteId: data.siteId || null,
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

  // View Profile handlers
  const handleViewClick = async (emp: Employee) => {
    setEmployeeToView(emp);
    setIsDetailsLoading(true);
    setVerificationError(null);
    setRejectingDocId(null);
    setRejectionReason('');
    try {
      const response = await EmployeeService.getEmployeeById(emp.id);
      setEmployeeDetails(response?.data || response);
    } catch (err) {
      console.error("Failed to fetch employee details", err);
    } finally {
      setIsDetailsLoading(false);
    }
  };

  const handleVerifyDocument = async (docId: string, isApproved: boolean, reason?: string) => {
    setVerificationError(null);
    try {
      const url = `/employees/documents/${docId}/verify?isApproved=${isApproved}${reason ? `&reason=${encodeURIComponent(reason)}` : ''}`;
      await apiClient.put(url);
      
      // Refresh current employee details
      if (employeeToView) {
        const response = await EmployeeService.getEmployeeById(employeeToView.id);
        setEmployeeDetails(response?.data || response);
      }
      queryClient.invalidateQueries({ queryKey: ['employees'] });
    } catch (err: any) {
      console.error("Failed to verify document", err);
      setVerificationError(err?.message || 'Failed to update verification status.');
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
      valueGetter: (value) => value || 'ACTIVE',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Chip 
            label={params.value} 
            color={params.value === 'ACTIVE' ? 'success' : 'default'} 
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
          <Tooltip title="View Profile">
            <IconButton size="small" onClick={() => handleViewClick(params.row as Employee)}>
              <ViewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" color="primary" onClick={() => handleEditClick(params.row as Employee)}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {!isSupervisor && (
            <Tooltip title="Delete">
              <IconButton size="small" color="error" onClick={() => handleDeleteClick(params.row as Employee)}>
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
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

  const rows = (employeesData as any)?.data || [];

  const stats = React.useMemo(() => {
    const total = rows.length;
    const active = rows.filter((emp: any) => emp.status === 'ACTIVE').length;
    const inactive = rows.filter((emp: any) => emp.status === 'INACTIVE').length;
    const supervisors = rows.filter((emp: any) => emp.role === 'SUPERVISOR').length;
    return { total, active, inactive, supervisors };
  }, [rows]);

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

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          { label: 'Total Employees', value: stats.total, color: theme.palette.primary.main },
          { label: 'Active', value: stats.active, color: theme.palette.success.main },
          { label: 'Inactive', value: stats.inactive, color: theme.palette.text.secondary },
          { label: 'Supervisors', value: stats.supervisors, color: theme.palette.warning.main },
        ].map((item, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
            <Paper
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: alpha(item.color, 0.02),
                borderColor: alpha(item.color, 0.15),
              }}
            >
              <Box>
                <Typography variant="h4" fontWeight={800} sx={{ color: item.color, mb: 0.5 }}>
                  {item.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {item.label}
                </Typography>
              </Box>
              <Box 
                sx={{ 
                  p: 1.25, 
                  borderRadius: 3, 
                  backgroundColor: alpha(item.color, 0.08), 
                  color: item.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 800,
                  fontSize: '1.2rem'
                }}
              >
                <BadgeIcon fontSize="small" />
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      <DataTable
        rows={rows}
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
      <Dialog open={!!employeeToEdit} onClose={handleCloseEdit} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Employee</DialogTitle>
        <DialogContent dividers>
          {apiError && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{apiError}</Alert>
          )}
          <Box component="form" id="edit-employee-form" onSubmit={handleSubmit(onEditSubmit)} sx={{ mt: 1 }}>
            <Grid container spacing={3}>
              {/* SECTION: PERSONAL DETAILS */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" color="primary" fontWeight={700} sx={{ mb: 1 }}>
                  PERSONAL DETAILS
                </Typography>
                <Divider sx={{ mb: 2 }} />
              </Grid>

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
              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="gender"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth select label="Gender" variant="outlined" error={!!errors.gender} helperText={errors.gender?.message}>
                      <MenuItem value=""><em>Not Specified</em></MenuItem>
                      <MenuItem value="Male">Male</MenuItem>
                      <MenuItem value="Female">Female</MenuItem>
                      <MenuItem value="Other">Other</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="dob"
                  control={control}
                  render={({ field }) => (
                    <DatePicker 
                      label="Date of Birth"
                      value={field.value}
                      onChange={(date) => field.onChange(date)}
                      slotProps={{ textField: { fullWidth: true, variant: 'outlined', error: !!errors.dob, helperText: errors.dob?.message } }}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="maritalStatus"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth select label="Marital Status" variant="outlined" error={!!errors.maritalStatus} helperText={errors.maritalStatus?.message}>
                      <MenuItem value=""><em>Not Specified</em></MenuItem>
                      <MenuItem value="Single">Single</MenuItem>
                      <MenuItem value="Married">Married</MenuItem>
                      <MenuItem value="Divorced">Divorced</MenuItem>
                      <MenuItem value="Widowed">Widowed</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Controller
                  name="bloodGroup"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Blood Group" variant="outlined" error={!!errors.bloodGroup} helperText={errors.bloodGroup?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Controller
                  name="heightFeet"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth type="number" label="Height (Feet)" variant="outlined" error={!!errors.heightFeet} helperText={errors.heightFeet?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Controller
                  name="heightInches"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth type="number" label="Height (Inches)" variant="outlined" error={!!errors.heightInches} helperText={errors.heightInches?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Controller
                  name="weightKg"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth type="number" label="Weight (Kg)" variant="outlined" error={!!errors.weightKg} helperText={errors.weightKg?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="education"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Education" variant="outlined" error={!!errors.education} helperText={errors.education?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="languagesKnown"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Languages Known" variant="outlined" error={!!errors.languagesKnown} helperText={errors.languagesKnown?.message} />
                  )}
                />
              </Grid>

              {/* SECTION: CONTACT DETAILS */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" color="primary" fontWeight={700} sx={{ mb: 1, mt: 1 }}>
                  CONTACT DETAILS
                </Typography>
                <Divider />
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
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Email" variant="outlined" error={!!errors.email} helperText={errors.email?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="emergencyContactNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Emergency Contact Number" variant="outlined" error={!!errors.emergencyContactNumber} helperText={errors.emergencyContactNumber?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Controller
                  name="residentialAddress"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth multiline rows={2} label="Residential Address" variant="outlined" error={!!errors.residentialAddress} helperText={errors.residentialAddress?.message} />
                  )}
                />
              </Grid>

              {/* SECTION: WORK PROFILE */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" color="primary" fontWeight={700} sx={{ mb: 1, mt: 1 }}>
                  WORK PROFILE
                </Typography>
                <Divider />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="employeeId"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Employee ID" variant="outlined" error={!!errors.employeeId} helperText={errors.employeeId?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="employeeExternalId"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="External ID" variant="outlined" error={!!errors.employeeExternalId} helperText={errors.employeeExternalId?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="designation"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Designation" variant="outlined" error={!!errors.designation} helperText={errors.designation?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="department"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Department" variant="outlined" error={!!errors.department} helperText={errors.department?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth select label="Role" variant="outlined" error={!!errors.role} helperText={errors.role?.message} disabled={isSupervisor}>
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
                  name="siteId"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth select label="Assigned Site" variant="outlined" error={!!errors.siteId} helperText={errors.siteId?.message} disabled={isSupervisor}>
                      <MenuItem value=""><em>Unassigned</em></MenuItem>
                      {((sitesData as any)?.data || []).map((site: any) => (
                        <MenuItem key={site.id} value={site.id}>{site.name}</MenuItem>
                      ))}
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

              {/* SECTION: BANK & COMPLIANCE DETAILS */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" color="primary" fontWeight={700} sx={{ mb: 1, mt: 1 }}>
                  BANK & COMPLIANCE DETAILS
                </Typography>
                <Divider />
              </Grid>

              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="bankName"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Bank Name" variant="outlined" error={!!errors.bankName} helperText={errors.bankName?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="bankAccountNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Account Number" variant="outlined" error={!!errors.bankAccountNumber} helperText={errors.bankAccountNumber?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="bankIfscCode"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="IFSC Code" variant="outlined" error={!!errors.bankIfscCode} helperText={errors.bankIfscCode?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="pfNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="PF Number" variant="outlined" error={!!errors.pfNumber} helperText={errors.pfNumber?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="uanNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="UAN Number" variant="outlined" error={!!errors.uanNumber} helperText={errors.uanNumber?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="esicNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="ESIC Number" variant="outlined" error={!!errors.esicNumber} helperText={errors.esicNumber?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="linNumber"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="LIN Number" variant="outlined" error={!!errors.linNumber} helperText={errors.linNumber?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="form11Number"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Form 11 Number" variant="outlined" error={!!errors.form11Number} helperText={errors.form11Number?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="aadhaar"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="Aadhaar Number" variant="outlined" error={!!errors.aadhaar} helperText={errors.aadhaar?.message} />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="pan"
                  control={control}
                  render={({ field }) => (
                    <TextField {...field} fullWidth label="PAN Number" variant="outlined" error={!!errors.pan} helperText={errors.pan?.message} />
                  )}
                />
              </Grid>

              {/* SECTION: STATUTORY & VERIFICATION */}
              <Grid size={{ xs: 12 }}>
                <Typography variant="subtitle2" color="primary" fontWeight={700} sx={{ mb: 1, mt: 1 }}>
                  STATUTORY & VERIFICATION STATUS
                </Typography>
                <Divider />
              </Grid>

              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="policeVerificationStatus"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                      label="Police Verification Status"
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="residentialProofStatus"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                      label="Residential Proof Status"
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Controller
                  name="termsAndConditionsAccepted"
                  control={control}
                  render={({ field }) => (
                    <FormControlLabel
                      control={<Checkbox checked={field.value} onChange={(e) => field.onChange(e.target.checked)} />}
                      label="Terms & Conditions Accepted"
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

      {/* View Details Dialog */}
      <Dialog 
        open={!!employeeToView} 
        onClose={() => {
          setEmployeeToView(null);
          setEmployeeDetails(null);
          setVerificationError(null);
          setRejectingDocId(null);
          setRejectionReason('');
        }} 
        maxWidth="md" 
        fullWidth
        slotProps={{
          paper: {
            sx: { borderRadius: 4, backgroundImage: 'none' }
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, pt: 3, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Employee Profile</span>
          {employeeToView && (
            <Chip 
              label={employeeToView.status} 
              color={employeeToView.status === 'ACTIVE' ? 'success' : 'default'} 
              size="small" 
              sx={{ fontWeight: 700, borderRadius: 1.5 }}
            />
          )}
        </DialogTitle>
        <DialogContent dividers sx={{ py: 3 }}>
          {isDetailsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : employeeDetails ? (
            <Box>
              {verificationError && (
                <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>{verificationError}</Alert>
              )}
              
              <Grid container spacing={3}>
                {/* Basic Personal details */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary" fontWeight={700} gutterBottom>
                    PERSONAL DETAILS
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>FULL NAME</Typography>
                      <Typography variant="body2" fontWeight={600}>{employeeDetails.fullName || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>PHONE</Typography>
                      <Typography variant="body2" fontWeight={600}>{employeeDetails.phone || employeeDetails.phoneNumber || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>EMAIL</Typography>
                      <Typography variant="body2" fontWeight={600}>{employeeDetails.email || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>GENDER</Typography>
                      <Typography variant="body2" fontWeight={600}>{employeeDetails.gender || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>DATE OF BIRTH</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {(employeeDetails.dateOfBirth || employeeDetails.dob)
                          ? new Date(employeeDetails.dateOfBirth || employeeDetails.dob).toLocaleDateString()
                          : '-'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>MARITAL STATUS</Typography>
                      <Typography variant="body2" fontWeight={600}>{employeeDetails.maritalStatus || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>BLOOD GROUP</Typography>
                      <Typography variant="body2" fontWeight={600}>{employeeDetails.bloodGroup || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>HEIGHT / WEIGHT</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {(employeeDetails.heightFeet != null || employeeDetails.heightInches != null)
                          ? `${employeeDetails.heightFeet ?? 0}' ${employeeDetails.heightInches ?? 0}"`
                          : '-'} / {employeeDetails.weightKg != null ? `${employeeDetails.weightKg} kg` : '-'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>EDUCATION</Typography>
                      <Typography variant="body2" fontWeight={600}>{employeeDetails.education || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>LANGUAGES KNOWN</Typography>
                      <Typography variant="body2" fontWeight={600}>{employeeDetails.languagesKnown || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>EMERGENCY CONTACT</Typography>
                      <Typography variant="body2" fontWeight={600}>{employeeDetails.emergencyContactNumber || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>RESIDENTIAL ADDRESS</Typography>
                      <Typography variant="body2" fontWeight={600}>{employeeDetails.residentialAddress || '-'}</Typography>
                    </Box>
                  </Paper>
                </Grid>

                {/* Work Details */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" color="text.secondary" fontWeight={700} gutterBottom>
                    WORK PROFILE
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>ROLE</Typography>
                      <Chip
                        label={employeeDetails.role?.replace('_', ' ') || '-'}
                        color={ROLE_COLORS[employeeDetails.role] || 'default'}
                        size="small"
                        sx={{ fontWeight: 700, mt: 0.5, borderRadius: 1, fontSize: '0.7rem', textTransform: 'uppercase' }}
                      />
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>DESIGNATION</Typography>
                      <Typography variant="body2" fontWeight={600}>{employeeDetails.designation || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>DEPARTMENT</Typography>
                      <Typography variant="body2" fontWeight={600}>{employeeDetails.department || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>JOINING DATE</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {employeeDetails.joiningDate || employeeDetails.enrollmentDate 
                          ? new Date(employeeDetails.joiningDate || employeeDetails.enrollmentDate).toLocaleDateString() 
                          : '-'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>EMPLOYEE ID</Typography>
                      <Typography variant="body2" fontWeight={600}>{employeeDetails.employeeId || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>EXTERNAL ID</Typography>
                      <Typography variant="body2" fontWeight={600}>{employeeDetails.employeeExternalId || '-'}</Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>ASSIGNED SITE</Typography>
                      <Typography variant="body2" fontWeight={600}>
                        {employeeDetails.siteId ? (sitesMap.get(String(employeeDetails.siteId)) || String(employeeDetails.siteId)) : 'Unassigned'}
                      </Typography>
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>FACE REGISTRATION STATUS</Typography>
                      <Chip 
                        label={employeeDetails.hasFaceRegistered ? 'REGISTERED' : 'PENDING'} 
                        color={employeeDetails.hasFaceRegistered ? 'success' : 'warning'} 
                        size="small" 
                        sx={{ fontWeight: 700, mt: 0.5, borderRadius: 1 }}
                      />
                    </Box>
                  </Paper>
                </Grid>

                {/* Bank & Compliance Details */}
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" color="text.secondary" fontWeight={700} gutterBottom>
                    BANK & COMPLIANCE DETAILS
                  </Typography>
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>BANK NAME</Typography>
                        <Typography variant="body2" fontWeight={600}>{employeeDetails.bankName || '-'}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>ACCOUNT NUMBER</Typography>
                        <Typography variant="body2" fontWeight={600}>{employeeDetails.bankAccountNumber || '-'}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>IFSC CODE</Typography>
                        <Typography variant="body2" fontWeight={600}>{employeeDetails.bankIfscCode || '-'}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>PF NUMBER</Typography>
                        <Typography variant="body2" fontWeight={600}>{employeeDetails.pfNumber || '-'}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>UAN NUMBER</Typography>
                        <Typography variant="body2" fontWeight={600}>{employeeDetails.uanNumber || '-'}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>ESIC NUMBER</Typography>
                        <Typography variant="body2" fontWeight={600}>{employeeDetails.esicNumber || '-'}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>LIN NUMBER</Typography>
                        <Typography variant="body2" fontWeight={600}>{employeeDetails.linNumber || '-'}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>FORM 11 NUMBER</Typography>
                        <Typography variant="body2" fontWeight={600}>{employeeDetails.form11Number || '-'}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>AADHAAR NUMBER</Typography>
                        <Typography variant="body2" fontWeight={600}>{employeeDetails.aadhaar || '-'}</Typography>
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>PAN NUMBER</Typography>
                        <Typography variant="body2" fontWeight={600}>{employeeDetails.pan || '-'}</Typography>
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>

                {/* STATUTORY & VERIFICATION STATUS */}
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" color="text.secondary" fontWeight={700} sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Statutory & Verification Status
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>POLICE VERIFICATION</Typography>
                        <Chip 
                          label={employeeDetails.policeVerificationStatus ? 'VERIFIED' : 'PENDING'} 
                          color={employeeDetails.policeVerificationStatus ? 'success' : 'warning'} 
                          size="small" 
                          sx={{ fontWeight: 700, mt: 0.5, borderRadius: 1 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>RESIDENTIAL PROOF</Typography>
                        <Chip 
                          label={employeeDetails.residentialProofStatus ? 'VERIFIED' : 'PENDING'} 
                          color={employeeDetails.residentialProofStatus ? 'success' : 'warning'} 
                          size="small" 
                          sx={{ fontWeight: 700, mt: 0.5, borderRadius: 1 }}
                        />
                      </Grid>
                      <Grid size={{ xs: 12, md: 4 }}>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', fontWeight: 600 }}>TERMS & CONDITIONS</Typography>
                        <Chip 
                          label={employeeDetails.termsAndConditionsAccepted ? 'ACCEPTED' : 'NOT ACCEPTED'} 
                          color={employeeDetails.termsAndConditionsAccepted ? 'success' : 'warning'} 
                          size="small" 
                          sx={{ fontWeight: 700, mt: 0.5, borderRadius: 1 }}
                        />
                      </Grid>
                    </Grid>
                  </Paper>
                </Grid>

                {/* IDENTIFICATION DOCUMENTS */}
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" color="text.secondary" fontWeight={700} sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                    Identification Documents
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  {employeeDetails.documents && employeeDetails.documents.length > 0 ? (
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {employeeDetails.documents.map((doc: any) => {
                        const isDocVerified = doc.verified || doc.isVerified;
                        return (
                          <Paper 
                            key={doc.id} 
                            variant="outlined" 
                            sx={{ 
                              p: 2.5, 
                              borderRadius: 3, 
                              display: 'flex', 
                              flexDirection: 'column',
                              gap: 2,
                              borderColor: isDocVerified
                                ? theme.palette.success.main + '40'
                                : doc.rejectionReason
                                  ? theme.palette.error.main + '40'
                                  : theme.palette.divider 
                            }}
                          >
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <Box>
                                <Typography variant="subtitle2" fontWeight={700}>{doc.type}</Typography>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                  Uploaded on: {doc.createdAt ? new Date(doc.createdAt).toLocaleDateString() : '-'}
                                </Typography>
                              </Box>
                              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                <Button 
                                  variant="text" 
                                  size="small" 
                                  href={doc.fileUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  sx={{ mr: 1 }}
                                >
                                  View File
                                </Button>
                                <Chip 
                                  label={isDocVerified ? 'VERIFIED' : doc.rejectionReason ? 'REJECTED' : 'PENDING VERIFICATION'} 
                                  color={isDocVerified ? 'success' : doc.rejectionReason ? 'error' : 'warning'} 
                                  size="small" 
                                  sx={{ fontWeight: 700, borderRadius: 1 }}
                                />
                              </Box>
                            </Box>

                            {!isDocVerified && !isSupervisor && (
                              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, pt: 1.5, borderTop: `1px solid ${theme.palette.divider}` }}>
                                <Box sx={{ display: 'flex', gap: 2 }}>
                                  <Button 
                                    variant="contained" 
                                    color="success" 
                                    size="small"
                                    onClick={() => handleVerifyDocument(doc.id, true)}
                                    sx={{ borderRadius: 2 }}
                                  >
                                    Approve Document
                                  </Button>
                                  <Button 
                                    variant="outlined" 
                                    color="error" 
                                    size="small"
                                    onClick={() => setRejectingDocId(rejectingDocId === doc.id ? null : doc.id)}
                                    sx={{ borderRadius: 2 }}
                                  >
                                    {rejectingDocId === doc.id ? 'Cancel' : 'Reject Document'}
                                  </Button>
                                </Box>

                                {rejectingDocId === doc.id && (
                                  <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
                                    <TextField
                                      fullWidth
                                      size="small"
                                      label="Rejection Reason"
                                      placeholder="e.g. Aadhaar details are blurred"
                                      value={rejectionReason}
                                      onChange={(e) => setRejectionReason(e.target.value)}
                                    />
                                    <Button 
                                      variant="contained" 
                                      color="error"
                                      size="small"
                                      disabled={!rejectionReason.trim()}
                                      onClick={() => {
                                        handleVerifyDocument(doc.id, false, rejectionReason);
                                        setRejectingDocId(null);
                                        setRejectionReason('');
                                      }}
                                      sx={{ borderRadius: 2 }}
                                    >
                                      Confirm
                                    </Button>
                                  </Box>
                                )}
                              </Box>
                            )}

                            {doc.rejectionReason && (
                              <Box sx={{ mt: 1, p: 1.5, bgcolor: alpha(theme.palette.error.main, 0.05), borderRadius: 2 }}>
                                <Typography variant="caption" color="error" sx={{ fontWeight: 600 }}>REJECTION REASON:</Typography>
                                <Typography variant="body2" color="error" sx={{ mt: 0.5 }}>{doc.rejectionReason}</Typography>
                              </Box>
                            )}
                          </Paper>
                        );
                      })}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">No documents uploaded.</Typography>
                  )}
                </Grid>
              </Grid>
            </Box>
          ) : (
            <Typography>Error loading employee details.</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button 
            onClick={() => {
              setEmployeeToView(null);
              setEmployeeDetails(null);
              setVerificationError(null);
              setRejectingDocId(null);
              setRejectionReason('');
            }} 
            variant="contained" 
            sx={{ borderRadius: 2 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default EmployeesPage;
