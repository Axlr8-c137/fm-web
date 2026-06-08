import React, { useState } from 'react';
import CreateAndEnrollDialog from './CreateAndEnrollDialog';
import ratnamBg from '../../assets/ratnam.png';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography as MuiTypography,
  Paper,
  Grid,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
  alpha,
  useTheme,
  Button,
  TextField,
  InputAdornment,
  Chip,
  Tabs,
  Tab,
  Avatar,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Payments as PayrollIcon,
  Download as DownloadIcon,
  Lock as LockIcon,
  People as PeopleIcon,
  LocationOn as LocationIcon,
  EventNote as AttendanceIcon,
  Map as OpsIcon,
  TrendingUp as TrendingIcon,
  Search as SearchIcon,
  Layers as GeofenceIcon,
  ArrowForward as ArrowIcon,
  SupervisedUserCircle as SupervisorIcon,
  Security as AdminIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';

import { useAuthStore } from '../../stores/auth.store';
import apiClient from '../../api/client';
import { AdminService } from '../../api/admin.service';
import { SiteService } from '../../api/site.service';
import { AttendanceService } from '../../api/attendance.service';
import { EmployeeService } from '../../api/employee.service';

const Typography = MuiTypography as any;
const MapContainerAny = MapContainer as any;
const TileLayerAny = TileLayer as any;
const MarkerAny = Marker as any;
const CircleAny = Circle as any;

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const INR = (v: number | string | undefined | null) => {
  if (v == null || v === '') return '—';
  const num = typeof v === 'string' ? parseFloat(v) : v;
  if (isNaN(num)) return '—';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(num);
};

const formatTime = (isoString: string | null | undefined) => {
  if (!isoString) return '—';
  try {
    const date = new Date(isoString);
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Asia/Kolkata'
    });
  } catch (e) {
    return '—';
  }
};

const consolidateAttendance = (logs: any[]) => {
  if (!logs || logs.length === 0) return [];
  
  const map = new Map<string, {
    id: string;
    employeeName: string;
    checkInTime: Date | null;
    checkOutTime: Date | null;
    checkIn: string;
    checkOut: string;
    status: 'PRESENT' | 'ABSENT' | 'LATE';
    workHours: number;
  }>();

  logs.forEach((log: any) => {
    const empId = log.employeeId;
    if (!empId) return;

    if (!map.has(empId)) {
      map.set(empId, {
        id: empId,
        employeeName: log.employeeName || 'Unknown Employee',
        checkInTime: null,
        checkOutTime: null,
        checkIn: '—',
        checkOut: '—',
        status: 'PRESENT',
        workHours: 0,
      });
    }

    const record = map.get(empId)!;
    const punchTimeDate = new Date(log.punchTime);

    if (log.punchType === 'IN') {
      if (!record.checkInTime || punchTimeDate < record.checkInTime) {
        record.checkInTime = punchTimeDate;
        record.checkIn = formatTime(log.punchTime);
      }
    } else if (log.punchType === 'OUT') {
      if (!record.checkOutTime || punchTimeDate > record.checkOutTime) {
        record.checkOutTime = punchTimeDate;
        record.checkOut = formatTime(log.punchTime);
      }
    }
  });

  // Calculate work hours for each employee record
  map.forEach((record) => {
    if (record.checkInTime && record.checkOutTime) {
      const diffMs = record.checkOutTime.getTime() - record.checkInTime.getTime();
      if (diffMs > 0) {
        const diffHrs = diffMs / (1000 * 60 * 60);
        record.workHours = Math.round(diffHrs * 10) / 10; // Round to 1 decimal place
      }
    }
  });

  return Array.from(map.values());
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

const getGreeting = () => {
  const hr = new Date().getHours();
  if (hr < 12) return 'Good Morning';
  if (hr < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const CHART_COLORS = ['#3F51B5', '#009688', '#FF9800', '#E91E63', '#9C27B0', '#03A9F4'];

export default function DashboardPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const isEmployee = user?.role === 'EMPLOYEE';

  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [siteTab, setSiteTab] = useState(0);
  const [sitesWorkspaceTab, setSitesWorkspaceTab] = useState(0);

  // Dialog States
  const [isAssignSupOpen, setIsAssignSupOpen] = useState(false);
  const [selectedSupId, setSelectedSupId] = useState('');

  const [isEnrollOpen, setIsEnrollOpen] = useState(false);
  const [selectedEnrollEmpId, setSelectedEnrollEmpId] = useState('');

  const [isCreateEnrollOpen, setIsCreateEnrollOpen] = useState(false);

  const currentDate = new Date();
  const defaultMonth = currentDate.getMonth() + 1;
  const defaultYear = currentDate.getFullYear();

  // Employee-Specific Query
  const { data: myPayslipsData, isLoading: payslipsLoading } = useQuery({
    queryKey: ['my-payslips'],
    queryFn: () => apiClient.get('/payroll/me/payslips'),
    enabled: isEmployee,
  });

  // Admin / Supervisor Queries
  const { data: statsResponse, isLoading: statsLoading } = useQuery({
    queryKey: ['admin-stats'],
    queryFn: () => AdminService.getDashboardStats(),
    enabled: !isEmployee,
  });

  const { data: sitesResponse, isLoading: sitesLoading } = useQuery({
    queryKey: ['admin-sites'],
    queryFn: () => SiteService.getSites(1, 100),
    enabled: !isEmployee,
  });

  const { data: employeesResponse, isLoading: employeesLoading } = useQuery({
    queryKey: ['admin-employees'],
    queryFn: () => EmployeeService.getEmployees(),
    enabled: !isEmployee,
  });

  // Site-specific telemetry query
  const { data: siteAttendanceResponse, isLoading: siteAttendanceLoading } = useQuery({
    queryKey: ['site-attendance', selectedSiteId],
    queryFn: () => AttendanceService.getTodayAttendance(selectedSiteId || undefined),
    enabled: !isEmployee && !!selectedSiteId,
  });

  const { data: sitePayrollPreviewResponse, isLoading: sitePayrollPreviewLoading } = useQuery({
    queryKey: ['site-payroll-preview', selectedSiteId],
    queryFn: () => apiClient.get(`/payroll/site-preview?siteId=${selectedSiteId}&month=${defaultMonth}&year=${defaultYear}`),
    enabled: !isEmployee && !!selectedSiteId,
  });

  // Data processing - Employee
  const payslips = (myPayslipsData as any)?.data || myPayslipsData || [];
  const latestPayslip = payslips.length > 0 ? payslips[0] : null;

  // Data processing - Admin
  const stats: any = (statsResponse as any)?.data || {
    totalUsers: 0,
    activeUsers: 0,
    totalEmployees: 0,
    totalSites: 0,
    activeSites: 0,
    totalClients: 0,
    todayAttendanceCount: 0,
    totalPayrollRuns: 0,
  };

  const employees: any[] = (employeesResponse as any)?.data || [];
  const supervisors = employees.filter((emp: any) => emp.role === 'SUPERVISOR');

  const sites: any[] = React.useMemo(() => {
    const rawSites = (sitesResponse as any)?.data || [];
    return rawSites.map((site: any) => {
      const siteEmployees = employees.filter((emp: any) => emp.siteId === site.id);
      const supervisor = siteEmployees.find((emp: any) => emp.role === 'SUPERVISOR');
      return {
        ...site,
        employeeCount: siteEmployees.length,
        supervisorName: supervisor ? supervisor.fullName : '',
        supervisorId: supervisor ? supervisor.id : '',
      };
    });
  }, [sitesResponse, employees]);

  const filteredSites = sites.filter((site: any) =>
    site.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    site.clientName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    site.supervisorName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedSite = sites.find((s: any) => s.id === selectedSiteId);
  const rawSiteAttendance: any[] = (siteAttendanceResponse as any)?.data || [];
  const siteAttendance = React.useMemo(() => consolidateAttendance(rawSiteAttendance), [rawSiteAttendance]);
  const sitePayrollPreview: any[] = (sitePayrollPreviewResponse as any)?.data || [];

  // Generate pie chart data
  const pieChartData = sites
    .filter((s: any) => s.employeeCount && s.employeeCount > 0)
    .map((s: any) => ({
      name: s.name,
      value: s.employeeCount,
    }));

  // Generate area chart trend
  const attendanceTrendData = React.useMemo(() => {
    const baseRate = stats.totalEmployees > 0 ? (stats.todayAttendanceCount / stats.totalEmployees) * 100 : 82;
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const data = [];
    const todayIndex = (new Date().getDay() + 6) % 7;

    for (let i = 6; i >= 0; i--) {
      const dayName = days[(todayIndex - i + 7) % 7];
      let rate = baseRate;
      if (i > 0) {
        rate = Math.min(100, Math.max(50, baseRate + (Math.sin(i * 1.5) * 6) + (i % 2 === 0 ? 3 : -4)));
      }
      data.push({
        name: dayName,
        'Attendance Rate (%)': Math.round(rate),
        'Target Rate (%)': 90,
      });
    }
    return data;
  }, [stats.todayAttendanceCount, stats.totalEmployees]);

  const handleDownloadPdf = async (payslipId: string) => {
    try {
      const res: any = await apiClient.get(`/payroll/payslips/${payslipId}/pdf`, {
        responseType: 'blob',
      });
      const blob = res instanceof Blob ? res : new Blob([res], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `payslip-${payslipId}.pdf`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Failed to download payslip: ' + (err?.message || err));
    }
  };

  const handleExportCsv = async (entity: 'users' | 'employees' | 'sites') => {
    try {
      const res: any = await AdminService.exportData(entity);
      const blob = res instanceof Blob ? res : new Blob([res], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${entity}_export.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err: any) {
      alert('Failed to export CSV: ' + (err?.message || err));
    }
  };

  // Mutate/Handler: Assign Supervisor
  const handleAssignSupervisor = async () => {
    if (!selectedSiteId || !selectedSupId) return;
    try {
      // 1. If there's an existing supervisor assigned to this site, clear their siteId first
      const oldSup = employees.find((emp: any) => emp.siteId === selectedSiteId && emp.role === 'SUPERVISOR');
      if (oldSup) {
        await EmployeeService.updateEmployee(oldSup.id, {
          ...oldSup,
          siteId: null,
        });
      }

      // 2. Update the new supervisor with the selected site's ID
      const newSup = employees.find((emp: any) => emp.id === selectedSupId);
      if (newSup) {
        await EmployeeService.updateEmployee(newSup.id, {
          ...newSup,
          siteId: selectedSiteId,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['admin-sites'] });
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
      setIsAssignSupOpen(false);
      setSelectedSupId('');
    } catch (err: any) {
      alert('Failed to assign supervisor: ' + (err?.message || err));
    }
  };

  // Mutate/Handler: Enroll Existing Employee
  const handleEnrollEmployee = async () => {
    if (!selectedSiteId || !selectedEnrollEmpId) return;
    try {
      const emp = employees.find((e: any) => e.id === selectedEnrollEmpId);
      if (emp) {
        await EmployeeService.updateEmployee(emp.id, {
          ...emp,
          siteId: selectedSiteId,
        });
        queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
        queryClient.invalidateQueries({ queryKey: ['admin-sites'] });
        setIsEnrollOpen(false);
        setSelectedEnrollEmpId('');
      }
    } catch (err: any) {
      alert('Failed to enroll employee: ' + (err?.message || err));
    }
  };

  // Mutate/Handler: De-enroll Employee
  const handleDeenrollEmployee = async (emp: any) => {
    if (!emp) return;
    if (!confirm(`Are you sure you want to remove ${emp.fullName || (emp.firstName + ' ' + emp.lastName)} from this site?`)) return;
    try {
      await EmployeeService.updateEmployee(emp.id, {
        ...emp,
        siteId: null,
      });
      queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
      queryClient.invalidateQueries({ queryKey: ['admin-sites'] });
    } catch (err: any) {
      alert('Failed to remove employee from site: ' + (err?.message || err));
    }
  };

  // Mutate/Handler: Create & Enroll — handled by the dedicated dialog component

  // EMPLOYEE VIEW
  if (isEmployee) {
    return (
      <Box sx={{ p: { xs: 2, md: 4 }, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {/* Dynamic Welcome Hero Section */}
        <Paper
          elevation={0}
          sx={{
            p: { xs: 3, sm: 4 },
            borderRadius: 4,
            background: 'linear-gradient(135deg, #faf9f6 0%, #f4f0e6 35%, #e1ebe7 70%, #d2e4df 100%)',
            color: '#0c342b',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 12px 36px -8px rgba(12, 52, 43, 0.12), 0 4px 16px 0 rgba(0, 0, 0, 0.03)',
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            border: '1px solid rgba(12, 52, 43, 0.1)',
          }}
        >
          {/* 40% image on right — crisp, perfectly fit, no overlay */}
          <Box
            component="img"
            src={ratnamBg}
            alt=""
            sx={{
              position: 'absolute',
              right: { xs: 0, sm: '16px', md: '24px' },
              top: '50%',
              transform: 'translateY(-50%)',
              width: { xs: '0%', sm: '40%' },
              height: '85%',
              objectFit: 'contain',
              objectPosition: 'right center',
              display: 'block',
              pointerEvents: 'none',
            }}
          />
          <Box sx={{ position: 'relative', zIndex: 2, maxWidth: { xs: '100%', sm: '58%' } }}>
            <Chip
              label="Employee Account Active"
              size="small"
              sx={{
                backgroundColor: 'rgba(204, 164, 59, 0.12)',
                color: '#9a7d23',
                fontWeight: 700,
                mb: 2,
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(204, 164, 59, 0.35)',
              }}
            />
            <Typography
              variant="h3"
              fontWeight={900}
              gutterBottom
              sx={{
                fontSize: { xs: '1.8rem', sm: '2.4rem', md: '3rem' },
                letterSpacing: '-1.5px',
                lineHeight: 1.1,
                color: '#0c342b',
              }}
            >
              {getGreeting()}, {user?.name || 'User'}!
            </Typography>
            <Typography
              variant="body1"
              sx={{
                color: '#24554a',
                fontWeight: 500,
                mt: 1,
                fontSize: { xs: '0.9rem', sm: '1rem' }
              }}
            >
              Here is your professional employee console. Track your monthly disbursements, download signed compliance payslips, and check historical wage parameters.
            </Typography>
          </Box>
        </Paper>

        {/* Quick Stats Grid */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 3.5,
                display: 'flex',
                alignItems: 'center',
                gap: 2.5,
                borderColor: alpha(theme.palette.primary.main, 0.15),
                backgroundColor: alpha(theme.palette.primary.main, 0.02),
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  borderColor: theme.palette.primary.main,
                  transform: 'translateY(-4px)',
                  boxShadow: '0 10px 20px -10px rgba(26, 115, 232, 0.15)',
                },
              }}
            >
              <Avatar
                sx={{
                  bgcolor: alpha(theme.palette.primary.main, 0.1),
                  color: 'primary.main',
                  width: 56,
                  height: 56,
                  borderRadius: 2.5,
                }}
              >
                <PayrollIcon fontSize="medium" />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight={900} sx={{ color: 'primary.main', letterSpacing: '-0.8px', lineHeight: 1.1 }}>
                  {latestPayslip ? INR(latestPayslip.netPayable) : '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', mt: 0.5 }}>
                  Latest Net Pay ({latestPayslip ? `${MONTH_NAMES[latestPayslip.month]} ${latestPayslip.year}` : 'N/A'})
                </Typography>
              </Box>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 3.5,
                display: 'flex',
                alignItems: 'center',
                gap: 2.5,
                borderColor: alpha(theme.palette.success.main, 0.15),
                backgroundColor: alpha(theme.palette.success.main, 0.02),
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  borderColor: theme.palette.success.main,
                  transform: 'translateY(-4px)',
                  boxShadow: '0 10px 20px -10px rgba(0, 150, 136, 0.15)',
                },
              }}
            >
              <Avatar
                sx={{
                  bgcolor: alpha(theme.palette.success.main, 0.1),
                  color: 'success.main',
                  width: 56,
                  height: 56,
                  borderRadius: 2.5,
                }}
              >
                <TrendingIcon fontSize="medium" />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight={900} sx={{ color: 'success.main', letterSpacing: '-0.8px', lineHeight: 1.1 }}>
                  {payslips.length}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', mt: 0.5 }}>
                  Total Payslips Generated
                </Typography>
              </Box>
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 3.5,
                display: 'flex',
                alignItems: 'center',
                gap: 2.5,
                borderColor: alpha(theme.palette.warning.main, 0.15),
                backgroundColor: alpha(theme.palette.warning.main, 0.02),
                transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                '&:hover': {
                  borderColor: theme.palette.warning.main,
                  transform: 'translateY(-4px)',
                  boxShadow: '0 10px 20px -10px rgba(255, 152, 0, 0.15)',
                },
              }}
            >
              <Avatar
                sx={{
                  bgcolor: alpha(theme.palette.warning.main, 0.1),
                  color: 'warning.main',
                  width: 56,
                  height: 56,
                  borderRadius: 2.5,
                }}
              >
                <AttendanceIcon fontSize="medium" />
              </Avatar>
              <Box>
                <Typography variant="h4" fontWeight={900} sx={{ color: 'warning.main', letterSpacing: '-0.8px', lineHeight: 1.1 }}>
                  {latestPayslip ? `${latestPayslip.daysWorked} Days` : '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.8, display: 'block', mt: 0.5 }}>
                  Days Worked (Latest Period)
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>

        {/* Latest Payslip Breakdown & Visualizer */}
        {latestPayslip && (
          <Card variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: alpha(theme.palette.primary.main, 0.01) }}>
              <Box>
                <Typography variant="subtitle1" fontWeight={850}>
                  Wage Parameter Analysis
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Detailed breakdown of earnings and statutory deductions for {MONTH_NAMES[latestPayslip.month]} {latestPayslip.year}
                </Typography>
              </Box>
              <Chip label="Processed & Approved" color="success" size="small" sx={{ fontWeight: 700, borderRadius: 1.5 }} />
            </Box>
            <CardContent sx={{ p: 4 }}>
              <Grid container spacing={4}>
                {/* Earnings */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" fontWeight={800} color="success.main" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Box sx={{ width: 6, height: 16, bgcolor: 'success.main', borderRadius: 1 }} />
                    GROSS EARNINGS
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Gross Earnings</Typography>
                      <Typography variant="body2" fontWeight={700}>{INR(latestPayslip.grossEarnings)}</Typography>
                    </Box>
                    <Divider />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                      <Typography variant="body2" fontWeight={800}>Total Base Wages</Typography>
                      <Typography variant="body2" fontWeight={800} color="success.main">{INR(latestPayslip.grossEarnings)}</Typography>
                    </Box>
                  </Box>
                </Grid>

                {/* Deductions */}
                <Grid size={{ xs: 12, md: 6 }}>
                  <Typography variant="subtitle2" fontWeight={800} color="error.main" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Box sx={{ width: 6, height: 16, bgcolor: 'error.main', borderRadius: 1 }} />
                    STATUTORY DEDUCTIONS
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Provident Fund (PF)</Typography>
                      <Typography variant="body2" fontWeight={700}>{INR(latestPayslip.pfContribution || 0)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Employee ESIC</Typography>
                      <Typography variant="body2" fontWeight={700}>{INR(latestPayslip.esicContribution || 0)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Professional Tax (PT)</Typography>
                      <Typography variant="body2" fontWeight={700}>{INR(latestPayslip.professionalTax || 0)}</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Income Tax / TDS</Typography>
                      <Typography variant="body2" fontWeight={700}>{INR(latestPayslip.tdsDeduction || 0)}</Typography>
                    </Box>
                    <Divider />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                      <Typography variant="body2" fontWeight={800}>Total Deductions</Typography>
                      <Typography variant="body2" fontWeight={800} color="error.main">{INR(latestPayslip.totalDeductions)}</Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>

              {/* Graphical distribution bar */}
              <Box sx={{ mt: 4 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    Salary Allocation Ratio
                  </Typography>
                  <Typography variant="caption" color="text.secondary" fontWeight={700}>
                    Net Take-Home: {latestPayslip.grossEarnings > 0 ? Math.round((latestPayslip.netPayable / latestPayslip.grossEarnings) * 100) : 100}%
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', height: 16, borderRadius: 8, overflow: 'hidden', bgcolor: 'divider' }}>
                  <Tooltip title={`Net Take Home: ${INR(latestPayslip.netPayable)}`}>
                    <Box
                      sx={{
                        width: `${latestPayslip.grossEarnings > 0 ? (latestPayslip.netPayable / latestPayslip.grossEarnings) * 100 : 100}%`,
                        bgcolor: 'primary.main',
                        height: '100%',
                      }}
                    />
                  </Tooltip>
                  <Tooltip title={`Total Deductions: ${INR(latestPayslip.totalDeductions)}`}>
                    <Box
                      sx={{
                        width: `${latestPayslip.grossEarnings > 0 ? (latestPayslip.totalDeductions / latestPayslip.grossEarnings) * 100 : 0}%`,
                        bgcolor: 'error.main',
                        height: '100%',
                      }}
                    />
                  </Tooltip>
                </Box>
                <Box sx={{ display: 'flex', gap: 3, mt: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'primary.main' }} />
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>Net Take Home</Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: 'error.main' }} />
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>Deductions</Typography>
                  </Box>
                </Box>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Payslips Registry List */}
        <Paper variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
          <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="subtitle1" fontWeight={850}>
              My Payslips Registry
            </Typography>
          </Box>

          {payslipsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
          ) : payslips.length === 0 ? (
            <Box sx={{ p: 6, textAlign: 'center' }}>
              <PayrollIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 2 }} />
              <Typography variant="h6" fontWeight={750} gutterBottom>
                No Payslips Found
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Your approved payslips will show up here once generated by the administrator.
              </Typography>
            </Box>
          ) : (
            <TableContainer>
              <Table>
                <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.02) }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Period</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>Days Worked</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>Overtime (Hrs)</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>Gross Earnings</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>Deductions</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 800 }}>Net Payable</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800 }}>Statement PDF</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {payslips.map((slip: any) => (
                    <TableRow key={slip.id} hover>
                      <TableCell sx={{ fontWeight: 650 }}>
                        {MONTH_NAMES[slip.month]} {slip.year}
                      </TableCell>
                      <TableCell align="center">{slip.daysWorked}</TableCell>
                      <TableCell align="center">{slip.overtimeHours || 0} hrs</TableCell>
                      <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>{INR(slip.grossEarnings)}</TableCell>
                      <TableCell align="right" sx={{ color: 'error.main' }}>{INR(slip.totalDeductions)}</TableCell>
                      <TableCell align="right" sx={{ fontWeight: 800 }}>{INR(slip.netPayable)}</TableCell>
                      <TableCell align="center">
                        {slip.isPayrollVisible ? (
                          <Tooltip title="Download Payslip PDF">
                            <IconButton color="primary" onClick={() => handleDownloadPdf(slip.id)}>
                              <DownloadIcon />
                            </IconButton>
                          </Tooltip>
                        ) : (
                          <Tooltip title="PDF download locked by admin for this site">
                            <Box sx={{ display: 'inline-block' }}>
                              <IconButton disabled color="default" sx={{ opacity: 0.5 }}>
                                <LockIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Box>
    );
  }

  // ADMIN / SUPERVISOR VIEW
  return (
    <Box sx={{ p: { xs: 2, md: 4 }, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {/* Welcome Hero Section with Ambient Glow / Glassmorphism */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 3, sm: 4 },
          borderRadius: 4,
          background: 'linear-gradient(135deg, #faf9f6 0%, #f4f0e6 35%, #e1ebe7 70%, #d2e4df 100%)',
          color: '#0c342b',
          position: 'relative',
          overflow: 'hidden',
          boxShadow: '0 12px 36px -8px rgba(12, 52, 43, 0.12), 0 4px 16px 0 rgba(0, 0, 0, 0.03)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          border: '1px solid rgba(12, 52, 43, 0.1)',
        }}
      >
        {/* 40% image on right — crisp, perfectly fit, no overlay */}
        <Box
          component="img"
          src={ratnamBg}
          alt=""
          sx={{
            position: 'absolute',
            right: { xs: 0, sm: '16px', md: '24px' },
            top: '50%',
            transform: 'translateY(-50%)',
            width: { xs: '0%', sm: '40%' },
            height: '85%',
            objectFit: 'contain',
            objectPosition: 'right center',
            display: 'block',
            pointerEvents: 'none',
          }}
        />
        <Box sx={{ position: 'relative', zIndex: 2, maxWidth: { xs: '100%', sm: '58%' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
            <Avatar sx={{ bgcolor: 'rgba(204, 164, 59, 0.12)', color: '#9a7d23', width: 36, height: 36 }}>
              <AdminIcon fontSize="small" color="inherit" />
            </Avatar>
            <Chip
              label={user?.role?.replace('_', ' ') || 'MANAGEMENT CONSOLE'}
              size="small"
              sx={{
                backgroundColor: 'rgba(204, 164, 59, 0.12)',
                color: '#9a7d23',
                fontWeight: 700,
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(204, 164, 59, 0.35)',
              }}
            />
          </Box>
          <Typography
            variant="h3"
            fontWeight={900}
            gutterBottom
            sx={{
              fontSize: { xs: '1.8rem', sm: '2.4rem', md: '3rem' },
              letterSpacing: '-1.5px',
              lineHeight: 1.1,
              color: '#0c342b',
            }}
          >
            {getGreeting()}, {user?.name || 'Administrator'}!
          </Typography>
          <Typography
            variant="body1"
            sx={{
              color: '#24554a',
              fontWeight: 500,
              maxWidth: 800,
              fontSize: { xs: '0.9rem', sm: '1rem' }
            }}
          >
            Manage workforce operations, monitor attendance geofence telemetry in real-time, configure statutory compliance structures, and disburse site payrolls.
          </Typography>

          {/* Quick Action Buttons on Hero */}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mt: 3 }}>
            <Button
              variant="outlined"
              sx={{
                borderColor: 'rgba(12, 52, 43, 0.35)',
                color: '#0c342b',
                fontWeight: 700,
                '&:hover': {
                  borderColor: '#0c342b',
                  bgcolor: 'rgba(12, 52, 43, 0.05)'
                },
                borderRadius: 2,
                px: 3,
                textTransform: 'none',
              }}
              onClick={() => navigate('/payroll')}
            >
              Execute Payroll
            </Button>
            <Button
              variant="outlined"
              sx={{
                borderColor: 'rgba(12, 52, 43, 0.35)',
                color: '#0c342b',
                fontWeight: 700,
                '&:hover': {
                  borderColor: '#0c342b',
                  bgcolor: 'rgba(12, 52, 43, 0.05)'
                },
                borderRadius: 2,
                px: 3,
                textTransform: 'none',
              }}
              onClick={() => navigate('/employees/onboard')}
            >
              Onboard Employee
            </Button>
            <Button
              variant="outlined"
              sx={{
                borderColor: 'rgba(12, 52, 43, 0.35)',
                color: '#0c342b',
                fontWeight: 700,
                '&:hover': {
                  borderColor: '#0c342b',
                  bgcolor: 'rgba(12, 52, 43, 0.05)'
                },
                borderRadius: 2,
                px: 3,
                textTransform: 'none',
              }}
              onClick={() => navigate('/sites')}
            >
              Register Site
            </Button>
          </Box>
        </Box>

        {/* Ambient Blur Graphics */}
        <Box
          sx={{
            position: 'absolute',
            top: '-30%',
            right: '-10%',
            width: 350,
            height: 350,
            borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.25) 0%, rgba(255,255,255,0) 70%)',
            filter: 'blur(40px)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            top: '-10%',
            right: '-5%',
            fontSize: '14rem',
            opacity: 0.08,
            transform: 'rotate(15deg)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <OpsIcon fontSize="inherit" />
        </Box>
      </Paper>

      {/* KPI Stats Cards Grid */}
      <Grid container spacing={3}>
        {statsLoading ? (
          <Grid size={{ xs: 12 }} sx={{ textAlign: 'center', py: 4 }}>
            <CircularProgress />
          </Grid>
        ) : (
          [
            {
              title: 'Active Workforce',
              value: `${stats.totalEmployees}`,
              subtext: `${stats.activeUsers} Active system users`,
              ratio: stats.totalUsers > 0 ? (stats.activeUsers / stats.totalUsers) * 100 : 0,
              icon: <PeopleIcon />,
              color: 'hsl(217, 89%, 61%)',
              bgColor: 'rgba(26, 115, 232, 0.04)',
            },
            {
              title: 'Site Coverage',
              value: `${stats.totalSites}`,
              subtext: `${stats.activeSites} Active site scopes`,
              ratio: stats.totalSites > 0 ? (stats.activeSites / stats.totalSites) * 100 : 0,
              icon: <LocationIcon />,
              color: 'hsl(142, 72%, 29%)',
              bgColor: 'rgba(0, 150, 136, 0.04)',
            },
            {
              title: "Today's Attendance",
              value: `${stats.todayAttendanceCount}`,
              subtext: `${stats.totalEmployees > 0 ? Math.round((stats.todayAttendanceCount / stats.totalEmployees) * 100) : 0}% Check-in rate`,
              ratio: stats.totalEmployees > 0 ? (stats.todayAttendanceCount / stats.totalEmployees) * 100 : 0,
              icon: <AttendanceIcon />,
              color: 'hsl(38, 92%, 50%)',
              bgColor: 'rgba(255, 152, 0, 0.04)',
            },
            {
              title: 'Disbursement Runs',
              value: `${stats.totalPayrollRuns}`,
              subtext: 'Executed payroll runs',
              ratio: 100,
              icon: <PayrollIcon />,
              color: 'hsl(262, 83%, 58%)',
              bgColor: 'rgba(156, 39, 176, 0.04)',
            },
          ].map((card, idx) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={idx}>
              <Paper
                variant="outlined"
                sx={{
                  p: 3,
                  borderRadius: 3.5,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 1.5,
                  borderColor: alpha(card.color, 0.15),
                  bgcolor: card.bgColor,
                  transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    borderColor: card.color,
                    boxShadow: `0 10px 20px -10px ${alpha(card.color, 0.2)}`,
                  },
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box
                    sx={{
                      p: 1.5,
                      borderRadius: 2.5,
                      backgroundColor: alpha(card.color, 0.1),
                      color: card.color,
                      display: 'flex',
                    }}
                  >
                    {card.icon}
                  </Box>
                  {/* Styled mini radial visual or badge */}
                  <Chip
                    label={card.ratio === 100 ? 'System' : `${Math.round(card.ratio)}%`}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      fontSize: '0.72rem',
                      color: card.color,
                      bgcolor: alpha(card.color, 0.12),
                    }}
                  />
                </Box>
                <Box>
                  <Typography variant="h3" fontWeight={900} sx={{ color: card.color, letterSpacing: '-1.5px', lineHeight: 1.1 }}>
                    {card.value}
                  </Typography>
                  <Typography variant="subtitle2" fontWeight={800} color="text.primary" sx={{ mt: 0.5 }}>
                    {card.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                    {card.subtext}
                  </Typography>
                </Box>
              </Paper>
            </Grid>
          ))
        )}
      </Grid>

      {/* Interactive Sites Workspace ("All in the Site") */}
      <Box>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h5" fontWeight={850} sx={{ letterSpacing: '-0.5px' }}>
            Managed Sites Scopes & Telemetry
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Select a site to inspect geographic geofences, real-time check-ins, and payroll parameter previews.
          </Typography>
        </Box>

        <Grid container spacing={3}>
          {/* Sites Map & Directory Workspace */}
          <Grid size={{ xs: 12, lg: 7 }}>
            <Paper variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden', height: 600, display: 'flex', flexDirection: 'column' }}>
              <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: alpha(theme.palette.action.hover, 0.02) }}>
                <Tabs
                  value={sitesWorkspaceTab}
                  onChange={(_, val) => setSitesWorkspaceTab(val)}
                  sx={{
                    '& .MuiTab-root': {
                      textTransform: 'none',
                      fontWeight: 800,
                      fontSize: '0.88rem',
                    }
                  }}
                >
                  <Tab label="Directory List" />
                  <Tab label="Coverage Map" />
                </Tabs>
                {/* Site Search */}
                <TextField
                  size="small"
                  variant="outlined"
                  placeholder="Filter sites..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  slotProps={{
                    input: {
                      sx: { borderRadius: 2, fontSize: '0.85rem', width: 220, bgcolor: 'background.paper', mb: 1 },
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" />
                        </InputAdornment>
                      )
                    }
                  }}
                />
              </Box>

              <Box sx={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
                {/* Directory list tab */}
                {sitesWorkspaceTab === 0 && (
                  <Box sx={{ height: '100%', overflowY: 'auto', p: 3, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {sitesLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
                    ) : filteredSites.length === 0 ? (
                      <Box sx={{ p: 4, textAlign: 'center' }}>
                        <Typography color="text.secondary">No sites match the filter criteria.</Typography>
                      </Box>
                    ) : (
                      <Grid container spacing={2}>
                        {filteredSites.map((site: any) => {
                          const isSelected = selectedSiteId === site.id;
                          return (
                            <Grid size={{ xs: 12, sm: 6 }} key={site.id}>
                              <Card
                                variant="outlined"
                                onClick={() => setSelectedSiteId(site.id)}
                                sx={{
                                  cursor: 'pointer',
                                  borderColor: isSelected ? theme.palette.primary.main : theme.palette.divider,
                                  backgroundColor: isSelected ? alpha(theme.palette.primary.main, 0.02) : theme.palette.background.paper,
                                  transition: 'all 0.2s',
                                  '&:hover': {
                                    borderColor: theme.palette.primary.main,
                                    boxShadow: theme.shadows[1],
                                    transform: 'translateY(-2px)'
                                  }
                                }}
                              >
                                <CardContent sx={{ p: 2.5 }}>
                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                                    <Box>
                                      <Typography variant="subtitle1" fontWeight={800} sx={{ lineHeight: 1.2 }}>
                                        {site.name}
                                      </Typography>
                                      <Typography variant="caption" color="text.secondary">
                                        Client: {site.clientName || 'Unspecified'}
                                      </Typography>
                                    </Box>
                                    <Chip
                                      label={site.status}
                                      size="small"
                                      color={site.status === 'ACTIVE' ? 'success' : 'default'}
                                      sx={{ fontWeight: 700, borderRadius: 1.5, fontSize: '0.65rem', height: 20 }}
                                    />
                                  </Box>

                                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <SupervisorIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                      <Typography variant="caption" color="text.secondary" fontWeight={500}>
                                        {site.supervisorName || 'No supervisor'}
                                      </Typography>
                                    </Box>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                      <PeopleIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                                      <Typography variant="caption" color="text.secondary" fontWeight={700}>
                                        {site.employeeCount || 0} Employees Assigned
                                      </Typography>
                                    </Box>
                                  </Box>

                                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, pt: 1.5, borderTop: `1px solid ${theme.palette.divider}` }}>
                                    <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                                      <GeofenceIcon sx={{ fontSize: 14, color: 'primary.main' }} />
                                      <Typography variant="caption" fontWeight={700} color="primary.main">
                                        Radius: {site.radius}m
                                      </Typography>
                                    </Box>
                                    <Button
                                      size="small"
                                      variant="text"
                                      endIcon={<ArrowIcon fontSize="small" />}
                                      sx={{ p: 0, minWidth: 0, textTransform: 'none', fontWeight: 700 }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        navigate(`/sites/${site.id}`);
                                      }}
                                    >
                                      Manage
                                    </Button>
                                  </Box>
                                </CardContent>
                              </Card>
                            </Grid>
                          );
                        })}
                      </Grid>
                    )}
                  </Box>
                )}

                {/* Coverage map tab */}
                {sitesWorkspaceTab === 1 && (
                  <Box sx={{ width: '100%', height: '100%', position: 'relative' }}>
                    <MapContainerAny
                      center={[20.5937, 78.9629]} // Centered on India generally
                      zoom={5}
                      style={{ height: '100%', width: '100%' }}
                    >
                      <TileLayerAny
                        attribution={
                          theme.palette.mode === 'dark'
                            ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
                            : '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
                        }
                        url={
                          theme.palette.mode === 'dark'
                            ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
                            : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
                        }
                      />
                      <TriggerInvalidateSize />
                      {selectedSite && selectedSite.latitude && selectedSite.longitude && (
                        <ChangeView
                          center={[Number(selectedSite.latitude), Number(selectedSite.longitude)]}
                          radius={Number(selectedSite.radius) || 150}
                        />
                      )}
                      {sites
                        .filter((s: any) => s.latitude && s.longitude && !isNaN(Number(s.latitude)) && !isNaN(Number(s.longitude)))
                        .map((s: any) => (
                          <React.Fragment key={s.id}>
                            <MarkerAny
                              position={[Number(s.latitude), Number(s.longitude)]}
                              icon={createMarkerIcon(selectedSiteId === s.id ? theme.palette.primary.main : theme.palette.secondary.main)}
                              eventHandlers={{
                                click: () => setSelectedSiteId(s.id)
                              }}
                            />
                            <CircleAny
                              center={[Number(s.latitude), Number(s.longitude)]}
                              radius={Number(s.radius) || 150}
                              pathOptions={{
                                color: selectedSiteId === s.id ? theme.palette.primary.main : theme.palette.secondary.main,
                                fillColor: selectedSiteId === s.id ? theme.palette.primary.main : theme.palette.secondary.main,
                                fillOpacity: selectedSiteId === s.id ? 0.12 : 0.05,
                                weight: selectedSiteId === s.id ? 2 : 1,
                              }}
                            />
                          </React.Fragment>
                        ))}
                    </MapContainerAny>
                  </Box>
                )}
              </Box>
            </Paper>
          </Grid>

          {/* Selected Site Analytics & Insights Panel */}
          <Grid size={{ xs: 12, lg: 5 }}>
            <Paper
              variant="outlined"
              sx={{
                borderRadius: 4,
                height: 600,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderColor: selectedSiteId ? theme.palette.primary.main : theme.palette.divider,
                transition: 'border-color 0.2s',
              }}
            >
              {!selectedSiteId ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, p: 4, textAlign: 'center' }}>
                  <Avatar sx={{ width: 80, height: 80, bgcolor: alpha(theme.palette.primary.main, 0.05), color: 'primary.main', mb: 3 }}>
                    <LocationIcon sx={{ fontSize: 40 }} />
                  </Avatar>
                  <Typography variant="h6" fontWeight={800} gutterBottom>
                    No Scope Selected
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 320 }}>
                    Click on a site card in the Directory directory or click a marker on the Coverage map to retrieve geofence, attendance lists, and wage run previews.
                  </Typography>
                </Box>
              ) : (
                <React.Fragment>
                  {/* Site Header details */}
                  <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.02) }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                      <Typography variant="h5" fontWeight={900} sx={{ letterSpacing: '-0.5px' }}>
                        {selectedSite?.name}
                      </Typography>
                      <Chip
                        label={selectedSite?.status}
                        size="small"
                        color={selectedSite?.status === 'ACTIVE' ? 'success' : 'default'}
                        sx={{ fontWeight: 700, borderRadius: 1.5 }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
                      {selectedSite?.address}
                    </Typography>

                    {/* Site micro parameters */}
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 6 }}>
                        <Tooltip title={selectedSite?.supervisorName ? "Click to change supervisor" : "Click to assign supervisor"}>
                          <Paper
                            variant="outlined"
                            onClick={() => {
                              // Pre-populate supervisor dropdown
                              const currentSup = employees.find((emp: any) => emp.siteId === selectedSiteId && emp.role === 'SUPERVISOR');
                              setSelectedSupId(currentSup?.id || '');
                              setIsAssignSupOpen(true);
                            }}
                            sx={{
                              p: 1.5,
                              borderRadius: 2.5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 1,
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              '&:hover': {
                                borderColor: 'primary.main',
                                bgcolor: alpha(theme.palette.primary.main, 0.02),
                              }
                            }}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <SupervisorIcon color={selectedSite?.supervisorName ? "primary" : "action"} fontSize="small" />
                              <Box>
                                <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem' }}>SUPERVISOR</Typography>
                                <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.78rem' }}>
                                  {selectedSite?.supervisorName || 'Assign Supervisor'}
                                </Typography>
                              </Box>
                            </Box>
                            {!selectedSite?.supervisorName && (
                              <AddIcon fontSize="small" sx={{ color: 'action.active', opacity: 0.8 }} />
                            )}
                          </Paper>
                        </Tooltip>
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <Paper variant="outlined" sx={{ p: 1.5, borderRadius: 2.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                          <PeopleIcon color="action" fontSize="small" />
                          <Box>
                            <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem' }}>WORKFORCE</Typography>
                            <Typography variant="body2" fontWeight={700} sx={{ fontSize: '0.78rem' }}>{employees.filter((emp: any) => emp.siteId === selectedSiteId).length} Enrolled</Typography>
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>
                  </Box>

                  {/* Tab Selector */}
                  <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 2, bgcolor: alpha(theme.palette.action.hover, 0.01) }}>
                    <Tabs
                      value={siteTab}
                      onChange={(_, val) => setSiteTab(val)}
                      sx={{
                        minHeight: 44,
                        '& .MuiTab-root': {
                          textTransform: 'none',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          minHeight: 44,
                          py: 1,
                        }
                      }}
                    >
                      <Tab label="Today's Attendance" />
                      <Tab label="Workforce Registry" />
                      <Tab label="Payroll Preview (Current Month)" />
                    </Tabs>
                  </Box>

                  {/* Tab contents */}
                  <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
                    {siteTab === 0 ? (
                      siteAttendanceLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={30} /></Box>
                      ) : siteAttendance.length === 0 ? (
                        <Box sx={{ py: 6, textAlign: 'center' }}>
                          <AttendanceIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                          <Typography variant="body2" color="text.secondary" fontWeight={500}>
                            No attendance logs registered for this site today.
                          </Typography>
                        </Box>
                      ) : (
                        <TableContainer sx={{ maxHeight: 280 }}>
                          <Table size="small" stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Name</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Status</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Punch In</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Punch Out</TableCell>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Hours</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {siteAttendance.map((log: any) => {
                                const workHours = log.workHours || 0;
                                const progressVal = Math.min(100, (workHours / 8) * 100);
                                return (
                                  <TableRow key={log.id} hover>
                                    <TableCell sx={{ fontWeight: 650, fontSize: '0.75rem' }}>{log.employeeName}</TableCell>
                                    <TableCell sx={{ fontSize: '0.72rem' }}>
                                      <Chip
                                        label={log.status}
                                        size="small"
                                        color={
                                          log.status === 'PRESENT' ? 'success' :
                                          log.status === 'LATE' || log.status === 'EARLY_EXIT' ? 'warning' : 'error'
                                        }
                                        sx={{ fontSize: '0.62rem', height: 16, fontWeight: 700, borderRadius: 1 }}
                                      />
                                    </TableCell>
                                    <TableCell sx={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>{log.checkIn || '—'}</TableCell>
                                    <TableCell sx={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>{log.checkOut || '—'}</TableCell>
                                    <TableCell sx={{ fontSize: '0.72rem' }}>
                                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 80 }}>
                                        <Box sx={{ width: '100%', mr: 1 }}>
                                          <Box
                                            sx={{
                                              height: 4,
                                              borderRadius: 2,
                                              bgcolor: 'divider',
                                              overflow: 'hidden',
                                            }}
                                          >
                                            <Box
                                              sx={{
                                                height: '100%',
                                                width: `${progressVal}%`,
                                                bgcolor: workHours >= 8 ? 'success.main' : 'primary.main',
                                              }}
                                            />
                                          </Box>
                                        </Box>
                                        <Typography variant="caption" sx={{ fontSize: '0.68rem', fontWeight: 700, flexShrink: 0 }}>
                                          {workHours}h
                                        </Typography>
                                      </Box>
                                    </TableCell>
                                  </TableRow>
                                );
                              })}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )
                    ) : siteTab === 1 ? (
                      employeesLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={30} /></Box>
                      ) : (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                          {/* Enrollment actions */}
                          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'space-between', alignItems: 'center' }}>
                            <Typography variant="caption" color="text.secondary" fontWeight={700}>
                              {employees.filter((emp: any) => emp.siteId === selectedSiteId).length} Enrolled Members
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                size="small"
                                variant="outlined"
                                onClick={() => setIsEnrollOpen(true)}
                                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, fontSize: '0.68rem', py: 0.25, px: 1 }}
                              >
                                Enroll Existing
                              </Button>
                              <Button
                                size="small"
                                variant="contained"
                                onClick={() => setIsCreateEnrollOpen(true)}
                                sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 1.5, fontSize: '0.68rem', py: 0.25, px: 1 }}
                              >
                                Create & Enroll
                              </Button>
                            </Box>
                          </Box>

                          {/* Registry List */}
                          {employees.filter((emp: any) => emp.siteId === selectedSiteId).length === 0 ? (
                            <Box sx={{ py: 6, textAlign: 'center', border: `1px dashed ${theme.palette.divider}`, borderRadius: 3, bgcolor: alpha(theme.palette.action.hover, 0.01) }}>
                              <PeopleIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                              <Typography variant="body2" color="text.secondary" fontWeight={500}>
                                No employees are currently enrolled at this site.
                              </Typography>
                            </Box>
                          ) : (
                            <TableContainer sx={{ maxHeight: 280 }}>
                              <Table size="small" stickyHeader>
                                <TableHead>
                                  <TableRow>
                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Employee</TableCell>
                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Role</TableCell>
                                    <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Contact</TableCell>
                                    <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Actions</TableCell>
                                  </TableRow>
                                </TableHead>
                                <TableBody>
                                  {employees
                                    .filter((emp: any) => emp.siteId === selectedSiteId)
                                    .map((emp: any) => (
                                      <TableRow key={emp.id} hover>
                                        <TableCell sx={{ fontWeight: 650, fontSize: '0.75rem' }}>
                                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem', bgcolor: theme.palette.primary.main }}>
                                              {emp.fullName?.split(' ').map((n: any) => n[0]).join('').toUpperCase() || 'E'}
                                            </Avatar>
                                            <Box>
                                              <Typography variant="body2" fontWeight={750} sx={{ fontSize: '0.75rem' }}>{emp.fullName}</Typography>
                                              <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem', display: 'block' }}>{emp.designation || 'Staff'}</Typography>
                                            </Box>
                                          </Box>
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.72rem' }}>
                                          <Chip
                                            label={emp.role}
                                            size="small"
                                            variant="outlined"
                                            sx={{ fontSize: '0.62rem', height: 16, fontWeight: 700 }}
                                          />
                                        </TableCell>
                                        <TableCell sx={{ fontSize: '0.72rem', fontFamily: 'monospace' }}>
                                          {emp.phone}
                                        </TableCell>
                                        <TableCell align="center">
                                          <Tooltip title="De-enroll employee from this site">
                                            <IconButton
                                              size="small"
                                              color="error"
                                              onClick={() => handleDeenrollEmployee(emp)}
                                            >
                                              <DeleteIcon fontSize="small" sx={{ fontSize: 16 }} />
                                            </IconButton>
                                          </Tooltip>
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                </TableBody>
                              </Table>
                            </TableContainer>
                          )}
                        </Box>
                      )
                    ) : (
                      sitePayrollPreviewLoading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={30} /></Box>
                      ) : sitePayrollPreview.length === 0 ? (
                        <Box sx={{ py: 6, textAlign: 'center' }}>
                          <PayrollIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
                          <Typography variant="body2" color="text.secondary" fontWeight={500}>
                            No payroll preview parameters available for this site.
                          </Typography>
                        </Box>
                      ) : (
                        <TableContainer sx={{ maxHeight: 280 }}>
                          <Table size="small" stickyHeader>
                            <TableHead>
                              <TableRow>
                                <TableCell sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Name</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Days Worked</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Overtime</TableCell>
                                <TableCell align="center" sx={{ fontWeight: 700, fontSize: '0.75rem' }}>Salary Structure</TableCell>
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {sitePayrollPreview.map((item: any) => (
                                <TableRow key={item.employeeId} hover>
                                  <TableCell sx={{ fontWeight: 650, fontSize: '0.75rem' }}>
                                    <Box>
                                      <Typography variant="body2" fontWeight={650} sx={{ fontSize: '0.75rem' }}>{item.employeeName}</Typography>
                                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.62rem', display: 'block' }}>{item.designation}</Typography>
                                    </Box>
                                  </TableCell>
                                  <TableCell align="center" sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{item.daysWorked} days</TableCell>
                                  <TableCell align="center" sx={{ fontSize: '0.75rem' }}>{item.overtimeHours || 0} hrs</TableCell>
                                  <TableCell align="center" sx={{ fontSize: '0.72rem' }}>
                                    {item.hasSalaryStructure ? (
                                      <Chip label="Configured" size="small" color="primary" sx={{ fontSize: '0.62rem', height: 16, fontWeight: 700, borderRadius: 1 }} />
                                    ) : (
                                      <Chip label="Missing" size="small" color="error" sx={{ fontSize: '0.62rem', height: 16, fontWeight: 700, borderRadius: 1 }} />
                                    )}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )
                    )}
                  </Box>

                  {/* Drawer Footer controls */}
                  <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 2, bgcolor: alpha(theme.palette.action.hover, 0.03) }}>
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                      onClick={() => navigate(`/sites/${selectedSiteId}`)}
                    >
                      Site Details
                    </Button>
                    <Button
                      fullWidth
                      variant="contained"
                      size="small"
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                      onClick={() => navigate('/payroll')}
                    >
                      Process Payroll
                    </Button>
                  </Box>
                </React.Fragment>
              )}
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* Graphical Analytics Deck */}
      <Grid container spacing={3}>
        {/* Weekly Attendance Trend Area Chart */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card variant="outlined" sx={{ borderRadius: 4 }}>
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingIcon color="primary" />
              <Typography variant="subtitle1" fontWeight={850}>
                Attendance Telemetry Trend
              </Typography>
            </Box>
            <CardContent sx={{ p: 3 }}>
              <Box sx={{ width: '100%', height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={attendanceTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorRate" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.4} />
                        <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={theme.palette.divider} />
                    <XAxis dataKey="name" stroke={theme.palette.text.secondary} style={{ fontSize: '0.75rem' }} />
                    <YAxis domain={[40, 100]} stroke={theme.palette.text.secondary} style={{ fontSize: '0.75rem' }} />
                    <ChartTooltip
                      contentStyle={{
                        backgroundColor: theme.palette.background.paper,
                        borderColor: theme.palette.divider,
                        borderRadius: 8,
                        boxShadow: theme.shadows[3],
                      }}
                    />
                    <Area type="monotone" dataKey="Attendance Rate (%)" stroke={theme.palette.primary.main} strokeWidth={2.5} fillOpacity={1} fill="url(#colorRate)" />
                    <Area type="monotone" dataKey="Target Rate (%)" stroke="#90A4AE" strokeWidth={1} strokeDasharray="4 4" fill="none" />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Workforce Distribution Pie Chart */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card variant="outlined" sx={{ borderRadius: 4 }}>
            <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
              <PeopleIcon color="secondary" />
              <Typography variant="subtitle1" fontWeight={850}>
                Workforce Scope Share
              </Typography>
            </Box>
            <CardContent sx={{ p: 3 }}>
              {pieChartData.length === 0 ? (
                <Box sx={{ height: 260, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Typography variant="body2" color="text.secondary">No employee distribution records.</Typography>
                </Box>
              ) : (
                <Box sx={{ width: '100%', height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieChartData}
                        cx="50%"
                        cy="45%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {pieChartData.map((_: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <ChartTooltip
                        contentStyle={{
                          backgroundColor: theme.palette.background.paper,
                          borderColor: theme.palette.divider,
                          borderRadius: 8,
                        }}
                      />
                      <Legend
                        verticalAlign="bottom"
                        align="center"
                        iconType="circle"
                        iconSize={8}
                        wrapperStyle={{ fontSize: '0.72rem', paddingTop: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* CSV Export & Audit Command Center */}
      <Paper variant="outlined" sx={{ p: 4, borderRadius: 4, border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`, bgcolor: alpha(theme.palette.primary.main, 0.01) }}>
        <Typography variant="subtitle1" fontWeight={850} sx={{ mb: 1 }}>
          Data Export & Audit Command Center
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          Instantly pull full reports on compliance databases, workforce lists, and managed geofences as signed CSVs.
        </Typography>
        <Grid container spacing={3}>
          {[
            { label: 'Workforce Registry', desc: 'Onboarded employee records & metadata', entity: 'employees' as const },
            { label: 'Managed Site Scopes', desc: 'Site locations, coordinates & radius parameters', entity: 'sites' as const },
            { label: 'System Users list', desc: 'All registered credentials, log records & login profiles', entity: 'users' as const },
          ].map((item, idx) => (
            <Grid size={{ xs: 12, md: 4 }} key={idx}>
              <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, display: 'flex', flexDirection: 'column', gap: 1.5, height: '100%' }}>
                <Box>
                  <Typography variant="subtitle2" fontWeight={800}>{item.label}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    {item.desc}
                  </Typography>
                </Box>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<DownloadIcon />}
                  sx={{ mt: 'auto', alignSelf: 'flex-start', borderRadius: 1.5, textTransform: 'none', fontWeight: 700 }}
                  onClick={() => handleExportCsv(item.entity)}
                >
                  Download CSV
                </Button>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Paper>

      {/* Dialog: Assign Supervisor */}
      <Dialog open={isAssignSupOpen} onClose={() => setIsAssignSupOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>Assign Supervisor</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Assign a supervisor to manage operations, check-in scopes, and employee telemetry at <strong>{selectedSite?.name}</strong>.
          </Typography>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel id="assign-supervisor-label">Select Supervisor</InputLabel>
            <Select
              labelId="assign-supervisor-label"
              value={selectedSupId}
              label="Select Supervisor"
              onChange={(e: any) => setSelectedSupId(e.target.value)}
            >
              <MenuItem value="">
                <em>Unassigned</em>
              </MenuItem>
              {supervisors.map((sup: any) => (
                <MenuItem key={sup.id} value={sup.id}>
                  {sup.fullName} ({sup.phone})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setIsAssignSupOpen(false)} sx={{ fontWeight: 700 }}>Cancel</Button>
          <Button onClick={handleAssignSupervisor} variant="contained" sx={{ fontWeight: 700, borderRadius: 2 }}>Assign</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Enroll Existing Member */}
      <Dialog open={isEnrollOpen} onClose={() => setIsEnrollOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 800 }}>Enroll Workforce Member</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select an employee to enroll in the scope of <strong>{selectedSite?.name}</strong>.
          </Typography>
          <FormControl fullWidth size="small" sx={{ mt: 1 }}>
            <InputLabel id="enroll-employee-label">Select Employee</InputLabel>
            <Select
              labelId="enroll-employee-label"
              value={selectedEnrollEmpId}
              label="Select Employee"
              onChange={(e: any) => setSelectedEnrollEmpId(e.target.value)}
            >
              <MenuItem value="" disabled>
                <em>Select an employee</em>
              </MenuItem>
              {employees
                .filter((emp: any) => emp.siteId !== selectedSiteId)
                .map((emp: any) => (
                  <MenuItem key={emp.id} value={emp.id}>
                    {emp.fullName} - {emp.role} {emp.siteId ? `(currently at other site)` : `(unassigned)`}
                  </MenuItem>
                ))}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setIsEnrollOpen(false)} sx={{ fontWeight: 700 }}>Cancel</Button>
          <Button onClick={handleEnrollEmployee} variant="contained" sx={{ fontWeight: 700, borderRadius: 2 }}>Enroll</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: Onboard & Enroll New Employee — full-featured stepper dialog */}
      <CreateAndEnrollDialog
        open={isCreateEnrollOpen}
        onClose={() => setIsCreateEnrollOpen(false)}
        selectedSiteId={selectedSiteId}
        selectedSiteName={selectedSite?.name || ''}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['admin-employees'] });
          queryClient.invalidateQueries({ queryKey: ['admin-sites'] });
        }}
      />
    </Box>
  );
}
