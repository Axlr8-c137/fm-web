import React from 'react';
import { Box, Typography, Chip, IconButton, Tooltip, Button } from '@mui/material';
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

const EmployeesPage: React.FC = () => {
  const navigate = useNavigate();
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
      renderCell: () => (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
          <Tooltip title="View">
            <IconButton size="small"><ViewIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton size="small" color="primary"><EditIcon fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton size="small" color="error"><DeleteIcon fontSize="small" /></IconButton>
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
    </Box>
  );
};

export default EmployeesPage;
