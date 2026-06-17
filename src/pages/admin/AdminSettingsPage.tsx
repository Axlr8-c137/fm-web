import React, { useState, useEffect, useMemo } from 'react';
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
  FormControlLabel,
  Switch,
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
  People as PeopleIcon,
  Block as DeactivateIcon,
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

  // Navigation Tab State
  // SUPER_ADMIN tabs: 0=Stats, 1=Users, 2=Config, 3=Orgs, 4=Logs, 5=Tools
  // ADMIN tabs: 0=Stats, 1=Users, 2=Tools
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
    else if (role === 'SUPERVISOR') color = 'warning';
    return (
      <Box
        component="span"
        sx={{
          px: 1,
          py: 0.25,
          borderRadius: 1.5,
          fontSize: '0.75rem',
          fontWeight: 700,
          backgroundColor: color === 'error' 
            ? alpha(theme.palette.error.main, 0.1) 
            : color === 'warning'
            ? alpha(theme.palette.warning.main, 0.1)
            : alpha(theme.palette.primary.main, 0.1),
          color: color === 'error' 
            ? theme.palette.error.main 
            : color === 'warning'
            ? theme.palette.warning.main
            : theme.palette.primary.main,
          textTransform: 'uppercase',
        }}
      >
        {role}
      </Box>
    );
  };

  // ==========================================
  // TAB 0: Platform / Dashboard Statistics
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
    if (user?.role === 'ADMIN' && user?.organizationId) {
      loadStats(user.organizationId);
    } else if (isSuperAdmin) {
      loadStats(selectedStatsOrg);
      AdminService.listOrganizations(1, 100)
        .then((res: any) => {
          if (res?.success) {
            setStatsOrgList(res.data || []);
          }
        })
        .catch((e) => console.error('Failed to load filtering organizations', e));
    }
  }, [selectedStatsOrg, user]);

  const renderStatsCard = (
    title: string, 
    value: number | string, 
    icon: React.ReactNode, 
    bgGradient: string,
    textColor: string,
    iconBg: string,
    iconColor: string
  ) => (
    <Card
      sx={{
        borderRadius: 4,
        background: bgGradient,
        color: textColor,
        boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.03)',
        border: `1px solid ${theme.palette.divider}`,
        transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
        '&:hover': {
          transform: 'translateY(-4px)',
          boxShadow: '0 8px 30px 0 rgba(0, 0, 0, 0.08)',
        },
      }}
    >
      <CardContent sx={{ p: 3, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Box>
          <Typography variant="subtitle2" sx={{ opacity: 0.8, fontWeight: 700, mb: 1, letterSpacing: 0.5, textTransform: 'uppercase', fontSize: '0.7rem' }}>
            {title}
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 900 }}>
            {value}
          </Typography>
        </Box>
        <Box
          sx={{
            p: 2,
            borderRadius: '50%',
            backgroundColor: iconBg,
            color: iconColor,
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
  // TAB 1: User Management (CRUD)
  // ==========================================
  const [usersList, setUsersList] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersPage, setUsersPage] = useState(0);
  const [usersLimit, setUsersLimit] = useState(10);
  const [usersTotal, setUsersTotal] = useState(0);
  const [userSearch, setUserSearch] = useState('');
  const [userOrgFilter, setUserOrgFilter] = useState('GLOBAL');
  const [selectedUserRole, setSelectedUserRole] = useState('');

  // Add / Edit User Dialog States
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false);
  const [userToEdit, setUserToEdit] = useState<any | null>(null);
  const [userEmail, setUserEmail] = useState('');
  const [userPhone, setUserPhone] = useState('');
  const [userPassword, setUserPassword] = useState('');
  const [userRole, setUserRole] = useState('EMPLOYEE');
  const [userOrgId, setUserOrgId] = useState('');
  const [userIsActive, setUserIsActive] = useState(true);
  const [isUserSaving, setIsUserSaving] = useState(false);

  // Deactivate User States
  const [userToDelete, setUserToDelete] = useState<any | null>(null);
  const [isUserDeleting, setIsUserDeleting] = useState(false);

  const loadUsers = async (orgId = userOrgFilter, page = usersPage, limit = usersLimit) => {
    setUsersLoading(true);
    try {
      const targetOrg = orgId === 'GLOBAL' ? undefined : orgId;
      const res: any = await AdminService.listUsers(targetOrg, page + 1, limit);
      if (res?.success) {
        setUsersList(res.data || []);
        if (res.meta) {
          setUsersTotal(res.meta.total || 0);
        }
      }
    } catch (err: any) {
      console.error('Failed to load users', err);
      showToast('Failed to load system users.', 'error');
    } finally {
      setUsersLoading(false);
    }
  };

  useEffect(() => {
    if (tabIndex === 1) {
      loadUsers(userOrgFilter, usersPage, usersLimit);
    }
  }, [tabIndex, userOrgFilter, usersPage, usersLimit]);

  const filteredUsers = useMemo(() => {
    let result = [...usersList];
    if (userSearch.trim()) {
      const q = userSearch.toLowerCase().trim();
      result = result.filter(u => 
        (u.email && u.email.toLowerCase().includes(q)) || 
        (u.phone && u.phone.toLowerCase().includes(q))
      );
    }
    if (selectedUserRole) {
      result = result.filter(u => u.role === selectedUserRole);
    }
    return result;
  }, [usersList, userSearch, selectedUserRole]);

  const handleOpenUserCreate = () => {
    setUserToEdit(null);
    setUserEmail('');
    setUserPhone('');
    setUserPassword('');
    setUserRole('EMPLOYEE');
    setUserOrgId(isSuperAdmin ? '' : (user?.organizationId || ''));
    setUserIsActive(true);
    setIsUserDialogOpen(true);
  };

  const handleOpenUserEdit = (u: any) => {
    setUserToEdit(u);
    setUserEmail(u.email || '');
    setUserPhone(u.phone || '');
    setUserPassword('');
    setUserRole(u.role || 'EMPLOYEE');
    setUserOrgId(u.organizationId || '');
    setUserIsActive(u.isActive !== false);
    setIsUserDialogOpen(true);
  };

  const handleSaveUser = async () => {
    if (!userPhone.trim() && !userEmail.trim()) {
      showToast('Either phone number or email is required.', 'error');
      return;
    }
    if (!userToEdit && !userPassword.trim()) {
      showToast('Password is required for new users.', 'error');
      return;
    }

    setIsUserSaving(true);
    try {
      if (userToEdit) {
        const payload: any = {
          email: userEmail.trim() || null,
          phone: userPhone.trim() || null,
          role: userRole,
          isActive: userIsActive,
        };
        const res = await AdminService.updateUser(userToEdit.id, payload);
        if (res) {
          showToast('User updated successfully.');
          loadUsers();
          setIsUserDialogOpen(false);
        }
      } else {
        const payload: any = {
          email: userEmail.trim() || null,
          phone: userPhone.trim() || null,
          password: userPassword,
          role: userRole,
          organizationId: isSuperAdmin ? (userOrgId || null) : (user?.organizationId || null),
        };
        const res = await AdminService.createUser(payload);
        if (res) {
          showToast('User registered successfully.');
          loadUsers();
          setIsUserDialogOpen(false);
        }
      }
    } catch (err: any) {
      console.error('Failed to save user', err);
      showToast('Failed to save user: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setIsUserSaving(false);
    }
  };

  const handleDeleteUserConfirm = async () => {
    if (!userToDelete) return;
    setIsUserDeleting(true);
    try {
      await AdminService.deactivateUser(userToDelete.id);
      showToast('User deactivated successfully.');
      loadUsers();
      setUserToDelete(null);
    } catch (err: any) {
      console.error('Failed to deactivate user', err);
      showToast('Failed to deactivate user: ' + (err.response?.data?.message || err.message), 'error');
    } finally {
      setIsUserDeleting(false);
    }
  };

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
    if (tabIndex === 2 && isSuperAdmin) {
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
      updated.splice(index, 1);
    } else {
      item.isDeleted = true;
    }
    setConfigList(updated);
    setIsConfigDirty(true);
  };

  const handleSaveConfig = async () => {
    setConfigLoading(true);
    try {
      const payload: Record<string, any> = {};
      configList.forEach((item) => {
        if (!item.isDeleted) {
          payload[item.key] = item.value;
        }
      });

      const res: any = await AdminService.updateSystemConfig(payload);
      if (res?.success) {
        showToast('System configuration saved successfully.', 'success');
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

  const [isOrgDialogOpen, setIsOrgDialogOpen] = useState(false);
  const [orgToEdit, setOrgToEdit] = useState<any | null>(null);
  const [orgNameInput, setOrgNameInput] = useState('');
  const [isOrgSaving, setIsOrgSaving] = useState(false);

  const [orgToDelete, setOrgToDelete] = useState<any | null>(null);
  const [isOrgDeleting, setIsOrgDeleting] = useState(false);

  const loadOrganizations = async (page = orgPage, limit = orgLimit) => {
    if (!isSuperAdmin) return;
    setOrgsLoading(true);
    try {
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
    if (tabIndex === 3 && isSuperAdmin) {
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
      const errMsg = typeof err === 'string' ? err : err.response?.data?.message || err.message || 'Failed to delete organization.';
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
    if (tabIndex === 4 && isSuperAdmin) {
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
    loadAuditLogs(0, logsLimit);
  };

  // ==========================================
  // TAB 5/2: Maintenance & Tools
  // ==========================================
  const [exportEntity, setExportEntity] = useState<'users' | 'employees' | 'sites'>('users');
  const [exportOrgId, setExportOrgId] = useState<string>('GLOBAL');
  const [isExporting, setIsExporting] = useState(false);

  const [autoAssignSites, setAutoAssignSites] = useState<any[]>([]);
  const [selectedAutoAssignSite, setSelectedAutoAssignSite] = useState('');
  const [autoAssignOrgId, setAutoAssignOrgId] = useState('GLOBAL');
  const [autoAssignResult, setAutoAssignResult] = useState<any | null>(null);
  const [isAutoAssignRunning, setIsAutoAssignRunning] = useState(false);

  useEffect(() => {
    if (tabIndex === (isSuperAdmin ? 5 : 2)) {
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

  const handleTabChange = (_event: React.SyntheticEvent, newIdx: number) => {
    setTabIndex(newIdx);
  };

  return (
    <Box sx={{ p: 4, minHeight: '100%', backgroundColor: theme.palette.background.default }}>
      {/* Premium Elegant Header */}
      <Paper
        elevation={0}
        sx={{
          p: 3.5,
          mb: 4,
          borderRadius: 4,
          background: `linear-gradient(135deg, ${alpha(theme.palette.background.paper, 0.9)} 0%, ${alpha(theme.palette.background.paper, 0.7)} 100%)`,
          border: `1px solid ${theme.palette.divider}`,
          boxShadow: '0 4px 20px 0 rgba(0, 0, 0, 0.02)',
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
              backgroundColor: alpha(theme.palette.primary.main, 0.08),
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
        <Tab icon={<PeopleIcon fontSize="small" />} iconPosition="start" label="User Management" />
        {isSuperAdmin && <Tab icon={<ConfigIcon fontSize="small" />} iconPosition="start" label="System Config" />}
        {isSuperAdmin && <Tab icon={<BusinessIcon fontSize="small" />} iconPosition="start" label="Organizations" />}
        {isSuperAdmin && <Tab icon={<AuditIcon fontSize="small" />} iconPosition="start" label="Audit Logs" />}
        <Tab icon={<ExportIcon fontSize="small" />} iconPosition="start" label="Maintenance & Tools" />
      </Tabs>

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
                  'Total Users',
                  stats.totalUsers,
                  <StatsIcon fontSize="medium" />,
                  'linear-gradient(135deg, #E8F0FE 0%, #C2ECFF 100%)',
                  '#174EA6',
                  'rgba(23, 78, 166, 0.1)',
                  '#174EA6'
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                {renderStatsCard(
                  'Active Users',
                  stats.activeUsers,
                  <StatsIcon fontSize="medium" />,
                  'linear-gradient(135deg, #E6F4EA 0%, #CEEAD6 100%)',
                  '#137333',
                  'rgba(19, 115, 51, 0.1)',
                  '#137333'
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                {renderStatsCard(
                  'Employees Count',
                  stats.totalEmployees,
                  <StatsIcon fontSize="medium" />,
                  'linear-gradient(135deg, #FDF4E7 0%, #FFE0B2 100%)',
                  '#B06000',
                  'rgba(176, 96, 0, 0.1)',
                  '#B06000'
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                {renderStatsCard(
                  'Total Sites',
                  stats.totalSites,
                  <StatsIcon fontSize="medium" />,
                  'linear-gradient(135deg, #FCE8E6 0%, #FAD2CF 100%)',
                  '#C5221F',
                  'rgba(197, 34, 31, 0.1)',
                  '#C5221F'
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                {renderStatsCard(
                  'Active Sites',
                  stats.activeSites,
                  <StatsIcon fontSize="medium" />,
                  'linear-gradient(135deg, #F3E5F5 0%, #E1BEE7 100%)',
                  '#6A1B9A',
                  'rgba(106, 27, 154, 0.1)',
                  '#6A1B9A'
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                {renderStatsCard(
                  'Today Attendance',
                  stats.todayAttendanceCount,
                  <StatsIcon fontSize="medium" />,
                  'linear-gradient(135deg, #E0F7FA 0%, #B2EBF2 100%)',
                  '#006064',
                  'rgba(0, 96, 100, 0.1)',
                  '#006064'
                )}
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                {renderStatsCard(
                  'Payroll Runs',
                  stats.totalPayrollRuns,
                  <StatsIcon fontSize="medium" />,
                  'linear-gradient(135deg, #E8EAF6 0%, #C5CAE9 100%)',
                  '#283593',
                  'rgba(40, 53, 147, 0.1)',
                  '#283593'
                )}
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">No statistics data available.</Alert>
          )}
        </Box>
      )}

      {/* PANEL 1: USER MANAGEMENT */}
      {tabIndex === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>
              System Users Management
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenUserCreate}
              sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 700 }}
            >
              Create User Account
            </Button>
          </Box>

          <Card sx={{ borderRadius: 4, mb: 4, border: `1px solid ${theme.palette.divider}`, boxShadow: 'none' }}>
            <CardContent sx={{ py: 2.5 }}>
              <Grid container spacing={3} sx={{ alignItems: 'center' }}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    label="Search Users"
                    placeholder="Search by Email or Phone..."
                    fullWidth
                    size="small"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    slotProps={{
                      input: {
                        startAdornment: <SearchIcon color="action" sx={{ mr: 1, fontSize: 20 }} />,
                        sx: { borderRadius: 2 }
                      }
                    }}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel id="role-filter-label">Filter by Role</InputLabel>
                    <Select
                      labelId="role-filter-label"
                      value={selectedUserRole}
                      label="Filter by Role"
                      onChange={(e) => setSelectedUserRole(e.target.value)}
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value="">All Roles</MenuItem>
                      <MenuItem value="EMPLOYEE">Employee</MenuItem>
                      <MenuItem value="SUPERVISOR">Supervisor</MenuItem>
                      <MenuItem value="ADMIN">Admin</MenuItem>
                      <MenuItem value="SUPER_ADMIN">Super Admin</MenuItem>
                      <MenuItem value="CLIENT">Client</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                {isSuperAdmin && (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="org-filter-label">Organization Scope</InputLabel>
                      <Select
                        labelId="org-filter-label"
                        value={userOrgFilter}
                        label="Organization Scope"
                        onChange={(e) => setUserOrgFilter(e.target.value)}
                        sx={{ borderRadius: 2 }}
                      >
                        <MenuItem value="GLOBAL">
                          <strong>All Tenant Organizations</strong>
                        </MenuItem>
                        {statsOrgList.map((o) => (
                          <MenuItem key={o.id} value={o.id}>
                            {o.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                )}
                <Grid size={{ xs: 12, md: isSuperAdmin ? 1 : 5 }} sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <IconButton color="primary" onClick={() => loadUsers(userOrgFilter, usersPage, usersLimit)}>
                    <RefreshIcon />
                  </IconButton>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {usersLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : filteredUsers.length === 0 ? (
            <Alert severity="info" sx={{ borderRadius: 3 }}>
              No system users found.
            </Alert>
          ) : (
            <Paper variant="outlined" sx={{ borderRadius: 4, overflow: 'hidden' }}>
              <TableContainer>
                <Table>
                  <TableHead sx={{ backgroundColor: alpha(theme.palette.primary.main, 0.05) }}>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 800 }}>User Login Credentials</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Role</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Organization</TableCell>
                      <TableCell sx={{ fontWeight: 800 }}>Status</TableCell>
                      <TableCell align="center" sx={{ fontWeight: 800, width: 140 }}>Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredUsers.map((u) => {
                      const org = statsOrgList.find(o => o.id === u.organizationId);
                      return (
                        <TableRow key={u.id} sx={{ '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.01) } }}>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {u.email || 'No Email'}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                Phone: {u.phone || '—'}
                              </Typography>
                            </Box>
                          </TableCell>
                          <TableCell>{renderRoleChip(u.role)}</TableCell>
                          <TableCell sx={{ color: 'text.secondary', fontSize: '0.85rem' }}>
                            {org ? org.name : u.organizationId ? 'Specified Tenant' : 'Platform Global'}
                          </TableCell>
                          <TableCell>
                            {u.isActive !== false ? (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'success.main', fontSize: '0.8rem', fontWeight: 700 }}>
                                <SuccessIcon fontSize="inherit" /> ACTIVE
                              </Box>
                            ) : (
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.disabled', fontSize: '0.8rem', fontWeight: 700 }}>
                                <DeactivateIcon fontSize="inherit" /> INACTIVE
                              </Box>
                            )}
                          </TableCell>
                          <TableCell align="center">
                            <Box sx={{ display: 'flex', gap: 1, justifyContent: 'center' }}>
                              <Tooltip title="Edit Profile / Role">
                                <IconButton color="info" size="small" onClick={() => handleOpenUserEdit(u)}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              {u.isActive !== false && (
                                <Tooltip title="Deactivate User">
                                  <IconButton color="error" size="small" onClick={() => setUserToDelete(u)}>
                                    <DeactivateIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              )}
                            </Box>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
              <TablePagination
                component="div"
                count={usersTotal}
                page={usersPage}
                onPageChange={(_e, newPage) => setUsersPage(newPage)}
                rowsPerPage={usersLimit}
                onRowsPerPageChange={(e) => {
                  setUsersLimit(parseInt(e.target.value, 10));
                  setUsersPage(0);
                }}
                rowsPerPageOptions={[5, 10, 25, 50]}
              />
            </Paper>
          )}

          {/* CREATE / EDIT USER DIALOG */}
          <Dialog
            open={isUserDialogOpen}
            onClose={() => !isUserSaving && setIsUserDialogOpen(false)}
            slotProps={{ paper: { sx: { borderRadius: 4, width: 480 } } }}
          >
            <DialogTitle sx={{ fontWeight: 800 }}>
              {userToEdit ? 'Edit User Credentials' : 'Register New User Account'}
            </DialogTitle>
            <DialogContent sx={{ py: 2 }}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>
                <TextField
                  label="Email Address"
                  type="email"
                  fullWidth
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
                <TextField
                  label="Phone Number"
                  placeholder="e.g. +919999999999"
                  fullWidth
                  value={userPhone}
                  onChange={(e) => setUserPhone(e.target.value)}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
                {!userToEdit && (
                  <TextField
                    label="Initial Password"
                    type="password"
                    fullWidth
                    value={userPassword}
                    onChange={(e) => setUserPassword(e.target.value)}
                    slotProps={{ input: { sx: { borderRadius: 2 } } }}
                  />
                )}
                <FormControl fullWidth size="small">
                  <InputLabel id="user-role-label">System Role</InputLabel>
                  <Select
                    labelId="user-role-label"
                    value={userRole}
                    label="System Role"
                    onChange={(e) => setUserRole(e.target.value)}
                    sx={{ borderRadius: 2 }}
                  >
                    <MenuItem value="EMPLOYEE">Employee</MenuItem>
                    <MenuItem value="SUPERVISOR">Supervisor</MenuItem>
                    <MenuItem value="ADMIN">Admin</MenuItem>
                    {isSuperAdmin && <MenuItem value="SUPER_ADMIN">Super Admin</MenuItem>}
                    <MenuItem value="CLIENT">Client</MenuItem>
                  </Select>
                </FormControl>
                {isSuperAdmin && !userToEdit && (
                  <FormControl fullWidth size="small">
                    <InputLabel id="user-org-label">Tenant Organization</InputLabel>
                    <Select
                      labelId="user-org-label"
                      value={userOrgId}
                      label="Tenant Organization"
                      onChange={(e) => setUserOrgId(e.target.value)}
                      sx={{ borderRadius: 2 }}
                    >
                      <MenuItem value=""><em>Global Scope (None)</em></MenuItem>
                      {statsOrgList.map((o) => (
                        <MenuItem key={o.id} value={o.id}>
                          {o.name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
                {userToEdit && (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={userIsActive}
                        onChange={(e) => setUserIsActive(e.target.checked)}
                      />
                    }
                    label={<Typography variant="body2" fontWeight={700}>Account Active</Typography>}
                  />
                )}
              </Box>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setIsUserDialogOpen(false)} variant="outlined" sx={{ borderRadius: 2 }}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveUser}
                variant="contained"
                color="primary"
                disabled={isUserSaving}
                sx={{ borderRadius: 2 }}
              >
                {isUserSaving ? <CircularProgress size={24} /> : userToEdit ? 'Save Changes' : 'Create Account'}
              </Button>
            </DialogActions>
          </Dialog>

          {/* CONFIRM DEACTIVATE DIALOG */}
          <Dialog
            open={!!userToDelete}
            onClose={() => setUserToDelete(null)}
            slotProps={{ paper: { sx: { borderRadius: 4, width: 400 } } }}
          >
            <DialogTitle sx={{ fontWeight: 800 }}>Deactivate Account</DialogTitle>
            <DialogContent>
              <Typography variant="body1">
                Are you sure you want to deactivate the user account <strong>{userToDelete?.email || userToDelete?.phone}</strong>?
              </Typography>
              <Typography variant="body2" color="error" sx={{ mt: 2, fontWeight: 600 }}>
                This will soft-delete the user's login access.
              </Typography>
            </DialogContent>
            <DialogActions sx={{ p: 3 }}>
              <Button onClick={() => setUserToDelete(null)} variant="outlined" sx={{ borderRadius: 2 }}>
                Cancel
              </Button>
              <Button
                onClick={handleDeleteUserConfirm}
                variant="contained"
                color="error"
                disabled={isUserDeleting}
                sx={{ borderRadius: 2 }}
              >
                {isUserDeleting ? <CircularProgress size={24} /> : 'Deactivate Account'}
              </Button>
            </DialogActions>
          </Dialog>
        </Box>
      )}

      {/* PANEL 2: SYSTEM CONFIGURATION (SUPER_ADMIN ONLY) */}
      {tabIndex === 2 && isSuperAdmin && (
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

      {/* PANEL 3: ORGANIZATIONS MANAGEMENT (SUPER_ADMIN ONLY) */}
      {tabIndex === 3 && isSuperAdmin && (
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

      {/* PANEL 4: AUDIT LOGS (SUPER_ADMIN ONLY) */}
      {tabIndex === 4 && isSuperAdmin && (
        <Box>
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

      {/* PANEL 5/2: MAINTENANCE & DATA TOOLS (ALL ADMINS) */}
      {(tabIndex === (isSuperAdmin ? 5 : 2)) && (
        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card sx={{ borderRadius: 4, height: '100%', border: `1px solid ${theme.palette.divider}`, boxShadow: 'none' }}>
              <CardContent sx={{ p: 4, display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between' }}>
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
