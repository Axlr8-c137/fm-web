import React from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Avatar,
  Box,
  Menu,
  MenuItem,
  Tooltip,
  Divider,
  ListItemIcon
} from '@mui/material';
import {
  Menu as MenuIcon,
  Brightness4 as DarkIcon,
  Brightness7 as LightIcon,
  Notifications as NotificationsIcon,
  Logout as LogoutIcon,
  AccountCircle as AccountIcon
} from '@mui/icons-material';
import { useThemeStore } from '../../stores/themeStore';
import { useAuthStore } from '../../stores/auth.store';
import { useNavigate } from 'react-router-dom';

function stringToColor(string: string) {
  let hash = 0;
  for (let i = 0; i < string.length; i += 1) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }
  let color = '#';
  for (let i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.slice(-2);
  }
  return color;
}

function stringAvatar(name: string) {
  if (!name || name.trim() === '') {
    return { children: <AccountIcon />, sx: { width: 32, height: 32 } };
  }
  
  const parts = name.trim().split(' ').filter(Boolean);
  let initials = '';
  if (parts.length === 1) {
    initials = parts[0][0].toUpperCase();
  } else {
    initials = `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }
  
  return {
    sx: {
      bgcolor: stringToColor(name),
      width: 32,
      height: 32,
      fontSize: '0.875rem',
      fontWeight: 600,
    },
    children: initials,
  };
}

interface HeaderProps {
  onDrawerToggle: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onDrawerToggle }) => {
  const mode = useThemeStore((state) => state.mode);
  const toggleMode = useThemeStore((state) => state.toggleMode);
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();

  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);

  const handleMenu = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    handleClose();
    await logout();
    navigate('/login');
  };

  return (
    <AppBar
      position="fixed"
      sx={{
        zIndex: (theme) => theme.zIndex.drawer + 1,
        elevation: 0,
      }}
    >
      <Toolbar>
        <IconButton
          color="inherit"
          aria-label="open drawer"
          edge="start"
          onClick={onDrawerToggle}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>
        
        <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
          Facility Management
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title={`Switch to ${mode === 'light' ? 'dark' : 'light'} mode`}>
            <IconButton color="inherit" onClick={toggleMode}>
              {mode === 'light' ? <DarkIcon /> : <LightIcon />}
            </IconButton>
          </Tooltip>

          <IconButton color="inherit">
            <NotificationsIcon />
          </IconButton>

          <Box sx={{ ml: 1 }}>
            <Tooltip title="Account settings">
              <IconButton onClick={handleMenu} sx={{ p: 0 }}>
                {user?.name ? (
                  <Avatar {...stringAvatar(user.name)} />
                ) : (
                  <Avatar sx={{ width: 32, height: 32 }}>
                    <AccountIcon />
                  </Avatar>
                )}
              </IconButton>
            </Tooltip>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
              transformOrigin={{ horizontal: 'right', vertical: 'top' }}
              anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            >
              <MenuItem onClick={() => { handleClose(); navigate('/profile'); }}>Profile</MenuItem>
              <MenuItem onClick={() => { handleClose(); navigate('/profile'); }}>My Account</MenuItem>
              <Divider sx={{ my: 1 }} />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon fontSize="small" />
                </ListItemIcon>
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Box>
      </Toolbar>
    </AppBar>
  );
};
