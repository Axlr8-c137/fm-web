import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Button,
  Chip,
  IconButton,
  Tooltip,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Visibility as ViewIcon,
  LocationOn as LocationIcon,
  Business as SiteIcon,
} from '@mui/icons-material';
import { SiteService } from '../../api/site.service';
import { DataTable } from '../../components/common/DataTable';
import type { GridColDef } from '@mui/x-data-grid';

export default function SiteListPage() {
  const theme = useTheme();
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: () => SiteService.getSites(),
  });

  const columns: GridColDef[] = [
    {
      field: 'name',
      headerName: 'Site Name',
      flex: 1,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box
            sx={{
              p: 1,
              borderRadius: 2,
              backgroundColor: theme.palette.primary.main + '10',
              color: theme.palette.primary.main,
              display: 'flex',
            }}
          >
            <SiteIcon fontSize="small" />
          </Box>
          <Typography variant="body2" fontWeight={600}>
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <LocationIcon fontSize="inherit" color="action" />
          <Typography variant="body2" color="text.secondary" noWrap>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: 'supervisorName',
      headerName: 'Supervisor',
      flex: 1,
      valueGetter: (params: any) => params || 'Unassigned',
    },
    {
      field: 'employeeCount',
      headerName: 'Employees',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Chip
          label={params.value || 0}
          size="small"
          variant="outlined"
          sx={{ fontWeight: 600 }}
        />
      ),
    },
    {
      field: 'status',
      headerName: 'Status',
      width: 120,
      renderCell: (params) => (
        <Chip
          label={params.value}
          size="small"
          color={params.value === 'ACTIVE' ? 'success' : 'default'}
          sx={{ fontWeight: 700, borderRadius: 1.5 }}
        />
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      renderCell: (params) => (
        <Tooltip title="View Details">
          <IconButton
            size="small"
            onClick={() => navigate(`/sites/${params.row.id}`)}
            color="primary"
          >
            <ViewIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          mb: 4,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Site Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your operational sites and geofences
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
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

      <DataTable
        rows={data?.data?.data || []}
        columns={columns}
        loading={isLoading}
        getRowId={(row) => row.id}
      />
    </Box>
  );
}
