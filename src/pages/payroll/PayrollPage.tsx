import { useState } from 'react';
import {
  Box,
  Typography as MuiTypography,
  Paper,
  Grid,
  Chip,
  Button,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  CircularProgress,
  Alert,
  alpha,
  useTheme,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Collapse,
} from '@mui/material';
import {
  Payments as PayrollIcon,
  Add as AddIcon,
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Download as DownloadIcon,
  Refresh as RefreshIcon,
  AccountBalance as BankIcon,
  TrendingUp as TrendingIcon,
  Groups as GroupsIcon,
  Schedule as ScheduleIcon,
} from '@mui/icons-material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '../../api/client';

const Typography = MuiTypography as any;

// Status color map
const STATUS_COLOR: Record<string, 'default' | 'warning' | 'info' | 'success' | 'error' | 'primary'> = {
  DRAFT: 'default',
  PROCESSING: 'info',
  PENDING_APPROVAL: 'warning',
  APPROVED: 'success',
  REJECTED: 'error',
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft',
  PROCESSING: 'Processing...',
  PENDING_APPROVAL: 'Pending Approval',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
};

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

interface PayrollRun {
  id: string;
  month: number;
  year: number;
  startDate?: string;
  endDate?: string;
  siteId?: string;
  status: string;
  processedBy?: string;
  approvedBy?: string;
  approvedByName?: string;
  approvedByEmail?: string;
  bankFileUrl?: string;
  totalGross?: number;
  totalNet?: number;
  totalPf?: number;
  totalEsic?: number;
  totalTds?: number;
  organizationId?: string;
  createdAt?: string;
}

interface Site {
  id: string;
  name: string;
  isPayrollVisible?: boolean;
}

export default function PayrollPage() {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const [initiateOpen, setInitiateOpen] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [initiateError, setInitiateError] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [payslipsMap, setPayslipsMap] = useState<Record<string, any[]>>({});
  const [payslipsLoading, setPayslipsLoading] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form state for initiating payroll
  const [form, setForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    siteId: '',
  });

  // Fetch payroll runs
  const { data: runsData, isLoading, refetch } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => apiClient.get('/payroll/runs?limit=50'),
    refetchInterval: (data: any) => {
      const runs: PayrollRun[] = (data as any)?.data?.data || (data as any)?.data || [];
      const hasProcessing = runs.some((r) => r.status === 'PROCESSING');
      return hasProcessing ? 5000 : false; // auto-poll every 5s while processing
    },
  });

  // Fetch sites for this org
  const { data: sitesData } = useQuery({
    queryKey: ['sites-payroll'],
    queryFn: () => apiClient.get('/sites?limit=200'),
  });

  const runs: PayrollRun[] = (runsData as any)?.data?.data || (runsData as any)?.data || [];
  const sites: Site[] = (sitesData as any)?.data?.data || (sitesData as any)?.data || [];
  const payrollEnabledSites = sites.filter((s) => s.isPayrollVisible);
  const sitesMap = Object.fromEntries(sites.map((s) => [s.id, s]));

  // Summary stats
  const totalGrossAll = runs.filter(r => r.status === 'APPROVED').reduce((s, r) => s + (Number(r.totalGross) || 0), 0);
  const pendingApproval = runs.filter((r) => r.status === 'PENDING_APPROVAL').length;

  const handleInitiate = async () => {
    setInitiating(true);
    setInitiateError(null);
    try {
      const body: any = { month: form.month, year: form.year };
      if (form.siteId) body.siteId = form.siteId;
      await apiClient.post('/payroll/run', body);
      setInitiateOpen(false);
      setForm({ month: new Date().getMonth() + 1, year: new Date().getFullYear(), siteId: '' });
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to initiate payroll run.';
      setInitiateError(msg);
    } finally {
      setInitiating(false);
    }
  };

  const handleApprove = async (runId: string) => {
    setActionError(null);
    setActionLoading(runId + '_approve');
    try {
      await apiClient.post(`/payroll/run/${runId}/approve`);
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    } catch (err: any) {
      setActionError(err?.response?.data?.error?.message || err?.message || 'Failed to approve.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (runId: string) => {
    setActionError(null);
    setActionLoading(runId + '_reject');
    try {
      await apiClient.post(`/payroll/run/${runId}/reject`);
      queryClient.invalidateQueries({ queryKey: ['payroll-runs'] });
    } catch (err: any) {
      setActionError(err?.response?.data?.error?.message || err?.message || 'Failed to reject.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTogglePayslips = async (runId: string) => {
    if (expandedRunId === runId) {
      setExpandedRunId(null);
      return;
    }
    setExpandedRunId(runId);
    if (!payslipsMap[runId]) {
      setPayslipsLoading((prev) => ({ ...prev, [runId]: true }));
      try {
        const res: any = await apiClient.get(`/payroll/run/${runId}/payslips`);
        const slips = Array.isArray(res) ? res : res?.data || [];
        setPayslipsMap((prev) => ({ ...prev, [runId]: slips }));
      } catch {
        setPayslipsMap((prev) => ({ ...prev, [runId]: [] }));
      } finally {
        setPayslipsLoading((prev) => ({ ...prev, [runId]: false }));
      }
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <Box>
          <Typography variant="h4" fontWeight={800} gutterBottom>
            Payroll Management
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage payroll runs, approve payslips, and track compliance deductions
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Tooltip title="Refresh">
            <IconButton onClick={() => refetch()} size="small" sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setInitiateOpen(true)}
            sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', px: 3 }}
          >
            Run Payroll
          </Button>
        </Box>
      </Box>

      {/* Site Payroll Enabled Status */}
      <Paper
        variant="outlined"
        sx={{ p: 2.5, borderRadius: 3, mb: 3, borderColor: alpha(theme.palette.primary.main, 0.2), background: alpha(theme.palette.primary.main, 0.02) }}
      >
        <Typography variant="subtitle2" fontWeight={700} color="text.secondary" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Payroll Enabled Sites
        </Typography>
        {sites.length === 0 ? (
          <Typography variant="body2" color="text.secondary">Loading sites...</Typography>
        ) : (
          <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
            {sites.map((site) => (
              <Chip
                key={site.id}
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Box
                      sx={{
                        width: 7, height: 7, borderRadius: '50%',
                        backgroundColor: site.isPayrollVisible ? theme.palette.success.main : theme.palette.text.disabled,
                        flexShrink: 0,
                      }}
                    />
                    <span>{site.name}</span>
                    <span style={{ fontSize: '0.65rem', fontWeight: 700, marginLeft: 2 }}>
                      {site.isPayrollVisible ? '● ENABLED' : '○ DISABLED'}
                    </span>
                  </Box>
                }
                size="small"
                variant={site.isPayrollVisible ? 'filled' : 'outlined'}
                color={site.isPayrollVisible ? 'primary' : 'default'}
                sx={{ fontWeight: 600, borderRadius: 2, px: 0.5, height: 28 }}
              />
            ))}
            {sites.length === 0 && (
              <Typography variant="caption" color="text.secondary">No sites found. Create sites and enable payroll in Site Settings.</Typography>
            )}
          </Box>
        )}
      </Paper>

      {/* Summary Cards */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        {[
          {
            icon: <PayrollIcon />,
            label: 'Total Runs',
            value: runs.length,
            color: theme.palette.primary.main,
          },
          {
            icon: <ScheduleIcon />,
            label: 'Pending Approval',
            value: pendingApproval,
            color: theme.palette.warning.main,
          },
          {
            icon: <TrendingIcon />,
            label: 'Approved Total Gross',
            value: INR(totalGrossAll),
            color: theme.palette.success.main,
          },
          {
            icon: <GroupsIcon />,
            label: 'Payroll-Enabled Sites',
            value: payrollEnabledSites.length,
            color: theme.palette.info.main,
          },
        ].map((card, i) => (
          <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
            <Paper
              variant="outlined"
              sx={{
                p: 2.5, borderRadius: 3,
                borderColor: alpha(card.color, 0.2),
                backgroundColor: alpha(card.color, 0.03),
                display: 'flex', alignItems: 'center', gap: 2,
              }}
            >
              <Box sx={{ p: 1.25, borderRadius: 2.5, backgroundColor: alpha(card.color, 0.1), color: card.color, display: 'flex' }}>
                {card.icon}
              </Box>
              <Box>
                <Typography variant="h5" fontWeight={800} sx={{ color: card.color, lineHeight: 1.2 }}>
                  {card.value}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  {card.label}
                </Typography>
              </Box>
            </Paper>
          </Grid>
        ))}
      </Grid>

      {/* Action error */}
      {actionError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setActionError(null)}>
          {actionError}
        </Alert>
      )}

      {/* Payroll Runs List */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : runs.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{ p: 6, borderRadius: 3, textAlign: 'center', borderStyle: 'dashed', borderColor: alpha(theme.palette.primary.main, 0.2) }}
        >
          <PayrollIcon sx={{ fontSize: 56, color: alpha(theme.palette.primary.main, 0.3), mb: 2 }} />
          <Typography variant="h6" fontWeight={700} gutterBottom>No Payroll Runs Yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Start your first payroll run to generate payslips for your employees.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setInitiateOpen(true)} sx={{ borderRadius: 2.5, fontWeight: 700 }}>
            Run Payroll
          </Button>
        </Paper>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {runs.map((run) => {
            const site = run.siteId ? sitesMap[run.siteId] : null;
            const isExpanded = expandedRunId === run.id;
            const payslips = payslipsMap[run.id] || [];
            const isPending = run.status === 'PENDING_APPROVAL';
            const isProcessing = run.status === 'PROCESSING';

            return (
              <Paper
                key={run.id}
                variant="outlined"
                sx={{
                  borderRadius: 3,
                  overflow: 'hidden',
                  borderColor: isPending ? alpha(theme.palette.warning.main, 0.4)
                    : run.status === 'APPROVED' ? alpha(theme.palette.success.main, 0.3)
                    : run.status === 'REJECTED' ? alpha(theme.palette.error.main, 0.3)
                    : theme.palette.divider,
                  transition: 'box-shadow 0.2s',
                  '&:hover': { boxShadow: theme.shadows[2] },
                }}
              >
                {/* Run Header */}
                <Box
                  sx={{
                    p: 2.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 2,
                    backgroundColor: isProcessing ? alpha(theme.palette.info.main, 0.04) : 'transparent',
                  }}
                >
                  {/* Left: Run info */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    <Box>
                      <Typography variant="subtitle1" fontWeight={800}>
                        {MONTH_NAMES[run.month] || `Month ${run.month}`} {run.year}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Chip
                          label={STATUS_LABEL[run.status] || run.status}
                          color={STATUS_COLOR[run.status] || 'default'}
                          size="small"
                          sx={{ fontWeight: 700, borderRadius: 1.5, fontSize: '0.72rem' }}
                        />
                        {site && (
                          <Chip
                            label={
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box sx={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: site.isPayrollVisible ? theme.palette.success.main : theme.palette.text.disabled }} />
                                {site.name} — Payroll {site.isPayrollVisible ? 'ENABLED' : 'DISABLED'}
                              </Box>
                            }
                            size="small"
                            variant="outlined"
                            color={site.isPayrollVisible ? 'primary' : 'default'}
                            sx={{ fontWeight: 600, borderRadius: 1.5, fontSize: '0.7rem' }}
                          />
                        )}
                        {!site && (
                          <Chip label="All Sites" size="small" variant="outlined" sx={{ fontWeight: 600, borderRadius: 1.5, fontSize: '0.7rem' }} />
                        )}
                        {run.createdAt && (
                          <Typography variant="caption" color="text.secondary">
                            {new Date(run.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Box>

                  {/* Right: Totals + Actions */}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                    {run.totalGross != null && (
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" color="text.secondary" display="block">GROSS</Typography>
                        <Typography variant="subtitle2" fontWeight={700} color={theme.palette.success.main}>{INR(run.totalGross)}</Typography>
                      </Box>
                    )}
                    {run.totalNet != null && (
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" color="text.secondary" display="block">NET</Typography>
                        <Typography variant="subtitle2" fontWeight={700}>{INR(run.totalNet)}</Typography>
                      </Box>
                    )}
                    {run.totalPf != null && (
                      <Box sx={{ textAlign: 'right' }}>
                        <Typography variant="caption" color="text.secondary" display="block">PF</Typography>
                        <Typography variant="subtitle2" fontWeight={600} color="text.secondary">{INR(run.totalPf)}</Typography>
                      </Box>
                    )}

                    {/* Approve / Reject */}
                    {isPending && (
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="contained"
                          color="success"
                          size="small"
                          startIcon={actionLoading === run.id + '_approve' ? <CircularProgress size={14} color="inherit" /> : <ApproveIcon />}
                          disabled={!!actionLoading}
                          onClick={() => handleApprove(run.id)}
                          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          startIcon={actionLoading === run.id + '_reject' ? <CircularProgress size={14} color="inherit" /> : <RejectIcon />}
                          disabled={!!actionLoading}
                          onClick={() => handleReject(run.id)}
                          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                        >
                          Reject
                        </Button>
                      </Box>
                    )}

                    {/* Bank file download */}
                    {run.bankFileUrl && (
                      <Tooltip title="Download Bank Transfer File">
                        <IconButton size="small" href={run.bankFileUrl} target="_blank" sx={{ color: theme.palette.primary.main }}>
                          <DownloadIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}

                    {/* Expand payslips */}
                    <Tooltip title={isExpanded ? 'Hide Payslips' : 'View Payslips'}>
                      <IconButton
                        size="small"
                        onClick={() => handleTogglePayslips(run.id)}
                        sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 1.5 }}
                      >
                        {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                      </IconButton>
                    </Tooltip>
                  </Box>
                </Box>

                {/* Approved by info */}
                {run.approvedByName && (
                  <Box sx={{ px: 2.5, pb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Approved by <strong>{run.approvedByName}</strong>
                      {run.approvedByEmail && ` (${run.approvedByEmail})`}
                    </Typography>
                  </Box>
                )}

                {/* Payslips collapse */}
                <Collapse in={isExpanded} unmountOnExit>
                  <Divider />
                  <Box sx={{ p: 2.5 }}>
                    <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 2 }}>
                      Payslips
                    </Typography>
                    {payslipsLoading[run.id] ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}>
                        <CircularProgress size={28} />
                      </Box>
                    ) : payslips.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">No payslips generated yet.</Typography>
                    ) : (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', color: 'text.secondary' }}>Employee ID</TableCell>
                              <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', color: 'text.secondary' }} align="center">Days Worked</TableCell>
                              <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', color: 'text.secondary' }} align="right">Gross</TableCell>
                              <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', color: 'text.secondary' }} align="right">Deductions</TableCell>
                              <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', color: 'text.secondary' }} align="right">Net Pay</TableCell>
                              <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', color: 'text.secondary' }} align="center">Status</TableCell>
                              <TableCell sx={{ fontWeight: 700, fontSize: '0.72rem', textTransform: 'uppercase', color: 'text.secondary' }} align="center">PDF</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {payslips.map((slip: any) => (
                              <TableRow key={slip.id} hover>
                                <TableCell>
                                  <Typography variant="caption" sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                                    {slip.employeeId?.slice(0, 8)}…
                                  </Typography>
                                </TableCell>
                                <TableCell align="center">
                                  <Typography variant="caption" fontWeight={600}>{slip.daysWorked ?? '—'}</Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="caption" fontWeight={600} color="success.main">{INR(slip.grossEarnings)}</Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="caption" color="error.main">{INR(slip.totalDeductions)}</Typography>
                                </TableCell>
                                <TableCell align="right">
                                  <Typography variant="caption" fontWeight={700}>{INR(slip.netPayable)}</Typography>
                                </TableCell>
                                <TableCell align="center">
                                  <Chip
                                    label={slip.status || 'DRAFT'}
                                    size="small"
                                    color={slip.status === 'APPROVED' ? 'success' : 'default'}
                                    sx={{ fontWeight: 700, fontSize: '0.65rem', borderRadius: 1 }}
                                  />
                                </TableCell>
                                <TableCell align="center">
                                  <Tooltip title="Download PDF Payslip">
                                    <IconButton
                                      size="small"
                                      href={`/api/v1/payroll/payslips/${slip.id}/pdf`}
                                      target="_blank"
                                      sx={{ color: theme.palette.primary.main }}
                                    >
                                      <DownloadIcon sx={{ fontSize: 16 }} />
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
                </Collapse>
              </Paper>
            );
          })}
        </Box>
      )}

      {/* Initiate Payroll Dialog */}
      <Dialog
        open={initiateOpen}
        onClose={() => !initiating && setInitiateOpen(false)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3 } } }}
      >
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BankIcon color="primary" />
            Run Payroll
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {initiateError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setInitiateError(null)}>
              {initiateError}
            </Alert>
          )}
          <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
            <Grid size={{ xs: 6 }}>
              <TextField
                select fullWidth label="Month" size="small" value={form.month}
                onChange={(e) => setForm((f) => ({ ...f, month: Number(e.target.value) }))}
                slotProps={{ input: { sx: { borderRadius: 2 } } }}
              >
                {MONTH_NAMES.slice(1).map((m, i) => (
                  <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth label="Year" size="small" type="number"
                value={form.year}
                onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))}
                slotProps={{ input: { sx: { borderRadius: 2 } } }}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                select fullWidth label="Site (Optional)" size="small" value={form.siteId}
                onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))}
                helperText={
                  payrollEnabledSites.length === 0
                    ? 'No sites have payroll enabled. Enable it in Site Settings.'
                    : 'Only sites with payroll enabled are shown'
                }
                slotProps={{ input: { sx: { borderRadius: 2 } } }}
              >
                <MenuItem value=""><em>All Sites</em></MenuItem>
                {payrollEnabledSites.map((site) => (
                  <MenuItem key={site.id} value={site.id}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Box sx={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: theme.palette.success.main, flexShrink: 0 }} />
                      {site.name}
                    </Box>
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
          </Grid>

          <Alert severity="info" sx={{ mt: 2.5, borderRadius: 2, fontSize: '0.8rem' }}>
            Payroll processing runs asynchronously. The run will appear as <strong>Processing</strong> and automatically update to <strong>Pending Approval</strong> when complete.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setInitiateOpen(false)} color="inherit" disabled={initiating} sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={initiating}
            onClick={handleInitiate}
            sx={{ borderRadius: 2, fontWeight: 700, px: 4 }}
          >
            {initiating ? <CircularProgress size={22} color="inherit" /> : 'Start Payroll Run'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
