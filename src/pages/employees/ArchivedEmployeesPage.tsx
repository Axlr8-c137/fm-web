import React, { useState } from 'react';
import { Box, Typography as MuiTypography, Chip, IconButton, Tooltip, Button, Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, TextField, CircularProgress, Alert, alpha, useTheme, InputAdornment } from '@mui/material';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import type { GridColDef } from '@mui/x-data-grid';
import { RestoreFromTrash as RestoreIcon, History as HistoryIcon, Search as SearchIcon, Clear as ClearIcon } from '@mui/icons-material';
import { DataTable } from '../../components/common/DataTable';
import { EmployeeService } from '../../api/employee.service';
import apiClient from '../../api/client';
import type { Employee } from '../../types/employee';

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

const ArchivedEmployeesPage: React.FC = () => {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const [archivedSearch, setArchivedSearch] = useState('');
  const [employeeToRestore, setEmployeeToRestore] = useState<Employee | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);

  const { data: archivedResponse, isLoading: isArchivedLoading } = useQuery({
    queryKey: ['archivedEmployees', archivedSearch],
    queryFn: () => EmployeeService.getArchivedEmployees(archivedSearch),
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

  const archivedRows = (archivedResponse as any)?.data || [];

  const calculateDaysRemaining = (updatedAt: string) => {
    if (!updatedAt) return 90;
    const deletedDate = new Date(updatedAt);
    const today = new Date();
    const diffTime = today.getTime() - deletedDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    const remaining = 90 - diffDays;
    return remaining > 0 ? remaining : 0;
  };

  const handleRestoreConfirm = async () => {
    if (!employeeToRestore) return;
    setIsRestoring(true);
    setRestoreError(null);
    try {
      await EmployeeService.restoreEmployee(employeeToRestore.id);
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      queryClient.invalidateQueries({ queryKey: ['archivedEmployees'] });
      setEmployeeToRestore(null);
    } catch (error: any) {
      console.error("Failed to restore employee", error);
      const errData = (error.code && error.message) ? error : (error.response?.data?.error || error.response?.data);
      setRestoreError(errData?.message || 'Failed to restore employee. The email or phone might already be in use.');
    } finally {
      setIsRestoring(false);
    }
  };

  const renderDaysRemainingChip = (updatedAt: string) => {
    const remaining = calculateDaysRemaining(updatedAt);
    let color: 'success' | 'warning' | 'error' = 'success';
    if (remaining <= 30) {
      color = 'error';
    } else if (remaining <= 60) {
      color = 'warning';
    }

    return (
      <Chip
        label={`${remaining} days left`}
        color={color}
        size="small"
        variant="outlined"
        sx={{ fontWeight: 600, borderRadius: '6px' }}
      />
    );
  };

  const archivedColumns: GridColDef[] = [
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
      headerName: 'Original Email', 
      width: 220,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params) => {
        // Strip the deletion suffix for display purposes
        let displayEmail = params.value || '-';
        if (displayEmail !== '-') {
          const idx = displayEmail.lastIndexOf('.deleted.');
          if (idx !== -1) displayEmail = displayEmail.substring(0, idx);
        }
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2" color="text.secondary">
              {displayEmail}
            </Typography>
          </Box>
        );
      }
    },
    { 
      field: 'phone', 
      headerName: 'Original Phone', 
      width: 160,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params) => {
        // Strip the deletion suffix for display purposes
        let displayPhone = params.value || '-';
        if (displayPhone !== '-') {
          const idx = displayPhone.lastIndexOf('-d');
          if (idx !== -1) displayPhone = displayPhone.substring(0, idx);
        }
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace' }}>
              {displayPhone}
            </Typography>
          </Box>
        );
      }
    },
    { 
      field: 'role', 
      headerName: 'Role', 
      width: 150,
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
      field: 'updatedAt',
      headerName: 'Deleted Date',
      width: 180,
      headerAlign: 'center',
      align: 'center',
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', height: '100%' }}>
          <Typography variant="body2" color="text.secondary">
            {params.value ? new Date(params.value).toLocaleDateString() : '-'}
          </Typography>
        </Box>
      )
    },
    {
      field: 'daysRemaining',
      headerName: 'Retention Status',
      width: 150,
      headerAlign: 'center',
      align: 'center',
      valueGetter: (_, row) => row.updatedAt,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          {renderDaysRemainingChip(params.value)}
        </Box>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      headerAlign: 'center',
      align: 'center',
      sortable: false,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Tooltip title="Restore / Revert Employee">
            <IconButton
              size="small"
              color="success"
              onClick={() => setEmployeeToRestore(params.row as Employee)}
              sx={{
                border: `1px solid ${alpha(theme.palette.success.main, 0.3)}`,
                backgroundColor: alpha(theme.palette.success.main, 0.05),
                '&:hover': {
                  backgroundColor: alpha(theme.palette.success.main, 0.15),
                }
              }}
            >
              <RestoreIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box 
            sx={{ 
              p: 1.5, 
              borderRadius: 3, 
              backgroundColor: alpha(theme.palette.text.primary, 0.04), 
              color: theme.palette.text.secondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <HistoryIcon fontSize="medium" />
          </Box>
          <Box>
            <Typography variant="h4" fontWeight={700} gutterBottom sx={{ mb: 0.5 }}>
              Archived Records
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Employees soft-deleted within the last 90 days. Restoring reactivates their profiles and returns them to the employee list.
            </Typography>
          </Box>
        </Box>
      </Box>

      {/* Search Bar for Archived Records */}
      <Box sx={{ mb: 3 }}>
        <TextField
          placeholder="Search archived employees by name..."
          value={archivedSearch}
          onChange={(e) => setArchivedSearch(e.target.value)}
          variant="outlined"
          size="small"
          fullWidth
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon color="action" />
                </InputAdornment>
              ),
              endAdornment: archivedSearch && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setArchivedSearch('')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
              sx: {
                borderRadius: 2.5,
                backgroundColor: alpha(theme.palette.text.primary, 0.02),
                '&:hover': {
                  backgroundColor: alpha(theme.palette.text.primary, 0.04),
                },
                '&.Mui-focused': {
                  backgroundColor: 'background.paper',
                  boxShadow: `0 0 0 2px ${alpha(theme.palette.primary.main, 0.2)}`,
                },
                transition: 'all 0.2s',
              }
            }
          }}
        />
      </Box>

      <DataTable
        rows={archivedRows}
        columns={archivedColumns}
        loading={isArchivedLoading}
        getRowId={(row) => row.id}
      />

      {/* Restore Dialog */}
      <Dialog open={!!employeeToRestore} onClose={() => !isRestoring && setEmployeeToRestore(null)}>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Restore Employee</DialogTitle>
        <DialogContent>
          {restoreError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{restoreError}</Alert>
          )}
          <DialogContentText>
            Are you sure you want to restore employee <strong>{employeeToRestore?.fullName}</strong>?
            This will reactivate their user account and return them to the active employees list.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2.5, pt: 1.5 }}>
          <Button onClick={() => setEmployeeToRestore(null)} color="inherit" disabled={isRestoring}>Cancel</Button>
          <Button onClick={handleRestoreConfirm} color="success" variant="contained" disabled={isRestoring}>
            {isRestoring ? <CircularProgress size={24} color="inherit" /> : 'Restore'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ArchivedEmployeesPage;
