import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Paper,
  Tabs,
  Tab,
  Grid,
  Chip,
  Button,
  IconButton,
  Divider,
  alpha,
  useTheme,
} from '@mui/material';
import {
  ArrowBack as BackIcon,
  Edit as EditIcon,
  LocationOn as LocationIcon,
  People as PeopleIcon,
  History as HistoryIcon,
  Layers as GeofenceIcon,
} from '@mui/icons-material';
import { SiteService } from '../../api/site.service';
import { LoadingScreen } from '../../components/common/LoadingScreen';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function CustomTabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`site-tabpanel-${index}`}
      aria-labelledby={`site-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ py: 3 }}>{children}</Box>}
    </div>
  );
}

export default function SiteDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const theme = useTheme();
  const [tabValue, setTabValue] = useState(0);

  const { data, isLoading } = useQuery({
    queryKey: ['site', id],
    queryFn: () => SiteService.getSiteById(id!),
    enabled: !!id,
  });

  if (isLoading) return <LoadingScreen />;

  const site = data?.data?.data;

  if (!site) {
    return (
      <Box sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5">Site not found</Typography>
        <Button onClick={() => navigate('/sites')} startIcon={<BackIcon />}>
          Back to Sites
        </Button>
      </Box>
    );
  }

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <IconButton onClick={() => navigate('/sites')} sx={{ backgroundColor: theme.palette.background.paper }}>
          <BackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="h4" fontWeight={800}>
              {site.name}
            </Typography>
            <Chip 
              label={site.status} 
              color={site.status === 'ACTIVE' ? 'success' : 'default'}
              size="small"
              sx={{ fontWeight: 700 }}
            />
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
            <LocationIcon fontSize="small" color="action" />
            <Typography variant="body2" color="text.secondary">
              {site.address}
            </Typography>
          </Box>
        </Box>
        <Button
          variant="outlined"
          startIcon={<EditIcon />}
          sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
        >
          Edit Site
        </Button>
      </Box>

      {/* Main Content */}
      <Paper 
        elevation={0} 
        sx={{ 
          borderRadius: 4, 
          border: `1px solid ${theme.palette.divider}`,
          overflow: 'hidden'
        }}
      >
        <Box sx={{ borderBottom: 1, borderColor: 'divider', px: 3, pt: 1 }}>
          <Tabs 
            value={tabValue} 
            onChange={handleTabChange}
            sx={{
              '& .MuiTab-root': {
                textTransform: 'none',
                fontWeight: 600,
                minWidth: 120,
                fontSize: '0.95rem',
              }
            }}
          >
            <Tab label="Overview" />
            <Tab label="Geofence" />
            <Tab label="Employees" />
            <Tab label="Recent Updates" />
          </Tabs>
        </Box>

        <Box sx={{ px: 3, pb: 2 }}>
          <CustomTabPanel value={tabValue} index={0}>
            <Grid container spacing={4}>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Site Information
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      SUPERVISOR
                    </Typography>
                    <Typography variant="body1">{site.supervisorName || 'Not Assigned'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      CLIENT
                    </Typography>
                    <Typography variant="body1">{site.clientName || 'N/A'}</Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight={600}>
                      CONTACT
                    </Typography>
                    <Typography variant="body1">{site.managerEmail || 'No email provided'}</Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} md={6}>
                <Typography variant="h6" fontWeight={700} gutterBottom>
                  Key Metrics
                </Typography>
                <Grid container spacing={2} sx={{ mt: 1 }}>
                  {[
                    { label: 'Total Employees', value: site.employeeCount || 0, icon: <PeopleIcon color="primary" /> },
                    { label: 'Today Attendance', value: '85%', icon: <HistoryIcon color="success" /> },
                    { label: 'Geofence Status', value: 'Active', icon: <GeofenceIcon color="info" /> },
                  ].map((stat, i) => (
                    <Grid item xs={6} key={i}>
                      <Paper
                        variant="outlined"
                        sx={{
                          p: 2,
                          borderRadius: 3,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 2,
                          backgroundColor: alpha(theme.palette.primary.main, 0.02),
                        }}
                      >
                        <Box sx={{ p: 1, borderRadius: 2, backgroundColor: alpha(theme.palette.background.paper, 0.8), display: 'flex' }}>
                          {stat.icon}
                        </Box>
                        <Box>
                          <Typography variant="h6" fontWeight={700}>{stat.value}</Typography>
                          <Typography variant="caption" color="text.secondary">{stat.label}</Typography>
                        </Box>
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </Grid>
            </Grid>
          </CustomTabPanel>

          <CustomTabPanel value={tabValue} index={1}>
            <Box 
              sx={{ 
                height: 400, 
                backgroundColor: alpha(theme.palette.primary.main, 0.05),
                borderRadius: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                border: `2px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
              }}
            >
              <LocationIcon sx={{ fontSize: 48, color: alpha(theme.palette.primary.main, 0.4), mb: 2 }} />
              <Typography variant="h6" color="text.secondary">
                Map View Coming Soon
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Leaflet integration in Phase 4
              </Typography>
            </Box>
          </CustomTabPanel>

          <CustomTabPanel value={tabValue} index={2}>
             <Typography variant="body1" color="text.secondary">
                Employee list for this site will be displayed here.
              </Typography>
          </CustomTabPanel>

          <CustomTabPanel value={tabValue} index={3}>
             <Typography variant="body1" color="text.secondary">
                Activity logs and site updates will be displayed here.
              </Typography>
          </CustomTabPanel>
        </Box>
      </Paper>
    </Box>
  );
}
