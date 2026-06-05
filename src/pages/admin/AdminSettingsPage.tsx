import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Grid,
  Typography as MuiTypography,
  Button,
  TextField,
  Select,
  MenuItem,
  InputLabel,
  FormControl,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TablePagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
  Snackbar,
  Tab,
  Tabs,
} from '@mui/material';
import {
  AdminPanelSettings as AdminIcon,
  Business as BusinessIcon,
  Settings as ConfigIcon,
  History as AuditIcon,
  Download as ExportIcon,
  FlashOn as AutoAssignIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Save as SaveIcon,
  Search as SearchIcon,
  Clear as ClearIcon,
  CheckCircle as SuccessIcon,
  BarChart as StatsIcon,
} from '@mui/icons-material';

import { AdminService } from '../../api/admin.service';
import type { SystemStats } from '../../api/admin.service';
import { SiteService } from '../../api/site.service';
import { useAuthStore } from '../../stores/auth.store';

const Typography = MuiTypography as any;

interface ConfigItem {
  key: string;
  value: string;
  originalKey?: string;
  isNew?: boolean;
  isEdited?: boolean;
  isDeleted?: boolean;
}

export default function AdminSettingsPage() {
  const theme = useTheme();
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === 'SUPER_ADMIN';

  // Navigation Tab State: SUPER_ADMIN defaults to Stats (0), ADMIN defaults to Stats (0)
  // Note: Tab indexes:
  // SUPER_ADMIN: 0=Stats, 1=System Config, 2=Organizations, 3=Audit Logs, 4=Tools
  // ADMIN: 0=Stats, 1=Tools (restricted)
  const [tabIndex, setTabIndex] = useState(0);

  // Snackbar Notification State
  const [snackbar, setSnackbar] = useState<{ open: boolean; message: string; severity: 'success' | 'error' }>({
    open: false,
    message: '',
    severity: 'success',
  });

  const showToast = (message: string, severity: 'success' | 'error' = 'success') => {
    setSnackbar({ open: true, message, severity });
  };

  // Helper to retrieve roles cleanly
  const renderRoleChip = (role: string) => {
    let color = 'default';
    if (role === 'SUPER_ADMIN') color = 'error';
    else if (role === 'ADMIN') color = 'primary';
    return (
      <Box
        component="span"
        sx={{
          px: 1,
          py: 0.25,
          borderRadius: 1.5,
          fontSize: '0.75rem',
          fontWeight: 700,
          backgroundColor: color === 'error' ? alpha(theme.palette.error.main, 0.1) : alpha(theme.palette.primary.main, 0.1),
          color: color === 'error' ? theme.palette.error.main : theme.palette.primary.main,
          textTransform: 'uppercase',
        }}
      >
        {role}
      </Box>
    );
  };

  // ==========================================
  // TAB 1: Platform / Dashboard Statistics
  // ==========================================
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsOrgList, setStatsOrgList] = useState<any[]>([]);
  const [selectedStatsOrg, setSelectedStatsOrg] = useState<string>('GLOBAL');

  const loadStats = async (orgId?: string) => {
    setStatsLoading(true);
    try {
      const targetOrg = orgId === 'GLOBAL' ? undefined : orgId;
      const res: any = await AdminService.getDashboardStats(targetOrg);
      if (res?.success) {
        setStats(res.data);
      }
    } catch (err: any) {
      console.error('Failed to load dashboard stats', err);
      showToast('Failed to load dashboard statistics.', 'error');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    // If user is ADMIN, load stats scoped to their own organization
    if (user?.role === 'ADMIN' && user?.organizationId) {
      loadStats(user.organizationId);
    } else if (isSuperAdmin) {
      loadStats(selectedStatsOrg);
      // Fetch orgs list for filtering
      AdminService.listOrganizations(1, 100)
        .then((res: any) => {
          if (res?.success) {
            setStatsOrgList(res.data || []);
          }
        })
        .catch((e) => console.error('Failed to load filtering organizations', e));
    }
  }, [selectedStatsOrg, user]);

  const renderStatsCard = (title: string, value: number | string, icon: React.ReactNode, bgGradient: string) => (
    <Card
      sx={{
        borderRadius: 4,
        background: bgGradient,
        color: '#fff',
        boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 12px 40px 0 rgba(31, 38, 135, 0.25)',
        },
      }}
    >
      <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="subtitle2" sx={{ opacity: 0.8, fontWeight: 600, mb: 1, letterSpacing: 0.5 }}>
            {title}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800 }}>
            {value}
          </Typography>
        </Box>
        <Box
          sx={{
            p: 2,
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
          }}
        >
          {icon}
        </Box>
      </CardContent>
    </Card>
  );

  // ==========================================
  // TAB 2: System Configuration (Redis CRUD)
  // ==========================================
  const [configList, setConfigList] = useState<ConfigItem[]>([]);
  const [configLoading, setConfigLoading] = useState(false);
  const [isConfigDirty, setIsConfigDirty] = useState(false);
  const [isAddConfigOpen, setIsAddConfigOpen] = useState(false);
  const [newConfigKey, setNewConfigKey] = useState('');
  const [newConfigValue, setNewConfigValue] = useState('');

  const loadConfig = async () => {
    if (!isSuperAdmin) return;
    setConfigLoading(true);
    try {
      const res: any = await AdminService.getSystemConfig();
      if (res?.success && res.data?.config) {
        const list = Object.entries(res.data.config).map(([k, v]) => ({
          key: k,
          value: String(v),
          originalKey: k,
        }));
        setConfigList(list);
        setIsConfigDirty(false);
      }
    } catch (err: any) {
      console.error('Failed to load system config', err);
      showToast('Failed to load system configuration.', 'error');
    } finally {
      setConfigLoading(false);
    }
  };

  useEffect(() => {
    if (tabIndex === 1 && isSuperAdmin) {
      loadConfig();
    }
  }, [tabIndex]);

  const handleConfigValueChange = (index: number, newValue: string) => {
    const updated = [...configList];
    const item = updated[index];
    item.value = newValue;
    item.isEdited = true;
    setConfigList(updated);
    setIsConfigDirty(true);
  };

  const handleAddConfigKey = () => {
    if (!newConfigKey.trim()) {
      showToast('Parameter key is required.', 'error');
      return;
    }
    // Check duplication
    const exists = configList.some((item) => item.key === newConfigKey && !item.isDeleted);
    if (exists) {
      showToast('Parameter key already exists.', 'error');
      return;
    }

    setConfigList([
      ...configList,
      {
        key: newConfigKey.trim(),
        value: newConfigValue,
        isNew: true,
      },
    ]);
    setIsConfigDirty(true);
    setNewConfigKey('');
    setNewConfigValue('');
    setIsAddConfigOpen(false);
    showToast('New parameter added locally.');
  };

  const handleConfigDelete = (index: number) => {
    const updated = [...configList];
    const item = updated[index];
    if (item.isNew) {
      // If it's a locally added item, just remove it from the list
      updated.splice(index, 1);
    } else {
      // Mark as deleted (since PUT doesn't remove, we might keep it or warn, but let's hide it locally for save)
      // Actually, since Redis has no explicit delete API exposed, let's remove it from the payload.
      // Note that PUT /v1/admin/config overrides the keys we send, but the backend is putAll.
      // So deleting locally means it won't be modified in Redis, but it won't be deleted either.
      // We will warn the user that deleting clears the key or keeps it, but let's remove it from our save payload.
      item.isDeleted = true;
    }
    setConfigList(updated);
    setIsConfigDirty(true);
  };

  const handleSaveConfig = async () => {
    setConfigLoading(true);
    try {
      // Re-assemble the configuration map (excluding items marked as deleted)
      const payload: Record<string, any> = {};
      configList.forEach((item) => {
        if (!item.isDeleted) {
          payload[item.key] = item.value;
        }
      });

      const res: any = await AdminService.updateSystemConfig(payload);
      if (res?.success) {
        showToast('System configuration saved successfully.', 'success');
        // Reload configuration
        await loadConfig();
      }
    } catch (err: any) {
      console.error('Failed to save config', err);
      showToast('Failed to save system configuration: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setConfigLoading(false);
    }
  };

  // ==========================================
  // TAB 3: Organizations Management (CRUD)
  // ==========================================
  const [orgs, setOrgs] = useState<any[]>([]);
  const [orgsLoading, setOrgsLoading] = useState(false);
  const [orgPage, setOrgPage] = useState(0);
  const [orgLimit, setOrgLimit] = useState(10);
  const [orgTotal, setOrgTotal] = useState(0);

  // Dialog Forms
  const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false);
  const [orgToEdit, setOrgToEdit] = useState<any | null>(null);
  const [orgNameInput, setOrgNameInput] = useState('');
  const [isOrgSaving, setIsOrgSaving] = useState(false);

  // Delete Confirm
  const [orgToDelete, setOrgToDelete] = useState<any | null>(null);
  const [isOrgDeleting, setIsOrgDeleting] = useState(false);

  const loadOrganizations = async (page = orgPage, limit = orgLimit) => {
    if (!isSuperAdmin) return;
    setOrgsLoading(true);
    try {
      // Backend uses 1-based page index
      const res: any = await AdminService.listOrganizations(page + 1, limit);
      if (res?.success) {
        setOrgs(res.data || []);
        if (res.meta) {
          setOrgTotal(res.meta.total || 0);
        }
      }
    } catch (err: any) {
      console.error('Failed to load organizations', err);
      showToast('Failed to load organizations.', 'error');
    } finally {
      setOrgsLoading(false);
    }
  };

  useEffect(() => {
    if (tabIndex === 2 && isSuperAdmin) {
      loadOrganizations(orgPage, orgLimit);
    }
  }, [tabIndex, orgPage, orgLimit]);

  const handleOpenOrgCreate = () => {
    setOrgToEdit(null);
    setOrgNameInput('');
    setIsOrgDialogOpen(true);
  };

  const handleOpenOrgEdit = (org: any) => {
    setOrgToEdit(org);
    setOrgNameInput(org.name);
    setIsOrgDialogOpen(true);
  };

  const handleSaveOrganization = async () => {
    if (!orgNameInput.trim()) {
      showToast('Organization name is required.', 'error');
      return;
    }
    setIsOrgSaving(true);
    try {
      if (orgToEdit) {
        const res = await AdminService.updateOrganization(orgToEdit.id, orgNameInput.trim());
        if (res) {
          showToast('Organization updated successfully.');
          loadOrganizations();
          setIsOrgDialogOpen(false);
        }
      } else {
        const res = await AdminService.createOrganization(orgNameInput.trim());
        if (res) {
          showToast('Organization created successfully.');
          loadOrganizations();
          setIsOrgDialogOpen(false);
        }
      }
    } catch (err: any) {
      console.error('Failed to save organization', err);
      showToast('Failed to save organization: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setIsOrgSaving(false);
    }
  };

  const handleDeleteOrgConfirm = async () => {
    if (!orgToDelete) return;
    setIsOrgDeleting(true);
    try {
      await AdminService.deleteOrganization(orgToDelete.id);
      showToast('Organization deleted successfully.');
      loadOrganizations();
      setOrgToDelete(null);
    } catch (err: any) {
      console.error('Failed to delete organization', err);
      const errMsg = typeof err === 'string' ? err : err.response?.data?.message || err.message || 'Failed to delete organization due to dependencies.';
      showToast(errMsg, 'error');
    } finally {
      setIsOrgDeleting(false);
    }
  };

  // ==========================================
  // TAB 4: Audit Logs (Viewer)
  // ==========================================
  const [logs, setLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsPage, setLogsPage] = useState(0);
  const [logsLimit, setLogsLimit] = useState(10);
  const [logsTotal, setLogsTotal] = useState(0);

  // Filters
  const [filterUserId, setFilterUserId] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const loadAuditLogs = async (page = logsPage, limit = logsLimit) => {
    if (!isSuperAdmin) return;
    setLogsLoading(true);
    try {
      const params: any = {
        page: page + 1,
        limit,
      };
      if (filterUserId.trim()) params.userId = filterUserId.trim();
      if (filterAction.trim()) params.action = filterAction.trim();

      const res: any = await AdminService.getAuditLogs(params);
      if (res?.success) {
        setLogs(res.data || []);
        if (res.meta) {
          setLogsTotal(res.meta.total || 0);
        }
      }
    } catch (err: any) {
      console.error('Failed to load audit logs', err);
      showToast('Failed to load audit logs.', 'error');
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (tabIndex === 3 && isSuperAdmin) {
      loadAuditLogs(logsPage, logsLimit);
    }
  }, [tabIndex, logsPage, logsLimit]);

  const handleApplyLogsFilter = () => {
    setLogsPage(0);
    loadAuditLogs(0, logsLimit);
  };

  const handleClearLogsFilter = () => {
    setFilterUserId('');
    setFilterAction('');
    setLogsPage(0);
    // Reload logs
    setLogsLoading(true);
    AdminService.getAuditLogs({ page: 1, limit: logsLimit })
      .then((res: any) => {
        if (res?.success) {
          setLogs(res.data || []);
          setLogsTotal(res.meta?.total || 0);
        }
      })
      .catch((e) => console.error(e))
      .finally(() => setLogsLoading(false));
  };

  // ==========================================
  // TAB 5: Maintenance & Tools
  // ==========================================
  const [exportEntity, setExportEntity] = useState<'users' | 'employees' | 'sites'>('users');
  const [exportOrgId, setExportOrgId] = useState<string>('GLOBAL');
  const [isExporting, setIsExporting] = useState(false);

  // Auto assignment states
  const [autoAssignSites, setAutoAssignSites] = useState<any[]>([]);
  const [selectedAutoAssignSite, setSelectedAutoAssignSite] = useState('');
  const [autoAssignOrgId, setAutoAssignOrgId] = useState('GLOBAL');
  const [autoAssignResult, setAutoAssignResult] = useState<any | null>(null);
  const [isAutoAssignRunning, setIsAutoAssignRunning] = useState(false);

  useEffect(() => {
    if (tabIndex === (isSuperAdmin ? 4 : 1)) {
      // Fetch sites list for auto-assignment site selection
      SiteService.getSites(1, 100)
        .then((res: any) => {
          if (res?.success && Array.isArray(res.data)) {
            setAutoAssignSites(res.data);
          }
        })
        .catch((e) => console.error('Failed to load sites for auto assignment', e));
    }
  }, [tabIndex, isSuperAdmin]);

  const handleCsvExport = async () => {
    setIsExporting(true);
    try {
      const targetOrg = exportOrgId === 'GLOBAL' ? undefined : exportOrgId;
      const response = await AdminService.exportData(exportEntity, targetOrg);
      
      // Axios response data is a blob if successful
      const blob = response as any as Blob;
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${exportEntity}_export_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
      showToast(`${exportEntity.toUpperCase()} exported to CSV successfully.`);
    } catch (err: any) {
      console.error('Export failed', err);
      showToast('Export failed. Please try again.', 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRunAutoAssign = async () => {
    if (!selectedAutoAssignSite) {
      showToast('Please select a target site.', 'error');
      return;
    }
    setIsAutoAssignRunning(true);
    setAutoAssignResult(null);
    try {
      const targetOrg = autoAssignOrgId === 'GLOBAL' ? undefined : autoAssignOrgId;
      const res: any = await AdminService.autoAssignEmployees(selectedAutoAssignSite, targetOrg);
      if (res?.success) {
        setAutoAssignResult(res.data);
        showToast('Auto assignment executed successfully.', 'success');
      }
    } catch (err: any) {
      console.error('Auto assign failed', err);
      showToast('Auto assignment failed: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setIsAutoAssignRunning(false);
    }
  };

  // Helper to handle role dependent tab index mapping
  // SUPER_ADMIN has 5 tabs: Stats (0), Config (1), Orgs (2), Logs (3), Tools (4)
  // ADMIN has 2 tabs: Stats (0), Tools (1)
  const handleTabChange = (_event: React.SyntheticEvent, newIdx: number) => {
    setTabIndex(newIdx);
  };

  return (
    <Box sx={{ p: 4, minHeight: '100%' }}>
      {/* Premium Glassmorphic Header */}
      <Paper
        elevation={0}
        sx={{
          p: 3.5,
          mb: 4,
          borderRadius: 4,
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
          backdropFilter: 'blur(10px)',
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.05)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box
            sx={{
              p: 2,
              borderRadius: 3,
              backgroundColor: alpha(theme.palette.primary.main, 0.1),
              color: theme.palette.primary.main,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <AdminIcon fontSize="large" />
          </Box>
          <Box>
            <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>
              Admin Settings Dashboard
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Configure parameters, manage tenant organizations, view audits, and execute background operations.
            </Typography>
          </Box>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 0.5 }}>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            Logged in as: {user?.name || 'Admin'}
          </Typography>
          <Box>{renderRoleChip(user?.role || '')}</Box>
        </Box>
      </Paper>

      {/* Navigation Tabs */}
      <Tabs
        value={tabIndex}
        onChange={handleTabChange}
        variant="scrollable"
        scrollButtons="auto"
        sx={{
          mb: 4,
          borderBottom: 1,
          borderColor: 'divider',
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 700,
            fontSize: '0.95rem',
            minHeight: 48,
            px: 3,
            borderRadius: '8px 8px 0 0',
            mr: 1,
            transition: 'all 0.2s',
            '&:hover': {
              backgroundColor: alpha(theme.palette.primary.main, 0.04),
              color: theme.palette.primary.main,
            },
          },
          '& .Mui-selected': {
            color: `${theme.palette.primary.main} !important`,
            backgroundColor: `${alpha(theme.palette.primary.main, 0.08)} !important`,
          },
        }}
      >
        <Tab icon={<StatsIcon fontSize="small" />} iconPosition="start" label="Dashboard Stats" />
        {isSuperAdmin && <Tab icon={<ConfigIcon fontSize="small" />} iconPosition="start" label="System Config" />}
        {isSuperAdmin && <Tab icon={<BusinessIcon fontSize="small" />} iconPosition="start" label="Organizations" />}
        {isSuperAdmin && <Tab icon={<AuditIcon fontSize="small" />} iconPosition="start" label="Audit Logs" />}
        <Tab icon={<ExportIcon fontSize="small" />} iconPosition="start" label="Maintenance & Tools" />
      </Tabs>

      {/* Tab Panels */}

      {/* PANEL 0: DASHBOARD STATISTICS */}
      {tabIndex === 0 && (
        <Box>
          {isSuperAdmin && (
            <Card sx={{ borderRadius: 4, mb: 4, border: `1px solid ${theme.palette.divider}`, boxShadow: 'none' }}>
              <CardContent sx={{ display: 'flex', alignItems: 'center', gap: 3, py: 2 }}>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  Select Scope:
                </Typography>
                <FormControl sx={{ minWidth: 240 }} size="small">
                  <Select
                    value={selectedStatsOrg}
                    onChange={(e) => setSelectedStatsOrg(e.target.value)}
                    sx={{ borderRadius: 2 }}
                  >
                    <MenuItem value="GLOBAL">
                      <strong>Global Overview (All Orgs)</strong>
                    </MenuItem>
                    {statsOrgList.map((o) => (
                      <MenuItem key={o.id} value={o.id}>
                        {o.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <IconButton color="primary" onClick={() => loadStats(selectedStatsOrg)}>
                  <RefreshIcon />
                </IconButton>
              </CardContent>
            </Card>
          )}

          {statsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress size={50} />
            </Box>
          ) : stats ? (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                {renderStatsCard(
                  'TOTAL USERS',
                  stats.totalUsers,
                  <StatsIcon fontSize="medium" />,
                  'linear-gradient(135deg, #3f51b5 0%, #1a237e 100%)'
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                {renderStatsCard(
                  'ACTIVE USERS',
                  stats.activeUsers,
                  <StatsIcon fontSize="medium" />,
                  'linear-gradient(135deg, #2196f3 0%, #0d47a1 100%)'
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                {renderStatsCard(
                  'EMPLOYEES COUNT',
                  stats.totalEmployees,
                  <StatsIcon fontSize="medium" />,
                  'linear-gradient(135deg, #009688 0%, #004d40 100%)'
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                {renderStatsCard(
                  'TOTAL SITES',
                  stats.totalSites,
                  <StatsIcon fontSize="medium" />,
                  'linear-gradient(135deg, #ff9800 0%, #e65100 100%)'
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                {renderStatsCard(
                  'ACTIVE SITES',
                  stats.activeSites,
                  <StatsIcon fontSize="medium" />,
                  'linear-gradient(135deg, #e91e63 0%, #880e4f 100%)'
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                {renderStatsCard(
                  'TODAY ATTENDANCE',
                  stats.todayAttendanceCount,
                  <StatsIcon fontSize="medium" />,
                  'linear-gradient(135deg, #4caf50 0%, #1b5e20 100%)'
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                {renderStatsCard(
                  'PAYROLL RUNS',
                  stats.totalPayrollRuns,
                  <StatsIcon fontSize="medium" />,
                  'linear-gradient(135deg, #9c27b0 0%, #4a148c 100%)'
                )}
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">No statistics data available.</Alert>
          )}
        </Box>
      )}

      {/* PANEL 1: SYSTEM CONFIGURATION (SUPER_ADMIN ONLY) */}
      {tabIndex === 1 && isSuperAdmin && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Redis Hash Configuration Map
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={() => setIsAddConfigOpen(true)}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
              >
                Add Parameter
              </Button>
              <Button
                variant="contained"
                startIcon={<SaveIcon />}
                color="primary"
                disabled={!isConfigDirty || configLoading}
                onClick={handleSaveConfig}
                sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
              >
                Save Changes
              </Button>
            </Box>
          </Box>

          {configLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : configList.filter(item => !item.isDeleted).length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 3 }}>
              No config entries found. Click Add Parameter to create one.
            </Alert>
          ) : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
              <Table>
                <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Key / Parameter</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>Value</TableCell>
                    <TableCell align="center" sx={{ fontWeight: 800, width: 120 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {configList.map((item, idx) => {
                    if (item.isDeleted) return null;
                    return (
                      <TableRow
                        key={item.key}
                        sx={{
                          backgroundColor: item.isNew
                            ? alpha(theme.palette.success.main, 0.05)
                            : item.isEdited
                            ? alpha(theme.palette.info.main, 0.05)
                            : 'inherit',
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.01),
                          },
                        }}
                      >
                        <TableCell sx={{ fontWeight: 650 }}>
                          {item.key}
                          {item.isNew && (
                            <Box
                              component="span"
                              sx={{
                                ml: 1,
                                px: 0.8,
                                py: 0.2,
                                borderRadius: 1,
                                fontSize: '0.65rem',
                                backgroundColor: 'success.main',
                                color: 'success.contrastText',
                                fontWeight: 800,
                              }}
                            >
                              NEW
                            </Box>
                          )}
                          {item.isEdited && !item.isNew && (
                            <Box
                              component="span"
                              sx={{
                                ml: 1,
                                px: 0.8,
                                py: 0.2,
                                borderRadius: 1,
                                fontSize: '0.65rem',
                                backgroundColor: 'info.main',
                                color: 'info.contrastText',
                                fontWeight: 800,
                              }}
                            >
                              EDITED
                            </Box>
                          )}
                        </TableCell>
                        <TableCell>
                          <TextField
                            value={item.value}
                            size="small"
                            fullWidth
                            variant="outlined"
                            onChange={(e) => handleConfigValueChange(idx, e.target.value)}
                            slotProps={{ input: { sx: { borderRadius: 2 } } }}
                          />
                        </TableCell>
                        <TableCell align="center">
                          <Tooltip title="Remove Parameter">
                            <IconButton color="error" size="small" onClick={() => handleConfigDelete(idx)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* ADD CONFIG DIALOG */}
          <Dialog
            open={isAddConfigOpen}
            onClose={() => setIsAddConfigOpen(false)}
            slotProps={{ paper: { sx: { borderRadius: 4, width: 480 } } }}
          >
            <DialogTitle sx={{ fontWeight: 800 }}>Add System Parameter</DialogTitle>
            <DialogContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
                <TextField
                  label="Config Key"
                  placeholder="e.g. max_allowed_radius_meters"
                  fullWidth
                  value={newConfigKey}
                  onChange={(e) => setNewConfigKey(e.target.value)}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
                <TextField
                  label="Config Value"
                  placeholder="e.g. 250"
                  fullWidth
                  value={newConfigValue}
                  onChange={(e) => setNewConfigValue(e.target.value)}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setIsAddConfigOpen(false)} variant="outlined" sx={{ borderRadius: 2 }}>
                Cancel
              </Button>
              <Button onClick={handleAddConfigKey} variant="contained" color="primary" sx={{ borderRadius: 2 }}>
                Add Parameter
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}

      {/* PANEL 2: ORGANIZATIONS MANAGEMENT (SUPER_ADMIN ONLY) */}
      {tabIndex === 2 && isSuperAdmin && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              Tenant Organizations
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenOrgCreate}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
            >
              Create Organization
            </Button>
          </Box>

          {orgsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : orgs.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 3 }}>
              No organizations found. Click Create Organization to register one.
            </Alert>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
              <TableContainer>
                <Table>
                  <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>Organization Name</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Registered On</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Last Updated</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, width: 140 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {orgs.map((org) => (
                      <TableRow key={org.id} sx={{ '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.01) } }}>
                        <TableCell sx={{ fontWeight: 700 }}>{org.name}</TableCell>
                        <TableCell color="text.secondary">
                          {new Date(org.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </TableCell>
                        <TableCell color="text.secondary">
                          {new Date(org.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </TableCell>
                        <TableCell align="center">
                          <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                            <Tooltip title="Edit Name">
                              <IconButton color="info" size="small" onClick={() => handleOpenOrgEdit(org)}>
                                <EditIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete Organization">
                              <IconButton color="error" size="small" onClick={() => setOrgToDelete(org)}>
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={orgTotal}
                page={orgPage}
                onPageChange={(_e, newPage) => setOrgPage(newPage)}
                rowsPerPage={orgLimit}
                onRowsPerPageChange={(e) => {
                  setOrgLimit(parseInt(e.target.value, 10));
                  setOrgPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25, 50]}
              />
            </Paper>
          )}

          {/* CREATE / EDIT DIALOG */}
          <Dialog
            open={isOrgDialogOpen}
            onClose={() => setIsOrgDialogOpen(false)}
            slotProps={{ paper: { sx: { borderRadius: 4, width: 440 } } }}
          >
            <DialogTitle sx={{ fontWeight: 800 }}>
              {orgToEdit ? 'Edit Tenant Organization' : 'Register New Tenant Organization'}
            </DialogTitle>
            <DialogContent sx={{ py: 2 }}>
              <Box sx={{ mt: 1 }}>
                <TextField
                  label="Organization Name"
                  placeholder="e.g. Reliance Logistics Group"
                  fullWidth
                  value={orgNameInput}
                  onChange={(e) => setOrgNameInput(e.target.value)}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setIsOrgDialogOpen(false)} variant="outlined" sx={{ borderRadius: 2 }}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveOrganization}
                variant="contained"
                color="primary"
                disabled={isOrgSaving}
                sx={{ borderRadius: 2 }}
              >
                {isOrgSaving ? <CircularProgress size={24} /> : orgToEdit ? 'Save Changes' : 'Create Organization'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* CONFIRM DELETE DIALOG */}
          <Dialog
            open={!!orgToDelete}
            onClose={() => setOrgToDelete(null)}
            slotProps={{ paper: { sx: { borderRadius: 4, width: 400 } } }}
          >
            <DialogTitle sx={{ fontWeight: 800 }}>Confirm Deletion</DialogTitle>
            <DialogContent>
              <Typography variant="body1">
                Are you sure you want to delete the organization <strong>{orgToDelete?.name}</strong>?
              </Typography>
              <Typography variant="body2" color="error" sx={{ mt: 2, fontWeight: 600 }}>
                Warning: This action cannot be undone and will fail if the organization contains sites, employees, or payroll runs.
              </Typography>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setOrgToDelete(null)} variant="outlined" sx={{ borderRadius: 2 }}>
                Cancel
              </Button>
              <Button
                onClick={handleDeleteOrgConfirm}
                variant="contained"
                color="error"
                disabled={isOrgDeleting}
                sx={{ borderRadius: 2 }}
              >
                {isOrgDeleting ? <CircularProgress size={24} /> : 'Delete Permanently'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}

      {/* PANEL 3: AUDIT LOGS (SUPER_ADMIN ONLY) */}
      {tabIndex === 3 && isSuperAdmin && (
        <Box>
          {/* Filters card */}
          <Card sx={{ borderRadius: 4, mb: 4, border: `1px solid ${theme.palette.divider}`, boxShadow: 'none' }}>
            <CardContent>
              <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 2.5 }}>
                Filter Audit Trails
              </Typography>
              <Grid container spacing={3} sx={{ alignItems: 'center' }}>
                <Grid size={{ xs: 12, md: 5 }}>
                  <TextField
                    label="Filter by Actor User ID"
                    placeholder="Search UUID..."
                    fullWidth
                    size="small"
                    value={filterUserId}
                    onChange={(e) => setFilterUserId(e.target.value)}
                    slotProps={{ input: { sx: { borderRadius: 2 } } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Filter by Action Type"
                    placeholder="e.g. UPDATE_CONFIG, CREATE_USER..."
                    fullWidth
                    size="small"
                    value={filterAction}
                    onChange={(e) => setFilterAction(e.target.value)}
                    slotProps={{ input: { sx: { borderRadius: 2 } } }}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 3 }} sx={{ display: 'flex', gap: 1 }}>
                  <Button
                    variant="contained"
                    startIcon={<SearchIcon />}
                    onClick={handleApplyLogsFilter}
                    fullWidth
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                  >
                    Apply Filters
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<ClearIcon />}
                    onClick={handleClearLogsFilter}
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
                  >
                    Reset
                  </Button>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {logsLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : logs.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 3 }}>
              No audit logs found matching the criteria.
            </Alert>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
              <TableContainer>
                <Table>
                  <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>Timestamp (IST)</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Actor</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Action</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Target Entity</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>IP Address</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Metadata / Details</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {logs.map((log) => (
                      <TableRow key={log.id} sx={{ '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.01) } }}>
                        <TableCell sx={{ fontSize: '0.85rem' }}>
                          {new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.85rem', fontFamily: 'monospace', color: 'text.secondary' }}>
                          {log.userId}
                        </TableCell>
                        <TableCell>
                          <Box
                            component="span"
                            sx={{
                              px: 1,
                              py: 0.4,
                              borderRadius: 1.5,
                              fontSize: '0.7rem',
                              fontWeight: 800,
                              backgroundColor: alpha(theme.palette.primary.main, 0.08),
                              color: theme.palette.primary.main,
                              letterSpacing: 0.5,
                            }}
                          >
                            {log.action}
                          </Box>
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.85rem', fontWeight: 650 }}>
                          {log.targetEntity || 'System'}
                          {log.targetId && (
                            <Box component="div" sx={{ fontSize: '0.7rem', fontFamily: 'monospace', color: 'text.secondary', fontWeight: 400 }}>
                              ID: {log.targetId}
                            </Box>
                          )}
                        </TableCell>
                        <TableCell sx={{ fontSize: '0.85rem' }}>{log.ipAddress}</TableCell>
                        <TableCell sx={{ fontSize: '0.75rem', fontFamily: 'monospace', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          <Tooltip title={JSON.stringify(log.metadata, null, 2)}>
                            <span>{JSON.stringify(log.metadata)}</span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={logsTotal}
                page={logsPage}
                onPageChange={(_e, newPage) => setLogsPage(newPage)}
                rowsPerPage={logsLimit}
                onRowsPerPageChange={(e) => {
                  setLogsLimit(parseInt(e.target.value, 10));
                  setLogsPage(0);
                }}
                rowsPerPageOptions={[10, 25, 50, 100]}
              />
            </Paper>
          )}
        </Box>
      )}

      {/* PANEL 4 / 1: MAINTENANCE & DATA TOOLS (ALL ADMINS) */}
      {(tabIndex === (isSuperAdmin ? 4 : 1)) && (
        <Grid container spacing={4}>
          {/* CSV Export Card */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 4, height: '100%', border: `1px solid ${theme.palette.divider}`, boxShadow: 'none' }}>
              <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '100%', justifyContents: 'space-between' }}>
                <Box>
                  <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                    Data Exporter (CSV)
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                    Download tabular comma-separated values reports for key database collections.
                  </Typography>

                  <FormControl fullWidth sx={{ mb: 3 }} size="small">
                    <InputLabel id="export-entity-label">Export Entity Collection</InputLabel>
                    <Select
                      labelId="export-entity-label"
                      value={exportEntity}
                      label="Export Entity Collection"
                      onChange={(e) => setExportEntity(e.target.value as any)}
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value="users">System Users Collection</MenuItem>
                      <MenuItem value="employees">Employee Remuneration Roster</MenuItem>
                      <MenuItem value="sites">Operational Site List</MenuItem>
                    </Select>
                  </FormControl>

                  {isSuperAdmin && (
                    <FormControl fullWidth sx={{ mb: 4 }} size="small">
                      <InputLabel id="export-org-label">Filter/Scope by Organization</InputLabel>
                      <Select
                        labelId="export-org-label"
                        value={exportOrgId}
                        label="Filter/Scope by Organization"
                        onChange={(e) => setExportOrgId(e.target.value)}
                        sx={{ borderRadius: 2 }}
                      >
                        <MenuItem value="GLOBAL">
                          <strong>Global Export (All Tenant Organizations)</strong>
                        </MenuItem>
                        {statsOrgList.map((o) => (
                          <MenuItem key={o.id} value={o.id}>
                            {o.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}
                </Box>

                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<ExportIcon />}
                  fullWidth
                  disabled={isExporting}
                  onClick={handleCsvExport}
                  sx={{
                    borderRadius: 2.5,
                    py: 1.25,
                    textTransform: 'none',
                    fontWeight: 700,
                    mt: 'auto',
                  }}
                >
                  {isExporting ? <CircularProgress size={24} color="inherit" /> : `Download ${exportEntity.toUpperCase()} CSV`}
                </Button>
              </CardContent>
            </Card>
          </Grid>

          {/* Auto assignment Card (SUPER_ADMIN ONLY) */}
          {isSuperAdmin && (
            <Grid size={{ xs: 12, md: 6 }}>
              <Card sx={{ borderRadius: 4, height: '100%', border: `1px solid ${theme.palette.divider}`, boxShadow: 'none' }}>
                <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
                      Employee Auto-Assignment Tool
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
                      Detects and auto-assigns active employees meeting the 1-year threshold on April 1st to the target site.
                    </Typography>

                    <FormControl fullWidth sx={{ mb: 3 }} size="small">
                      <InputLabel id="auto-assign-site-label">Select Target Assignment Site</InputLabel>
                      <Select
                        labelId="auto-assign-site-label"
                        value={selectedAutoAssignSite}
                        label="Select Target Assignment Site"
                        onChange={(e) => setSelectedAutoAssignSite(e.target.value)}
                        sx={{ borderRadius: 2 }}
                      >
                        <MenuItem value="" disabled>Select Target Site</MenuItem>
                        {autoAssignSites.map((site) => (
                          <MenuItem key={site.id} value={site.id}>
                            {site.name} ({site.address || 'No Address'})
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>

                    <FormControl fullWidth sx={{ mb: 4 }} size="small">
                      <InputLabel id="auto-assign-org-label">Filter/Scope by Organization</InputLabel>
                      <Select
                        labelId="auto-assign-org-label"
                        value={autoAssignOrgId}
                        label="Filter/Scope by Organization"
                        onChange={(e) => setAutoAssignOrgId(e.target.value)}
                        sx={{ borderRadius: 2 }}
                      >
                        <MenuItem value="GLOBAL">
                          <strong>Global Run (All Organizations)</strong>
                        </MenuItem>
                        {statsOrgList.map((o) => (
                          <MenuItem key={o.id} value={o.id}>
                            {o.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Box>

                  {autoAssignResult && (
                    <Alert
                      severity="success"
                      icon={<SuccessIcon fontSize="inherit" />}
                      sx={{ mb: 3, borderRadius: 2 }}
                    >
                      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                        Auto-Assignment Complete:
                      </Typography>
                      <Box sx={{ mt: 0.5, fontSize: '0.85rem' }}>
                        <div>Threshold Date Evaluated: {autoAssignResult.thresholdDate}</div>
                        <div>Eligible Employees Detected: {autoAssignResult.totalEligibleEmployees}</div>
                        <div>Successfully Updated: {autoAssignResult.updatedCount}</div>
                      </Box>
                    </Alert>
                  )}

                  <Button
                    variant="contained"
                    color="secondary"
                    startIcon={<AutoAssignIcon />}
                    fullWidth
                    disabled={isAutoAssignRunning || !selectedAutoAssignSite}
                    onClick={handleRunAutoAssign}
                    sx={{
                      borderRadius: 2.5,
                      py: 1.25,
                      textTransform: 'none',
                      fontWeight: 700,
                      mt: 'auto',
                    }}
                  >
                    {isAutoAssignRunning ? <CircularProgress size={24} color="inherit" /> : 'Run Threshold Auto-Assignment'}
                  </Button>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      )}

      {/* SNACKBAR FEEDBACK */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert
          onClose={() => setSnackbar({ ...snackbar, open: false })}
          severity={snackbar.severity}
          sx={{ borderRadius: 3, width: '100%', boxShadow: theme.shadows[6] }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
