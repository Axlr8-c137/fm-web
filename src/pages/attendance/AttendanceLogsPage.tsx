import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  CalendarMonth as DateIcon,
  Login as CheckInIcon,
  Logout as CheckOutIcon,
  Verified as VerifiedIcon,
} from '@mui/icons-material';
import { AttendanceService } from '../../api/attendance.service';
import { DataTable } from '../../components/common/DataTable';
import type { GridColDef } from '@mui/x-data-grid';
import { format } from 'date-fns';

export default function AttendanceLogsPage() {
  const theme = useTheme();
  
  const { data, isLoading } = useQuery({
    queryKey: ['attendance-logs'],
    queryFn: () => AttendanceService.getLogs({ page: 0, size: 50 }),
  });

  const columns: GridColDef[] = [
    {
      field: 'timestamp',
      headerName: 'Time',
      width: 180,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <DateIcon fontSize="small" color="action" />
          <Typography variant="body2" fontWeight={500}>
            {format(new Date(params.value), 'MMM dd, HH:mm')}
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
            {params.value.charAt(0)}
          </Avatar>
          <Typography variant="body2" fontWeight={600}>
            {params.value}
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
      field: 'type',
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
      field: 'verificationMethod',
      headerName: 'Verification',
      width: 150,
      renderCell: (params) => (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip
            label={params.value}
            size="small"
            sx={{ fontSize: '0.7rem', fontWeight: 700 }}
          />
          {params.row.isVerified && (
            <Tooltip title="Verified">
              <VerifiedIcon color="success" sx={{ fontSize: 18 }} />
            </Tooltip>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Attendance Logs
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Real-time tracking of employee check-ins and check-outs
        </Typography>
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
