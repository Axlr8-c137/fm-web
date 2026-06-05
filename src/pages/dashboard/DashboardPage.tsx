import { useQuery } from '@tanstack/react-query';
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
} from '@mui/icons-material';
import { useAuthStore } from '../../stores/auth.store';
import apiClient from '../../api/client';
import { useNavigate } from 'react-router-dom';

const Typography = MuiTypography as any;

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

export default function DashboardPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const isEmployee = user?.role === 'EMPLOYEE';

  // Employee Specific Query
  const { data: myPayslipsData, isLoading: payslipsLoading } = useQuery({
    queryKey: ['my-payslips'],
    queryFn: () => apiClient.get('/payroll/me/payslips'),
    enabled: isEmployee,
  });

  // Admin / General Queries (Pre-load counts for general dashboard)
  const { data: employeesData } = useQuery({
    queryKey: ['employees-count'],
    queryFn: () => apiClient.get('/employees?limit=1'),
    enabled: !isEmployee,
  });

  const { data: sitesData } = useQuery({
    queryKey: ['sites-count'],
    queryFn: () => apiClient.get('/sites?limit=1'),
    enabled: !isEmployee,
  });

  const { data: runsData } = useQuery({
    queryKey: ['runs-count'],
    queryFn: () => apiClient.get('/payroll/runs?limit=1'),
    enabled: !isEmployee,
  });

  const payslips = (myPayslipsData as any)?.data || myPayslipsData || [];
  const latestPayslip = payslips.length > 0 ? payslips[0] : null;

  const employeeCount = (employeesData as any)?.meta?.total || (employeesData as any)?.data?.length || 0;
  const siteCount = (sitesData as any)?.meta?.total || (sitesData as any)?.data?.length || 0;
  const runsCount = (runsData as any)?.meta?.total || (runsData as any)?.data?.length || 0;

  // Safe Authorized Payslip PDF Download
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

  if (isEmployee) {
    return (
      <Box sx={{ p: 4 }}>
        {/* Welcome Section */}
        <Paper
          elevation={0}
          sx={{
            p: 4,
            borderRadius: 4,
            mb: 4,
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            color: 'primary.contrastText',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <Box sx={{ position: 'relative', zIndex: 2 }}>
            <Typography variant="h4" fontWeight={900} gutterBottom sx={{ letterSpacing: '-0.8px' }}>
              Welcome back, {user?.name}!
            </Typography>
            <Typography variant="body1" sx={{ opacity: 0.85, fontWeight: 500 }}>
              Here is your personal employee dashboard. View and keep track of your monthly pay slips and disbursements.
            </Typography>
          </Box>
          <Box
            sx={{
              position: 'absolute',
              top: '-20%',
              right: '-5%',
              fontSize: '12rem',
              opacity: 0.1,
              transform: 'rotate(15deg)',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            <PayrollIcon fontSize="inherit" />
          </Box>
        </Paper>

        {/* Quick Stats Grid */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Paper
              variant="outlined"
              sx={{
                p: 3,
                borderRadius: 3.5,
                display: 'flex',
                alignItems: 'center',
                gap: 2.5,
                borderColor: alpha(theme.palette.primary.main, 0.2),
                backgroundColor: alpha(theme.palette.primary.main, 0.02),
              }}
            >
              <Box sx={{ p: 1.5, borderRadius: 2.5, backgroundColor: alpha(theme.palette.primary.main, 0.1), color: 'primary.main', display: 'flex' }}>
                <PayrollIcon fontSize="medium" />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={850} sx={{ color: 'primary.main', letterSpacing: '-0.5px' }}>
                  {latestPayslip ? INR(latestPayslip.netPayable) : '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
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
                borderColor: alpha(theme.palette.success.main, 0.2),
                backgroundColor: alpha(theme.palette.success.main, 0.02),
              }}
            >
              <Box sx={{ p: 1.5, borderRadius: 2.5, backgroundColor: alpha(theme.palette.success.main, 0.1), color: 'success.main', display: 'flex' }}>
                <TrendingIcon fontSize="medium" />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={850} sx={{ color: 'success.main', letterSpacing: '-0.5px' }}>
                  {payslips.length}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Total Payslips Available
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
                borderColor: alpha(theme.palette.warning.main, 0.2),
                backgroundColor: alpha(theme.palette.warning.main, 0.02),
              }}
            >
              <Box sx={{ p: 1.5, borderRadius: 2.5, backgroundColor: alpha(theme.palette.warning.main, 0.1), color: 'warning.main', display: 'flex' }}>
                <AttendanceIcon fontSize="medium" />
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={850} sx={{ color: 'warning.main', letterSpacing: '-0.5px' }}>
                  {latestPayslip ? `${latestPayslip.daysWorked} Days` : '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Days Worked (Latest)
                </Typography>
              </Box>
            </Paper>
          </Grid>
        </Grid>

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

  // Admin Dashboard Pane
  return (
    <Box sx={{ p: 4 }}>
      {/* Welcome Section */}
      <Paper
        elevation={0}
        sx={{
          p: 4,
          borderRadius: 4,
          mb: 4,
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'primary.contrastText',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ position: 'relative', zIndex: 2 }}>
          <Typography variant="h4" fontWeight={900} gutterBottom sx={{ letterSpacing: '-0.8px' }}>
            Welcome back, Administrator!
          </Typography>
          <Typography variant="body1" sx={{ opacity: 0.85, fontWeight: 500 }}>
            Manage workforce operations, monitor attendance telemetry, configure compliance structures, and disburse payroll.
          </Typography>
        </Box>
        <Box
          sx={{
            position: 'absolute',
            top: '-20%',
            right: '-5%',
            fontSize: '12rem',
            opacity: 0.1,
            transform: 'rotate(15deg)',
            pointerEvents: 'none',
            zIndex: 1,
          }}
        >
          <OpsIcon fontSize="inherit" />
        </Box>
      </Paper>

      {/* Summary Cards Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {[
          {
            title: 'Active Employees',
            value: employeeCount,
            icon: <PeopleIcon />,
            color: theme.palette.primary.main,
            path: '/employees',
          },
          {
            title: 'Managed Sites',
            value: siteCount,
            icon: <LocationIcon />,
            color: theme.palette.info.main,
            path: '/sites',
          },
          {
            title: 'Payroll Runs Executed',
            value: runsCount,
            icon: <PayrollIcon />,
            color: theme.palette.success.main,
            path: '/payroll',
          },
        ].map((card, idx) => (
          <Grid size={{ xs: 12, md: 4 }} key={idx}>
            <Card
              variant="outlined"
              onClick={() => navigate(card.path)}
              sx={{
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  boxShadow: theme.shadows[2],
                  borderColor: card.color,
                  transform: 'translateY(-2px)',
                },
              }}
            >
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 2.5, p: 3 }}>
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    backgroundColor: alpha(card.color, 0.1),
                    color: card.color,
                    display: 'flex',
                  }}
                >
                  {card.icon}
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight={900} sx={{ color: card.color, lineHeight: 1.1, letterSpacing: '-0.8px' }}>
                    {card.value}
                  </Typography>
                  <Typography variant="subtitle2" color="text.secondary" fontWeight={700} sx={{ mt: 0.5 }}>
                    {card.title}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Quick Access Shortcuts */}
      <Paper variant="outlined" sx={{ p: 4, borderRadius: 4 }}>
        <Typography variant="subtitle1" fontWeight={850} sx={{ mb: 3 }}>
          Quick Management Portal Shortcuts
        </Typography>
        <Grid container spacing={3}>
          {[
            { name: 'Workforce registry', desc: 'Onboard & manage employee contracts', path: '/employees', icon: <PeopleIcon /> },
            { name: 'Managed Site Scopes', desc: 'Configure locations & client scopes', path: '/sites', icon: <LocationIcon /> },
            { name: 'Attendance Telemetry', desc: 'Analyze real-time check-in logs', path: '/attendance', icon: <AttendanceIcon /> },
            { name: 'Payroll & Compliance', desc: 'Configure salary slabs & run payroll', path: '/payroll', icon: <PayrollIcon /> },
          ].map((item, idx) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={idx}>
              <Paper
                variant="outlined"
                onClick={() => navigate(item.path)}
                sx={{
                  p: 3,
                  borderRadius: 3.5,
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: alpha(theme.palette.primary.main, 0.01),
                    transform: 'translateY(-2px)',
                  },
                }}
              >
                <Box sx={{ mx: 'auto', mb: 2, p: 1.5, borderRadius: 2.5, backgroundColor: alpha(theme.palette.primary.main, 0.08), color: 'primary.main', display: 'inline-flex' }}>
                  {item.icon}
                </Box>
                <Typography variant="subtitle2" fontWeight={800} gutterBottom>
                  {item.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block">
                  {item.desc}
                </Typography>
              </Paper>
            </Grid>
          ))}
        </Grid>
      </Paper>
    </Box>
  );
}
