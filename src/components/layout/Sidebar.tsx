import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Divider,
  Box,
  Typography
} from '@mui/material';
import {
  Dashboard as DashboardIcon,
  People as PeopleIcon,
  LocationOn as LocationIcon,
  EventNote as AttendanceIcon,
  Payments as PayrollIcon,
  AdminPanelSettings as AdminIcon,
  Map as OpsIcon,
  Business as BusinessIcon
} from '@mui/icons-material';

const drawerWidth = 260;

interface SidebarProps {
  open: boolean;
  onClose?: () => void;
  variant?: 'permanent' | 'persistent' | 'temporary';
}

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/dashboard', roles: ['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR', 'PAYROLL_ADMIN', 'EMPLOYEE'] },
  { text: 'Employees', icon: <PeopleIcon />, path: '/employees', roles: ['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR'] },
  { text: 'Sites', icon: <LocationIcon />, path: '/sites', roles: ['ADMIN', 'SUPER_ADMIN'] },
  { text: 'Attendance', icon: <AttendanceIcon />, path: '/attendance', roles: ['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR'] },
  { text: 'Operations', icon: <OpsIcon />, path: '/ops', roles: ['ADMIN', 'SUPER_ADMIN', 'SUPERVISOR'] },
  { text: 'Payroll', icon: <PayrollIcon />, path: '/payroll', roles: ['ADMIN', 'SUPER_ADMIN', 'PAYROLL_ADMIN'] },
  { text: 'Admin', icon: <AdminIcon />, path: '/admin', roles: ['ADMIN', 'SUPER_ADMIN'] },
];

export const Sidebar: React.FC<SidebarProps> = ({ open, onClose, variant = 'permanent' }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();

  const filteredItems = menuItems.filter(item => user && item.roles.includes(user.role));

  const drawerContent = (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Toolbar sx={{ px: [1, 2], display: 'flex', alignItems: 'center', gap: 1 }}>
        <BusinessIcon color="primary" />
        <Typography variant="h6" color="primary" noWrap sx={{ fontWeight: 700 }}>
          FM PORTAL
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ flexGrow: 1, px: 1 }}>
        {filteredItems.map((item) => {
          const isActive = location.pathname.startsWith(item.path);
          return (
            <ListItem key={item.text} disablePadding sx={{ display: 'block', mb: 0.5 }}>
              <ListItemButton
                onClick={() => {
                  navigate(item.path);
                  if (onClose) onClose();
                }}
                selected={isActive}
                sx={(theme) => ({
                  minHeight: 48,
                  justifyContent: open ? 'initial' : 'center',
                  px: 2.5,
                  borderRadius: 2,
                  '&.Mui-selected': {
                    backgroundColor: 'primary.light',
                    color: theme.palette.mode === 'light' ? 'primary.main' : '#000000',
                    '& .MuiListItemIcon-root': {
                      color: theme.palette.mode === 'light' ? 'primary.main' : '#000000',
                    },
                    '&:hover': {
                      backgroundColor: 'primary.light',
                    }
                  },
                })}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open ? 3 : 'auto',
                    justifyContent: 'center',
                  }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.text} sx={{ opacity: open ? 1 : 0 }} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Divider />
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          v1.0.0
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Drawer
      variant={variant}
      open={open}
      onClose={onClose}
      sx={{
        width: open ? drawerWidth : 0,
        flexShrink: 0,
        transition: (theme) => theme.transitions.create('width', {
          easing: theme.transitions.easing.sharp,
          duration: open ? theme.transitions.duration.enteringScreen : theme.transitions.duration.leavingScreen,
        }),
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          borderRight: '1px solid',
          borderColor: 'divider',
          boxShadow: 'none',
        },
      }}
    >
      {drawerContent}
    </Drawer>
  );
};
