import React, { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Tabs,
  Tab,
  List,
  ListItemButton,
  ListItemText,
  RadioGroup,
  Radio,
  FormControlLabel,
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
  Edit as EditIcon,
} from '@mui/icons-material';
import apiClient from '../../api/client';
import { format } from 'date-fns';

// Types
import type { Employee } from '../../types/employee';

const Typography = MuiTypography as any;

// Status color maps
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

interface SalaryStructure {
  id?: string;
  employeeId: string;
  basic: number;
  hra: number;
  conveyance?: number;
  special?: number;
  grossSalary?: number;
  pfEmployee?: number;
  pfEmployer?: number;
  esicEmployee?: number;
  esicEmployer?: number;
  ptAmount?: number;
  da: number;
  washingAllowance: number;
  pfType: string;
  pfCustomBasis?: number;
  esicType: string;
  esicCustomBasis?: number;
  ptEnabled: boolean;
  ptCustomAmount?: number;
  mlwfEnabled: boolean;
  mlwfCustomAmount?: number;
  mlwfDeduction?: number;
}

export default function PayrollPage() {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState(0);

  // Runs states
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  const [initiateOpen, setInitiateOpen] = useState(false);
  const [initiating, setInitiating] = useState(false);
  const [initiateError, setInitiateError] = useState<string | null>(null);
  const [expandedRunId, setExpandedRunId] = useState<string | null>(null);
  const [payslipsMap, setPayslipsMap] = useState<Record<string, any[]>>({});
  const [payslipsLoading, setPayslipsLoading] = useState<Record<string, boolean>>({});
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Salary structures states
  const [configOpen, setConfigOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [existingStructure, setExistingStructure] = useState<SalaryStructure | null>(null);
  const [savingStructure, setSavingStructure] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [structureSearch, setStructureSearch] = useState('');

  // Salary form states
  const [salaryForm, setSalaryForm] = useState({
    basic: '',
    da: '0',
    hra: '',
    washingAllowance: '0',
    conveyance: '0',
    special: '0',
    pfType: 'STANDARD',
    pfCustomBasis: '',
    esicType: 'STANDARD',
    esicCustomBasis: '',
    ptEnabled: true,
    ptCustomAmount: '',
    mlwfEnabled: false,
    mlwfCustomAmount: '',
  });

  // Initiate run form state
  const [form, setForm] = useState({
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    siteId: '',
  });

  // Base Queries
  const { data: runsData, isLoading: runsLoading, refetch: refetchRuns } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn: () => apiClient.get('/payroll/runs?limit=50'),
    refetchInterval: (query) => {
      const runsList: PayrollRun[] = (query.state.data as any)?.data?.data || (query.state.data as any)?.data || [];
      const hasProcessing = runsList.some((r) => r.status === 'PROCESSING');
      return hasProcessing ? 5000 : false;
    },
  });

  const { data: sitesData } = useQuery({
    queryKey: ['sites-payroll'],
    queryFn: () => apiClient.get('/sites?limit=100'),
  });

  const { data: employeesData, isLoading: employeesLoading, refetch: refetchEmployees } = useQuery({
    queryKey: ['employees-payroll'],
    queryFn: () => apiClient.get('/employees?limit=100'),
    enabled: activeTab === 1,
  });

  // Site Preview Query
  const { data: previewData, isLoading: previewLoading } = useQuery({
    queryKey: ['site-payroll-preview', selectedSiteId, form.month, form.year],
    queryFn: () => apiClient.get(`/payroll/site-preview?siteId=${selectedSiteId}&month=${form.month}&year=${form.year}`),
    enabled: !!selectedSiteId && activeTab === 0,
  });

  const runs: PayrollRun[] = (runsData as any)?.data?.data || (runsData as any)?.data || [];
  const sites: Site[] = (sitesData as any)?.data?.data || (sitesData as any)?.data || [];
  const employees: Employee[] = (employeesData as any)?.data || (employeesData as any)?.data?.data || [];
  
  const payrollEnabledSites = sites.filter((s) => s.isPayrollVisible);
  const sitesMap = Object.fromEntries(sites.map((s) => [s.id, s]));

  // Summary stats
  const totalGrossAll = runs.filter(r => r.status === 'APPROVED').reduce((s, r) => s + (Number(r.totalGross) || 0), 0);
  const pendingApproval = runs.filter((r) => r.status === 'PENDING_APPROVAL').length;

  // Initiate Payroll Run
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

  // Approve / Reject Runs
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

  // Toggle Payslips dropdown
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

  // Configure Salary Structure Handler
  const handleConfigureSalary = async (emp: Employee, structure: SalaryStructure | null) => {
    setSelectedEmp(emp);
    setSaveError(null);
    if (structure) {
      setExistingStructure(structure);
      setSalaryForm({
        basic: String(structure.basic),
        da: String(structure.da || 0),
        hra: String(structure.hra),
        washingAllowance: String(structure.washingAllowance || 0),
        conveyance: String(structure.conveyance || 0),
        special: String(structure.special || 0),
        pfType: structure.pfType || 'STANDARD',
        pfCustomBasis: String(structure.pfCustomBasis || ''),
        esicType: structure.esicType || 'STANDARD',
        esicCustomBasis: String(structure.esicCustomBasis || ''),
        ptEnabled: structure.ptEnabled !== false,
        ptCustomAmount: String(structure.ptCustomAmount || ''),
        mlwfEnabled: !!structure.mlwfEnabled,
        mlwfCustomAmount: String(structure.mlwfCustomAmount || ''),
      });
    } else {
      setExistingStructure(null);
      setSalaryForm({
        basic: '',
        da: '0',
        hra: '',
        washingAllowance: '0',
        conveyance: '0',
        special: '0',
        pfType: 'STANDARD',
        pfCustomBasis: '',
        esicType: 'STANDARD',
        esicCustomBasis: '',
        ptEnabled: true,
        ptCustomAmount: '',
        mlwfEnabled: false,
        mlwfCustomAmount: '',
      });
    }
    setConfigOpen(true);
  };

  const handleSaveSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmp) return;
    setSavingStructure(true);
    setSaveError(null);
    try {
      const payload = {
        employeeId: selectedEmp.id,
        basic: Number(salaryForm.basic),
        da: Number(salaryForm.da || 0),
        hra: Number(salaryForm.hra),
        washingAllowance: Number(salaryForm.washingAllowance || 0),
        conveyance: Number(salaryForm.conveyance || 0),
        special: Number(salaryForm.special || 0),
        pfType: salaryForm.pfType,
        pfCustomBasis: salaryForm.pfType === 'CUSTOM' ? Number(salaryForm.pfCustomBasis || 0) : 0,
        esicType: salaryForm.esicType,
        esicCustomBasis: salaryForm.esicType === 'CUSTOM' ? Number(salaryForm.esicCustomBasis || 0) : 0,
        ptEnabled: salaryForm.ptEnabled,
        ptCustomAmount: salaryForm.ptEnabled ? Number(salaryForm.ptCustomAmount || 0) : 0,
        mlwfEnabled: salaryForm.mlwfEnabled,
        mlwfCustomAmount: salaryForm.mlwfEnabled ? Number(salaryForm.mlwfCustomAmount || 0) : 0,
      };

      if (existingStructure) {
        // Update Structure
        await apiClient.put(`/payroll/salary-structure/${selectedEmp.id}`, payload);
      } else {
        // Create Structure
        await apiClient.post('/payroll/salary-structure', payload);
      }
      
      setConfigOpen(false);
      // Invalidate target queries
      queryClient.invalidateQueries({ queryKey: ['salary-structure', selectedEmp.id] });
    } catch (err: any) {
      setSaveError(err?.response?.data?.message || err?.message || 'Failed to save salary structure.');
    } finally {
      setSavingStructure(false);
    }
  };

  const liveCalculations = useMemo(() => {
    const basic = parseFloat(salaryForm.basic) || 0;
    const da = parseFloat(salaryForm.da) || 0;
    const hra = parseFloat(salaryForm.hra) || 0;
    const washing = parseFloat(salaryForm.washingAllowance) || 0;
    const conveyance = parseFloat(salaryForm.conveyance) || 0;
    const special = parseFloat(salaryForm.special) || 0;

    const gross = basic + da + hra + washing + conveyance + special;

    // PF
    const basicPlusDa = basic + da;
    let pfBase = 0;
    if (salaryForm.pfType === 'CUSTOM') {
      pfBase = parseFloat(salaryForm.pfCustomBasis) || 0;
    } else {
      pfBase = Math.min(basicPlusDa, 15000);
    }
    const pfEmployee = Math.round(pfBase * 0.12 * 100) / 100;
    const pfEmployer = Math.round(pfBase * 0.12 * 100) / 100;

    // ESIC
    let esicBase = 0;
    if (salaryForm.esicType === 'CUSTOM') {
      esicBase = parseFloat(salaryForm.esicCustomBasis) || 0;
    } else {
      esicBase = gross <= 21000 ? gross : 0;
    }
    const esicEmployee = Math.round(esicBase * 0.0075 * 100) / 100;
    const esicEmployer = Math.round(esicBase * 0.0325 * 100) / 100;

    // PT
    let ptAmount = 0;
    if (salaryForm.ptEnabled) {
      if (salaryForm.ptCustomAmount !== '') {
        ptAmount = parseFloat(salaryForm.ptCustomAmount) || 0;
      } else {
        // Fallback to Maharashtra standard
        if (gross > 7500 && gross <= 10000) ptAmount = 175;
        else if (gross > 10000) ptAmount = 200;
      }
    }

    // MLWF
    let mlwfAmount = 0;
    if (salaryForm.mlwfEnabled) {
      mlwfAmount = parseFloat(salaryForm.mlwfCustomAmount) || 0;
    }

    const netPay = gross - (pfEmployee + esicEmployee + ptAmount + mlwfAmount);

    return {
      gross,
      pfEmployee,
      pfEmployer,
      esicEmployee,
      esicEmployer,
      ptAmount,
      mlwfAmount,
      netPay,
    };
  }, [salaryForm]);

  // Filter employees
  const filteredEmployees = useMemo(() => {
    let result = employees;
    if (selectedSiteId) {
      result = result.filter(emp => emp.siteId === selectedSiteId);
    }
    const q = structureSearch.toLowerCase().trim();
    if (q) {
      result = result.filter(emp => emp.fullName.toLowerCase().includes(q) || emp.role.toLowerCase().includes(q));
    }
    return result;
  }, [employees, selectedSiteId, structureSearch]);

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: activeTab === 0 ? 3.5 : 2, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={900} gutterBottom sx={{ letterSpacing: '-0.8px' }}>
            Payroll Panel
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage payroll runs, approve payslips, and configure employee salary structures
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1.5 }}>
          <Tooltip title="Refresh">
            <IconButton
              onClick={() => {
                if (activeTab === 0) refetchRuns();
                else refetchEmployees();
              }}
              size="small"
              sx={{ border: `1px solid ${theme.palette.divider}`, borderRadius: 2 }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          {activeTab === 0 && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setInitiateOpen(true)}
              sx={{ borderRadius: 2.5, fontWeight: 700, textTransform: 'none', px: 3 }}
            >
              Run Payroll
            </Button>
          )}
        </Box>
      </Box>

      {/* Tabs */}
      <Paper elevation={0} variant="outlined" sx={{ borderRadius: 4, mb: 4, overflow: 'hidden' }}>
        <Tabs
          value={activeTab}
          onChange={(_e, v) => setActiveTab(v)}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
          sx={{
            borderBottom: 1,
            borderColor: 'divider',
            backgroundColor: alpha(theme.palette.primary.main, 0.01),
            '& .MuiTab-root': {
              py: 2,
              textTransform: 'none',
              fontWeight: 800,
              fontSize: '0.95rem',
            }
          }}
        >
          <Tab icon={<PayrollIcon />} iconPosition="start" label="Payroll Runs" />
          <Tab icon={<GroupsIcon />} iconPosition="start" label="Salary Structures" />
        </Tabs>

        {/* Tab 0: Payroll Runs */}
        {activeTab === 0 && (
          <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
              {/* Left Sidebar: Site List */}
              <Grid size={{ xs: 12, md: 3 }}>
                <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                  <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: alpha(theme.palette.primary.main, 0.01) }}>
                    <Typography variant="subtitle2" fontWeight={850} color="primary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>
                      Site Scopes
                    </Typography>
                  </Box>
                  <List sx={{ p: 0, maxHeight: 600, overflowY: 'auto' }}>
                    <ListItemButton
                      selected={selectedSiteId === ''}
                      onClick={() => setSelectedSiteId('')}
                      sx={{
                        py: 1.5,
                        borderLeft: '4px solid',
                        borderLeftColor: selectedSiteId === '' ? theme.palette.primary.main : 'transparent',
                      }}
                    >
                      <ListItemText
                        primary={<Typography fontWeight={selectedSiteId === '' ? 850 : 500} sx={{ fontSize: '0.85rem' }}>Global Overview</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">All sites & runs history</Typography>}
                      />
                    </ListItemButton>
                    <Divider />
                    {sites.map((site) => (
                      <ListItemButton
                        key={site.id}
                        selected={selectedSiteId === site.id}
                        onClick={() => setSelectedSiteId(site.id)}
                        sx={{
                          py: 1.5,
                          borderLeft: '4px solid',
                          borderLeftColor: selectedSiteId === site.id ? theme.palette.primary.main : 'transparent',
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Typography fontWeight={selectedSiteId === site.id ? 850 : 500} sx={{ fontSize: '0.85rem' }} noWrap>
                                {site.name}
                              </Typography>
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor: site.isPayrollVisible ? 'success.main' : 'text.disabled',
                                  ml: 1,
                                  flexShrink: 0,
                                }}
                              />
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color={site.isPayrollVisible ? 'success.main' : 'text.secondary'} fontWeight={600}>
                              {site.isPayrollVisible ? 'Payroll Visible' : 'Payroll Hidden'}
                            </Typography>
                          }
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Paper>
              </Grid>

              {/* Right Pane: Selected Site Details & Runs */}
              <Grid size={{ xs: 12, md: 9 }}>
                {selectedSiteId === '' ? (
                  // Global Overview Pane
                  <Box>
                    {/* Site Payroll Enabled Status */}
                    <Paper
                      variant="outlined"
                      sx={{ p: 2.5, borderRadius: 3, mb: 3, borderColor: alpha(theme.palette.primary.main, 0.2), background: alpha(theme.palette.primary.main, 0.02) }}
                    >
                      <Typography variant="subtitle2" fontWeight={800} color="text.secondary" sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>
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
                          label: 'Approved Gross Amount',
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
                              <Typography variant="h5" fontWeight={850} sx={{ color: card.color, lineHeight: 1.2, letterSpacing: '-0.5px' }}>
                                {card.value}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.65rem' }}>
                                {card.label}
                              </Typography>
                            </Box>
                          </Paper>
                        </Grid>
                      ))}
                    </Grid>

                    {actionError && (
                      <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setActionError(null)}>{actionError}</Alert>
                    )}

                    {/* Runs List */}
                    {runsLoading ? (
                      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
                    ) : runs.length === 0 ? (
                      <Paper variant="outlined" sx={{ p: 6, borderRadius: 4, textAlign: 'center', borderStyle: 'dashed' }}>
                        <PayrollIcon sx={{ fontSize: 56, color: theme.palette.text.disabled, mb: 1.5 }} />
                        <Typography variant="h6" fontWeight={750} gutterBottom>No Payroll Runs Logged</Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>Start a payroll run to generate payslips for your employees.</Typography>
                        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setInitiateOpen(true)} sx={{ borderRadius: 2.5, fontWeight: 700 }}>Run Payroll</Button>
                      </Paper>
                    ) : (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {runs.map((run) => {
                          const site = run.siteId ? sitesMap[run.siteId] : null;
                          const isExpanded = expandedRunId === run.id;
                          const payslips = payslipsMap[run.id] || [];
                          const isPending = run.status === 'PENDING_APPROVAL';

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
                                transition: 'all 0.2s',
                                '&:hover': { boxShadow: theme.shadows[1] }
                              }}
                            >
                              <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                                <Box>
                                  <Typography variant="subtitle1" fontWeight={850}>
                                    {MONTH_NAMES[run.month]} {run.year}
                                  </Typography>
                                  <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <Chip label={STATUS_LABEL[run.status]} color={STATUS_COLOR[run.status]} size="small" sx={{ fontWeight: 800, fontSize: '0.65rem', borderRadius: 1.5 }} />
                                    {site && <Chip label={site.name} size="small" variant="outlined" color="primary" sx={{ fontWeight: 700, fontSize: '0.65rem', borderRadius: 1.5 }} />}
                                    {run.createdAt && <Typography variant="caption" color="text.secondary">{format(new Date(run.createdAt), 'dd MMM yyyy')}</Typography>}
                                  </Box>
                                </Box>

                                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap' }}>
                                  {run.totalGross != null && (
                                    <Box sx={{ textAlign: 'right' }}>
                                      <Typography variant="caption" color="text.secondary" display="block">GROSS</Typography>
                                      <Typography variant="subtitle2" fontWeight={800} color="success.main">{INR(run.totalGross)}</Typography>
                                    </Box>
                                  )}
                                  {run.totalNet != null && (
                                    <Box sx={{ textAlign: 'right' }}>
                                      <Typography variant="caption" color="text.secondary" display="block">NET PAY</Typography>
                                      <Typography variant="subtitle2" fontWeight={800}>{INR(run.totalNet)}</Typography>
                                    </Box>
                                  )}

                                  {isPending && (
                                    <Box sx={{ display: 'flex', gap: 1 }}>
                                      <Button variant="contained" color="success" size="small" startIcon={actionLoading === run.id + '_approve' ? <CircularProgress size={14} color="inherit" /> : <ApproveIcon />} disabled={!!actionLoading} onClick={() => handleApprove(run.id)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>Approve</Button>
                                      <Button variant="outlined" color="error" size="small" startIcon={actionLoading === run.id + '_reject' ? <CircularProgress size={14} color="inherit" /> : <RejectIcon />} disabled={!!actionLoading} onClick={() => handleReject(run.id)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>Reject</Button>
                                    </Box>
                                  )}

                                  {run.bankFileUrl && (
                                    <Tooltip title="Download bank file">
                                      <IconButton size="small" href={run.bankFileUrl} target="_blank" color="primary"><DownloadIcon fontSize="small" /></IconButton>
                                    </Tooltip>
                                  )}

                                  <IconButton size="small" onClick={() => handleTogglePayslips(run.id)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                                    {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                  </IconButton>
                                </Box>
                              </Box>

                              <Collapse in={isExpanded} unmountOnExit>
                                <Divider />
                                <Box sx={{ p: 2.5 }}>
                                  <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>Payslips Registry</Typography>
                                  {payslipsLoading[run.id] ? (
                                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
                                  ) : payslips.length === 0 ? (
                                    <Typography variant="body2" color="text.secondary">No payslips found.</Typography>
                                  ) : (
                                    <TableContainer>
                                      <Table size="small">
                                        <TableHead>
                                          <TableRow>
                                            <TableCell sx={{ fontWeight: 800 }}>Employee</TableCell>
                                            <TableCell sx={{ fontWeight: 800 }} align="center">Days Worked</TableCell>
                                            <TableCell sx={{ fontWeight: 800 }} align="right">Gross</TableCell>
                                            <TableCell sx={{ fontWeight: 800 }} align="right">Deductions</TableCell>
                                            <TableCell sx={{ fontWeight: 800 }} align="right">Net Pay</TableCell>
                                            <TableCell sx={{ fontWeight: 800 }} align="center">PDF</TableCell>
                                          </TableRow>
                                        </TableHead>
                                        <TableBody>
                                          {payslips.map((slip: any) => (
                                            <TableRow key={slip.id} hover>
                                              <TableCell sx={{ fontWeight: 600 }}>{slip.employeeName || 'Operator'}</TableCell>
                                              <TableCell align="center">{slip.daysWorked}</TableCell>
                                              <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>{INR(slip.grossEarnings)}</TableCell>
                                              <TableCell align="right" sx={{ color: 'error.main' }}>{INR(slip.totalDeductions)}</TableCell>
                                              <TableCell align="right" sx={{ fontWeight: 700 }}>{INR(slip.netPayable)}</TableCell>
                                              <TableCell align="center">
                                                <IconButton size="small" color="primary" onClick={() => handleDownloadPdf(slip.id)}>
                                                  <DownloadIcon fontSize="small" />
                                                </IconButton>
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
                  </Box>
                ) : (
                  // Site Specific Pane
                  (() => {
                    const selectedSite = sites.find((s) => s.id === selectedSiteId);
                    const previewList = (previewData as any)?.data || [];
                    const hasUnconfigured = previewList.some((item: any) => !item.hasSalaryStructure);
                    const siteRuns = runs.filter((r) => r.siteId === selectedSiteId);

                    return (
                      <Box>
                        {/* Site Header & Period Filters */}
                        <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, mb: 3 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
                            <Box>
                              <Typography variant="h6" fontWeight={850}>{selectedSite?.name}</Typography>
                              <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                                <Box
                                  sx={{
                                    width: 7, height: 7, borderRadius: '50%',
                                    backgroundColor: selectedSite?.isPayrollVisible ? 'success.main' : 'text.disabled'
                                  }}
                                />
                                {selectedSite?.isPayrollVisible ? 'Payroll visible to employees' : 'Payroll hidden from employees'}
                              </Typography>
                            </Box>
                            
                            <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
                              <TextField
                                select
                                size="small"
                                label="Month"
                                value={form.month}
                                onChange={(e) => setForm(f => ({ ...f, month: Number(e.target.value) }))}
                                sx={{ width: 130 }}
                                slotProps={{ input: { sx: { borderRadius: 2 } } }}
                              >
                                {MONTH_NAMES.slice(1).map((m, i) => <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>)}
                              </TextField>
                              <TextField
                                size="small"
                                label="Year"
                                type="number"
                                value={form.year}
                                onChange={(e) => setForm(f => ({ ...f, year: Number(e.target.value) }))}
                                sx={{ width: 90 }}
                                slotProps={{ input: { sx: { borderRadius: 2 } } }}
                              />
                              <Button
                                variant="contained"
                                startIcon={<AddIcon />}
                                onClick={() => {
                                  setForm(f => ({ ...f, siteId: selectedSiteId }));
                                  setInitiateOpen(true);
                                }}
                                sx={{ borderRadius: 2.5, fontWeight: 700, px: 3, textTransform: 'none' }}
                              >
                                Execute Payroll
                              </Button>
                            </Box>
                          </Box>
                        </Paper>

                        {/* Warnings */}
                        {hasUnconfigured && (
                          <Alert severity="warning" sx={{ mb: 3, borderRadius: 2.5 }}>
                            Some employees do not have a salary structure configured. Running payroll will skip them. Go to the <strong>Salary Structures</strong> tab to configure them.
                          </Alert>
                        )}

                        {actionError && (
                          <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setActionError(null)}>{actionError}</Alert>
                        )}

                        {/* Preview Table Section */}
                        <Typography variant="subtitle2" fontWeight={850} sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem', color: 'primary.main' }}>
                          Attendance Telemetry Preview ({MONTH_NAMES[form.month]} {form.year})
                        </Typography>

                        {previewLoading ? (
                          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress /></Box>
                        ) : (
                          <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 3, mb: 4 }}>
                            <Table size="small">
                              <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.02) }}>
                                <TableRow>
                                  <TableCell sx={{ fontWeight: 800 }}>Employee Name</TableCell>
                                  <TableCell sx={{ fontWeight: 800 }}>Designation</TableCell>
                                  <TableCell align="center" sx={{ fontWeight: 800 }}>Days Worked</TableCell>
                                  <TableCell align="center" sx={{ fontWeight: 800 }}>Avg Hours/Day</TableCell>
                                  <TableCell align="center" sx={{ fontWeight: 800 }}>Overtime Hours</TableCell>
                                  <TableCell align="center" sx={{ fontWeight: 800 }}>Salary Structure</TableCell>
                                </TableRow>
                              </TableHead>
                              <TableBody>
                                {previewList.length === 0 ? (
                                  <TableRow>
                                    <TableCell colSpan={6} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                      No employee attendance records found for this site in the selected period.
                                    </TableCell>
                                  </TableRow>
                                ) : (
                                  previewList.map((item: any) => (
                                    <TableRow key={item.employeeId} hover>
                                      <TableCell sx={{ fontWeight: 600 }}>{item.employeeName}</TableCell>
                                      <TableCell>{item.designation}</TableCell>
                                      <TableCell align="center">{item.daysWorked}</TableCell>
                                      <TableCell align="center">{item.averageHoursPerDay.toFixed(2)}h</TableCell>
                                      <TableCell align="center">{item.overtimeHours.toFixed(2)}h</TableCell>
                                      <TableCell align="center">
                                        {item.hasSalaryStructure ? (
                                          <Chip label="Configured" color="success" size="small" sx={{ fontWeight: 700, fontSize: '0.65rem', borderRadius: 1.5 }} />
                                        ) : (
                                          <Chip label="Not Configured" color="error" size="small" sx={{ fontWeight: 700, fontSize: '0.65rem', borderRadius: 1.5 }} />
                                        )}
                                      </TableCell>
                                    </TableRow>
                                  ))
                                )}
                              </TableBody>
                            </Table>
                          </TableContainer>
                        )}

                        {/* Historical Runs for Site */}
                        <Typography variant="subtitle2" fontWeight={850} sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem', color: 'text.secondary' }}>
                          Payroll History for Site
                        </Typography>

                        {siteRuns.length === 0 ? (
                          <Paper variant="outlined" sx={{ p: 5, borderRadius: 3, textAlign: 'center', borderStyle: 'dashed' }}>
                            <Typography variant="body2" color="text.secondary">No historical payroll runs logged for this site.</Typography>
                          </Paper>
                        ) : (
                          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            {siteRuns.map((run) => {
                              const isExpanded = expandedRunId === run.id;
                              const payslips = payslipsMap[run.id] || [];
                              const isPending = run.status === 'PENDING_APPROVAL';

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
                                    transition: 'all 0.2s',
                                    '&:hover': { boxShadow: theme.shadows[1] }
                                  }}
                                >
                                  <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                                    <Box>
                                      <Typography variant="subtitle1" fontWeight={850}>
                                        {MONTH_NAMES[run.month]} {run.year}
                                      </Typography>
                                      <Box sx={{ display: 'flex', gap: 1, mt: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                                        <Chip label={STATUS_LABEL[run.status]} color={STATUS_COLOR[run.status]} size="small" sx={{ fontWeight: 800, fontSize: '0.65rem', borderRadius: 1.5 }} />
                                        {run.createdAt && <Typography variant="caption" color="text.secondary">{format(new Date(run.createdAt), 'dd MMM yyyy')}</Typography>}
                                      </Box>
                                    </Box>

                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5, flexWrap: 'wrap', ml: 'auto' }}>
                                      {run.totalGross != null && (
                                        <Box sx={{ textAlign: 'right' }}>
                                          <Typography variant="caption" color="text.secondary" display="block">GROSS</Typography>
                                          <Typography variant="subtitle2" fontWeight={800} color="success.main">{INR(run.totalGross)}</Typography>
                                        </Box>
                                      )}
                                      {run.totalNet != null && (
                                        <Box sx={{ textAlign: 'right' }}>
                                          <Typography variant="caption" color="text.secondary" display="block">NET PAY</Typography>
                                          <Typography variant="subtitle2" fontWeight={800}>{INR(run.totalNet)}</Typography>
                                        </Box>
                                      )}

                                      {isPending && (
                                        <Box sx={{ display: 'flex', gap: 1 }}>
                                          <Button variant="contained" color="success" size="small" startIcon={actionLoading === run.id + '_approve' ? <CircularProgress size={14} color="inherit" /> : <ApproveIcon />} disabled={!!actionLoading} onClick={() => handleApprove(run.id)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>Approve</Button>
                                          <Button variant="outlined" color="error" size="small" startIcon={actionLoading === run.id + '_reject' ? <CircularProgress size={14} color="inherit" /> : <RejectIcon />} disabled={!!actionLoading} onClick={() => handleReject(run.id)} sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}>Reject</Button>
                                        </Box>
                                      )}

                                      {run.bankFileUrl && (
                                        <Tooltip title="Download bank file">
                                          <IconButton size="small" href={run.bankFileUrl} target="_blank" color="primary"><DownloadIcon fontSize="small" /></IconButton>
                                        </Tooltip>
                                      )}

                                      <IconButton size="small" onClick={() => handleTogglePayslips(run.id)} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                                        {isExpanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
                                      </IconButton>
                                    </Box>
                                  </Box>

                                  <Collapse in={isExpanded} unmountOnExit>
                                    <Divider />
                                    <Box sx={{ p: 2.5 }}>
                                      <Typography variant="subtitle2" fontWeight={800} sx={{ mb: 1.5 }}>Payslips Registry</Typography>
                                      {payslipsLoading[run.id] ? (
                                        <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={24} /></Box>
                                      ) : payslips.length === 0 ? (
                                        <Typography variant="body2" color="text.secondary">No payslips found.</Typography>
                                      ) : (
                                        <TableContainer>
                                          <Table size="small">
                                            <TableHead>
                                              <TableRow>
                                                <TableCell sx={{ fontWeight: 800 }}>Employee</TableCell>
                                                <TableCell sx={{ fontWeight: 800 }} align="center">Days Worked</TableCell>
                                                <TableCell sx={{ fontWeight: 800 }} align="right">Gross</TableCell>
                                                <TableCell sx={{ fontWeight: 800 }} align="right">Deductions</TableCell>
                                                <TableCell sx={{ fontWeight: 800 }} align="right">Net Pay</TableCell>
                                                <TableCell sx={{ fontWeight: 800 }} align="center">PDF</TableCell>
                                              </TableRow>
                                            </TableHead>
                                            <TableBody>
                                              {payslips.map((slip: any) => (
                                                <TableRow key={slip.id} hover>
                                                  <TableCell sx={{ fontWeight: 600 }}>{slip.employeeName || 'Operator'}</TableCell>
                                                  <TableCell align="center">{slip.daysWorked}</TableCell>
                                                  <TableCell align="right" sx={{ color: 'success.main', fontWeight: 600 }}>{INR(slip.grossEarnings)}</TableCell>
                                                  <TableCell align="right" sx={{ color: 'error.main' }}>{INR(slip.totalDeductions)}</TableCell>
                                                  <TableCell align="right" sx={{ fontWeight: 700 }}>{INR(slip.netPayable)}</TableCell>
                                                  <TableCell align="center">
                                                    <IconButton size="small" color="primary" onClick={() => handleDownloadPdf(slip.id)}>
                                                      <DownloadIcon fontSize="small" />
                                                    </IconButton>
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
                      </Box>
                    );
                  })()
                )}
              </Grid>
            </Grid>
          </Box>
        )}

        {/* Tab 1: Salary Structures */}
        {activeTab === 1 && (
          <Box sx={{ p: 3 }}>
            <Grid container spacing={3}>
              {/* Left Sidebar: Site List */}
              <Grid size={{ xs: 12, md: 3 }}>
                <Paper variant="outlined" sx={{ borderRadius: 3, overflow: 'hidden' }}>
                  <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', backgroundColor: alpha(theme.palette.primary.main, 0.01) }}>
                    <Typography variant="subtitle2" fontWeight={850} color="primary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontSize: '0.75rem' }}>
                      Site Scopes
                    </Typography>
                  </Box>
                  <List sx={{ p: 0, maxHeight: 600, overflowY: 'auto' }}>
                    <ListItemButton
                      selected={selectedSiteId === ''}
                      onClick={() => setSelectedSiteId('')}
                      sx={{
                        py: 1.5,
                        borderLeft: '4px solid',
                        borderLeftColor: selectedSiteId === '' ? theme.palette.primary.main : 'transparent',
                      }}
                    >
                      <ListItemText
                        primary={<Typography fontWeight={selectedSiteId === '' ? 850 : 500} sx={{ fontSize: '0.85rem' }}>All Sites (Overview)</Typography>}
                        secondary={<Typography variant="caption" color="text.secondary">Show all employees</Typography>}
                      />
                    </ListItemButton>
                    <Divider />
                    {sites.map((site) => (
                      <ListItemButton
                        key={site.id}
                        selected={selectedSiteId === site.id}
                        onClick={() => setSelectedSiteId(site.id)}
                        sx={{
                          py: 1.5,
                          borderLeft: '4px solid',
                          borderLeftColor: selectedSiteId === site.id ? theme.palette.primary.main : 'transparent',
                        }}
                      >
                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <Typography fontWeight={selectedSiteId === site.id ? 850 : 500} sx={{ fontSize: '0.85rem' }} noWrap>
                                {site.name}
                              </Typography>
                              <Box
                                sx={{
                                  width: 8,
                                  height: 8,
                                  borderRadius: '50%',
                                  backgroundColor: site.isPayrollVisible ? 'success.main' : 'text.disabled',
                                  ml: 1,
                                  flexShrink: 0,
                                }}
                              />
                            </Box>
                          }
                          secondary={
                            <Typography variant="caption" color={site.isPayrollVisible ? 'success.main' : 'text.secondary'} fontWeight={600}>
                              {site.isPayrollVisible ? 'Payroll Visible' : 'Payroll Hidden'}
                            </Typography>
                          }
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Paper>
              </Grid>

              {/* Right Pane: Remuneration structures table */}
              <Grid size={{ xs: 12, md: 9 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
                  <Box>
                    <Typography variant="subtitle1" fontWeight={850}>
                      {selectedSiteId === '' ? 'Employee Remuneration Structures' : `${sitesMap[selectedSiteId]?.name} Employees`}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {selectedSiteId === '' ? 'Configure salary structure templates for all personnel' : `Configure salary structures for employees under this site`}
                    </Typography>
                  </Box>
                  <TextField
                    size="small"
                    placeholder="Search employees..."
                    value={structureSearch}
                    onChange={(e) => setStructureSearch(e.target.value)}
                    sx={{ minWidth: 260 }}
                    slotProps={{ input: { sx: { borderRadius: 2.5 } } }}
                  />
                </Box>

                {employeesLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>
                ) : filteredEmployees.length === 0 ? (
                  <Paper variant="outlined" sx={{ py: 6, textAlign: 'center', borderRadius: 4, borderStyle: 'dashed' }}>
                    <Typography variant="body2" color="text.secondary">No matching employees found.</Typography>
                  </Paper>
                ) : (
                  <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 4 }}>
                    <Table>
                      <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.02) }}>
                        <TableRow>
                          <TableCell sx={{ fontWeight: 800 }}>Employee Name</TableCell>
                          <TableCell sx={{ fontWeight: 800 }}>Role</TableCell>
                          <TableCell sx={{ fontWeight: 800 }} align="right">Basic</TableCell>
                          <TableCell sx={{ fontWeight: 800 }} align="right">HRA</TableCell>
                          <TableCell sx={{ fontWeight: 800 }} align="right">Allowance</TableCell>
                          <TableCell sx={{ fontWeight: 800 }} align="right">Gross</TableCell>
                          <TableCell sx={{ fontWeight: 800 }} align="center">Deductions (Est)</TableCell>
                          <TableCell sx={{ fontWeight: 800 }} align="center">Action</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {filteredEmployees.map((emp) => (
                          <SalaryStructureRow
                            key={emp.id}
                            employee={emp}
                            onConfigure={(structure) => handleConfigureSalary(emp, structure)}
                          />
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                )}
              </Grid>
            </Grid>
          </Box>
        )}
      </Paper>

      {/* Runs Dialog */}
      <Dialog open={initiateOpen} onClose={() => !initiating && setInitiateOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}><Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><BankIcon color="primary" /> Run Payroll Job</Box></DialogTitle>
        <DialogContent dividers>
          {initiateError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setInitiateError(null)}>{initiateError}</Alert>}
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField select fullWidth label="Month" size="small" value={form.month} onChange={(e) => setForm((f) => ({ ...f, month: Number(e.target.value) }))} slotProps={{ input: { sx: { borderRadius: 2 } } }}>
                {MONTH_NAMES.slice(1).map((m, i) => <MenuItem key={i + 1} value={i + 1}>{m}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth label="Year" size="small" type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: Number(e.target.value) }))} slotProps={{ input: { sx: { borderRadius: 2 } } }} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField select fullWidth label="Site Scopes" size="small" value={form.siteId} onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))} slotProps={{ input: { sx: { borderRadius: 2 } } }}>
                <MenuItem value="">All Active Sites</MenuItem>
                {payrollEnabledSites.map((site) => <MenuItem key={site.id} value={site.id}>{site.name}</MenuItem>)}
              </TextField>
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setInitiateOpen(false)} color="inherit" disabled={initiating}>Cancel</Button>
          <Button variant="contained" disabled={initiating} onClick={handleInitiate} sx={{ borderRadius: 2, fontWeight: 700, px: 3 }}>
            {initiating ? <CircularProgress size={20} color="inherit" /> : 'Execute Payroll'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Salary Config Dialog */}
      <Dialog open={configOpen} onClose={() => !savingStructure && setConfigOpen(false)} maxWidth="md" fullWidth slotProps={{ paper: { sx: { borderRadius: 4 } } }}>
        <DialogTitle sx={{ fontWeight: 800, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}><PayrollIcon color="primary" /> Configure Salary Structure</Box>
        </DialogTitle>
        <Box component="form" onSubmit={handleSaveSalary}>
          <DialogContent dividers>
            {saveError && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{saveError}</Alert>}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Set up the monthly earnings components and statutory deductions compliance rules for <strong>{selectedEmp?.fullName}</strong>.
            </Typography>
            <Grid container spacing={4}>
              {/* Earnings Section */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" color="primary" fontWeight={850} sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Earnings (Monthly)
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth required label="Basic Salary (INR)" size="small" type="number"
                      value={salaryForm.basic}
                      onChange={(e) => setSalaryForm((f) => ({ ...f, basic: e.target.value }))}
                      slotProps={{ input: { sx: { borderRadius: 2 } } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth required label="Dearness Allowance / DA (INR)" size="small" type="number"
                      value={salaryForm.da}
                      onChange={(e) => setSalaryForm((f) => ({ ...f, da: e.target.value }))}
                      slotProps={{ input: { sx: { borderRadius: 2 } } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth required label="HRA (INR)" size="small" type="number"
                      value={salaryForm.hra}
                      onChange={(e) => setSalaryForm((f) => ({ ...f, hra: e.target.value }))}
                      slotProps={{ input: { sx: { borderRadius: 2 } } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth required label="Washing Allowance (INR)" size="small" type="number"
                      value={salaryForm.washingAllowance}
                      onChange={(e) => setSalaryForm((f) => ({ ...f, washingAllowance: e.target.value }))}
                      slotProps={{ input: { sx: { borderRadius: 2 } } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth label="Conveyance Allowance (INR)" size="small" type="number"
                      value={salaryForm.conveyance}
                      onChange={(e) => setSalaryForm((f) => ({ ...f, conveyance: e.target.value }))}
                      slotProps={{ input: { sx: { borderRadius: 2 } } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      fullWidth label="Special / Other Allowance (INR)" size="small" type="number"
                      value={salaryForm.special}
                      onChange={(e) => setSalaryForm((f) => ({ ...f, special: e.target.value }))}
                      slotProps={{ input: { sx: { borderRadius: 2 } } }}
                    />
                  </Grid>
                </Grid>
              </Grid>

              {/* Compliance & Deductions Section */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="subtitle2" color="primary" fontWeight={850} sx={{ mb: 2, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Compliance & Deductions
                </Typography>
                
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                  {/* PF Section */}
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography variant="subtitle2" fontWeight={800} gutterBottom>Provident Fund (P.F)</Typography>
                    <RadioGroup
                      row
                      value={salaryForm.pfType}
                      onChange={(e) => setSalaryForm((f) => ({ ...f, pfType: e.target.value }))}
                      sx={{ mb: 1.5 }}
                    >
                      <FormControlLabel value="STANDARD" control={<Radio size="small" />} label={<Typography variant="body2" fontWeight={600}>As per Basic + DA</Typography>} />
                      <FormControlLabel value="CUSTOM" control={<Radio size="small" />} label={<Typography variant="body2" fontWeight={600}>Custom Basic DA</Typography>} />
                    </RadioGroup>
                    {salaryForm.pfType === 'CUSTOM' && (
                      <TextField
                        fullWidth size="small" label="Custom Basis (INR)" type="number"
                        required
                        value={salaryForm.pfCustomBasis}
                        onChange={(e) => setSalaryForm((f) => ({ ...f, pfCustomBasis: e.target.value }))}
                        slotProps={{ input: { sx: { borderRadius: 1.5 } } }}
                        sx={{ mb: 1.5 }}
                      />
                    )}
                    <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">Est. Employee P.F: <strong>{INR(liveCalculations.pfEmployee)}</strong></Typography>
                      <Typography variant="caption" color="text.secondary">Est. Employer P.F: <strong>{INR(liveCalculations.pfEmployer)}</strong></Typography>
                    </Box>
                  </Paper>

                  {/* ESIC Section */}
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography variant="subtitle2" fontWeight={800} gutterBottom>ESIC</Typography>
                    <RadioGroup
                      row
                      value={salaryForm.esicType}
                      onChange={(e) => setSalaryForm((f) => ({ ...f, esicType: e.target.value }))}
                      sx={{ mb: 1.5 }}
                    >
                      <FormControlLabel value="STANDARD" control={<Radio size="small" />} label={<Typography variant="body2" fontWeight={600}>As per Gross</Typography>} />
                      <FormControlLabel value="CUSTOM" control={<Radio size="small" />} label={<Typography variant="body2" fontWeight={600}>Gross for ESIC</Typography>} />
                    </RadioGroup>
                    {salaryForm.esicType === 'CUSTOM' && (
                      <TextField
                        fullWidth size="small" label="Custom Basis (INR)" type="number"
                        required
                        value={salaryForm.esicCustomBasis}
                        onChange={(e) => setSalaryForm((f) => ({ ...f, esicCustomBasis: e.target.value }))}
                        slotProps={{ input: { sx: { borderRadius: 1.5 } } }}
                        sx={{ mb: 1.5 }}
                      />
                    )}
                    <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="caption" color="text.secondary">Est. Employee ESIC: <strong>{INR(liveCalculations.esicEmployee)}</strong></Typography>
                      <Typography variant="caption" color="text.secondary">Est. Employer ESIC: <strong>{INR(liveCalculations.esicEmployer)}</strong></Typography>
                    </Box>
                  </Paper>

                  {/* PT Section */}
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography variant="subtitle2" fontWeight={800} gutterBottom>Professional Tax (P.T)</Typography>
                    <RadioGroup
                      row
                      value={salaryForm.ptEnabled ? 'YES' : 'NO'}
                      onChange={(e) => setSalaryForm((f) => ({ ...f, ptEnabled: e.target.value === 'YES' }))}
                      sx={{ mb: 1.5 }}
                    >
                      <FormControlLabel value="YES" control={<Radio size="small" />} label={<Typography variant="body2" fontWeight={600}>Yes</Typography>} />
                      <FormControlLabel value="NO" control={<Radio size="small" />} label={<Typography variant="body2" fontWeight={600}>No</Typography>} />
                    </RadioGroup>
                    {salaryForm.ptEnabled && (
                      <TextField
                        fullWidth size="small" label="Custom Amount (INR)" type="number"
                        placeholder="Standard bracket"
                        value={salaryForm.ptCustomAmount}
                        onChange={(e) => setSalaryForm((f) => ({ ...f, ptCustomAmount: e.target.value }))}
                        slotProps={{ input: { sx: { borderRadius: 1.5 } } }}
                      />
                    )}
                  </Paper>

                  {/* MLWF Section */}
                  <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                    <Typography variant="subtitle2" fontWeight={800} gutterBottom>M.L.W.F</Typography>
                    <RadioGroup
                      row
                      value={salaryForm.mlwfEnabled ? 'YES' : 'NO'}
                      onChange={(e) => setSalaryForm((f) => ({ ...f, mlwfEnabled: e.target.value === 'YES' }))}
                      sx={{ mb: 1.5 }}
                    >
                      <FormControlLabel value="YES" control={<Radio size="small" />} label={<Typography variant="body2" fontWeight={600}>Yes</Typography>} />
                      <FormControlLabel value="NO" control={<Radio size="small" />} label={<Typography variant="body2" fontWeight={600}>No</Typography>} />
                    </RadioGroup>
                    {salaryForm.mlwfEnabled && (
                      <TextField
                        fullWidth size="small" label="Deduction Amount (INR)" type="number"
                        required
                        value={salaryForm.mlwfCustomAmount}
                        onChange={(e) => setSalaryForm((f) => ({ ...f, mlwfCustomAmount: e.target.value }))}
                        slotProps={{ input: { sx: { borderRadius: 1.5 } } }}
                      />
                    )}
                  </Paper>
                </Box>
              </Grid>
            </Grid>

            {/* LIVE CALCULATION SUMMARY */}
            <Divider sx={{ my: 3.5 }} />
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 6, sm: 4 }}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderLeft: '4px solid', borderLeftColor: 'success.main', background: alpha(theme.palette.success.main, 0.02) }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Gross Earnings</Typography>
                  <Typography variant="h5" fontWeight={850} color="success.main" sx={{ mt: 0.5 }}>{INR(liveCalculations.gross)}</Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 6, sm: 4 }}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderLeft: '4px solid', borderLeftColor: 'error.main', background: alpha(theme.palette.error.main, 0.02) }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Deductions</Typography>
                  <Typography variant="h5" fontWeight={850} color="error.main" sx={{ mt: 0.5 }}>
                    {INR(liveCalculations.pfEmployee + liveCalculations.esicEmployee + liveCalculations.ptAmount + liveCalculations.mlwfAmount)}
                  </Typography>
                </Paper>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, borderLeft: '4px solid', borderLeftColor: 'primary.main', background: alpha(theme.palette.primary.main, 0.02) }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: 0.5 }}>Estimated Net Pay</Typography>
                  <Typography variant="h5" fontWeight={850} color="primary.main" sx={{ mt: 0.5 }}>{INR(liveCalculations.netPay)}</Typography>
                </Paper>
              </Grid>
            </Grid>
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={() => setConfigOpen(false)} color="inherit" disabled={savingStructure}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={savingStructure} sx={{ borderRadius: 2.5, fontWeight: 700, px: 4 }}>
              {savingStructure ? <CircularProgress size={20} color="inherit" /> : 'Save Structure'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}

// Salary Structure Row Sub-Component
function SalaryStructureRow({
  employee,
  onConfigure
}: {
  employee: Employee;
  onConfigure: (structure: SalaryStructure | null) => void;
}) {
  // Load salary structure for this specific employee
  const { data: salaryData, isLoading } = useQuery({
    queryKey: ['salary-structure', employee.id],
    queryFn: async () => {
      try {
        const res: any = await apiClient.get(`/payroll/salary-structure/${employee.id}`);
        return res?.data || res || null;
      } catch (err: any) {
        if (err?.status === 404 || err?.response?.status === 404) {
          return null; // Not configured yet
        }
        throw err;
      }
    },
    retry: false
  });

  const structure: SalaryStructure | null = salaryData;

  const totalAllowance = (structure?.da || 0) + (structure?.washingAllowance || 0) + (structure?.conveyance || 0) + (structure?.special || 0);

  if (isLoading) {
    return (
      <TableRow hover>
        <TableCell sx={{ fontWeight: 600 }}>{employee.fullName}</TableCell>
        <TableCell>{employee.role}</TableCell>
        <TableCell colSpan={6} align="center">
          <CircularProgress size={16} />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow hover>
      <TableCell sx={{ fontWeight: 650 }}>{employee.fullName}</TableCell>
      <TableCell>
        <Chip label={employee.role} size="small" sx={{ fontWeight: 600, fontSize: '0.65rem' }} />
      </TableCell>
      
      {structure ? (
        <>
          <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{INR(structure.basic)}</TableCell>
          <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{INR(structure.hra)}</TableCell>
          <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{INR(totalAllowance)}</TableCell>
          <TableCell align="right" sx={{ fontFamily: 'monospace', fontWeight: 700, color: 'success.main' }}>
            {INR(structure.grossSalary)}
          </TableCell>
          <TableCell align="center">
            <Tooltip title={
              <Box sx={{ p: 0.5, fontSize: '0.72rem' }}>
                <div>PF: {INR(structure.pfEmployee)}</div>
                <div>ESIC: {INR(structure.esicEmployee)}</div>
                <div>PT: {INR(structure.ptAmount)}</div>
                <div>MLWF: {INR(structure.mlwfDeduction)}</div>
              </Box>
            }>
              <Chip
                label={`Deductions: ${INR((structure.pfEmployee || 0) + (structure.esicEmployee || 0) + (structure.ptAmount || 0) + (structure.mlwfDeduction || 0))}`}
                size="small"
                variant="outlined"
                sx={{ fontWeight: 600, fontSize: '0.65rem' }}
              />
            </Tooltip>
          </TableCell>
        </>
      ) : (
        <>
          <TableCell colSpan={5} align="center">
            <Chip
              label="No Structure Assigned"
              color="warning"
              size="small"
              sx={{ fontWeight: 800, fontSize: '0.65rem', borderRadius: 1.5 }}
            />
          </TableCell>
        </>
      )}

      <TableCell align="center">
        <IconButton
          color="primary"
          onClick={() => onConfigure(structure)}
          size="small"
          sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </TableCell>
    </TableRow>
  );
}
