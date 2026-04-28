import React from 'react';
import { Box, Typography, Button, Paper, alpha, useTheme } from '@mui/material';
import { GppBad as ForbiddenIcon, Logout as LogoutIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth.store';

export default function ForbiddenPage() {
  const theme = useTheme();
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          p: 6,
          maxWidth: 500,
          textAlign: 'center',
          borderRadius: 6,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        <Box
          sx={{
            width: 80,
            height: 80,
            borderRadius: '50%',
            backgroundColor: alpha(theme.palette.error.main, 0.1),
            color: theme.palette.error.main,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            mx: 'auto',
            mb: 3,
          }}
        >
          <ForbiddenIcon sx={{ fontSize: 48 }} />
        </Box>
        
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Access Denied
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          You don't have the required permissions to view this page. This section is restricted to Admin and Super Admin roles only.
        </Typography>

        <Box sx={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="contained"
            color="error"
            startIcon={<LogoutIcon />}
            onClick={handleLogout}
            sx={{ 
              borderRadius: 2.5, 
              px: 5, 
              py: 1.5,
              fontWeight: 700,
              textTransform: 'none',
              boxShadow: theme.shadows[4],
              '&:hover': {
                backgroundColor: theme.palette.error.dark,
              }
            }}
          >
            Logout from Portal
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
