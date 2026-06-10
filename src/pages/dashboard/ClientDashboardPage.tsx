import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  useTheme,
  alpha,
} from '@mui/material';
import {
  People as PeopleIcon,
  EventNote as AttendanceIcon,
  LocationOn as LocationIcon,
  TrendingUp as TrendingIcon,
} from '@mui/icons-material';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

import { SiteService } from '../../api/site.service';
import { EmployeeService } from '../../api/employee.service';
import { AttendanceService } from '../../api/attendance.service';

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
  
  const map = new Map<string, any>();

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

  map.forEach((record) => {
    if (record.checkInTime && record.checkOutTime) {
      const diffMs = record.checkOutTime.getTime() - record.checkInTime.getTime();
      if (diffMs > 0) {
        const diffHrs = diffMs / (1000 * 60 * 60);
        record.workHours = Math.round(diffHrs * 10) / 10;
      }
    }
  });

  return Array.from(map.values());
};

export default function ClientDashboardPage() {
  const theme = useTheme();
  const [selectedSiteId, setSelectedSiteId] = useState<string>('all');

  // Fetch Sites
  const { data: sitesResponse, isLoading: sitesLoading } = useQuery({
    queryKey: ['client-sites'],
    queryFn: () => SiteService.getSites(1, 100),
  });

  const sites = sitesResponse?.data?.data || [];

  // Fetch Employees
  const { data: employeesResponse, isLoading: employeesLoading } = useQuery({
    queryKey: ['client-employees'],
    queryFn: () => EmployeeService.getEmployees(),
  });

  const allEmployees = employeesResponse?.data?.data || [];
  
  const filteredEmployees = useMemo(() => {
    if (selectedSiteId === 'all') return allEmployees;
    return allEmployees.filter((emp: any) => emp.siteId === selectedSiteId);
  }, [allEmployees, selectedSiteId]);

  // Fetch Attendance for today (all sites or specific site)
  const { data: attendanceResponse, isLoading: attendanceLoading } = useQuery({
    queryKey: ['client-attendance', selectedSiteId],
    queryFn: () => AttendanceService.getTodayAttendance(selectedSiteId !== 'all' ? selectedSiteId : undefined),
  });

  const rawLogs = Array.isArray(attendanceResponse) ? attendanceResponse : [];
  const attendanceRecords = useMemo(() => consolidateAttendance(rawLogs), [rawLogs]);

  // Derived Stats
  const totalEmployees = filteredEmployees.length;
  const activeEmployees = filteredEmployees.filter((e: any) => e.isActive).length;
  const todayPresent = attendanceRecords.length;

  // Mock Chart Data for aesthetic purposes (can be wired to actual historical data later)
  const chartData = [
    { time: '08:00', present: Math.floor(todayPresent * 0.2) },
    { time: '10:00', present: Math.floor(todayPresent * 0.8) },
    { time: '12:00', present: todayPresent },
    { time: '14:00', present: todayPresent },
    { time: '16:00', present: Math.floor(todayPresent * 0.9) },
    { time: '18:00', present: Math.floor(todayPresent * 0.3) },
  ];

  if (sitesLoading || employeesLoading || attendanceLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)' }}>
        <CircularProgress size={60} thickness={4} sx={{ color: theme.palette.primary.main }} />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 2, md: 4 }, minHeight: '100vh', background: 'linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%)' }}>
      {/* Header & Site Selector */}
      <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, justifyContent: 'space-between', alignItems: { md: 'center' }, mb: 5, gap: 2 }}>
        <Box>
          <Typography variant="h3" sx={{ fontWeight: 800, background: '-webkit-linear-gradient(45deg, #1a237e 30%, #3949ab 90%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>
            Client Dashboard
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" sx={{ mt: 0.5, fontWeight: 500 }}>
            Real-time workforce insights across your sites
          </Typography>
        </Box>

        <FormControl sx={{ minWidth: 280, background: '#fff', borderRadius: 2, boxShadow: '0 4px 20px rgba(0,0,0,0.05)' }}>
          <InputLabel id="site-select-label" sx={{ fontWeight: 600 }}>Select Site</InputLabel>
          <Select
            labelId="site-select-label"
            value={selectedSiteId}
            label="Select Site"
            onChange={(e) => setSelectedSiteId(e.target.value)}
            sx={{
              borderRadius: 2,
              '& .MuiOutlinedInput-notchedOutline': { borderColor: 'transparent' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: alpha(theme.palette.primary.main, 0.2) },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: theme.palette.primary.main },
            }}
          >
            <MenuItem value="all" sx={{ fontWeight: 600 }}>All My Sites</MenuItem>
            {sites.map((site: any) => (
              <MenuItem key={site.id} value={site.id}>{site.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={4} sx={{ mb: 5 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Total Employees"
            value={totalEmployees}
            icon={<PeopleIcon sx={{ fontSize: 32 }} />}
            color="#3949ab"
            gradient="linear-gradient(135deg, #3949ab 0%, #1a237e 100%)"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Workforce"
            value={activeEmployees}
            icon={<TrendingIcon sx={{ fontSize: 32 }} />}
            color="#00897b"
            gradient="linear-gradient(135deg, #00897b 0%, #004d40 100%)"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Today's Present"
            value={todayPresent}
            icon={<AttendanceIcon sx={{ fontSize: 32 }} />}
            color="#f4511e"
            gradient="linear-gradient(135deg, #f4511e 0%, #bf360c 100%)"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            title="Active Sites"
            value={selectedSiteId === 'all' ? sites.length : 1}
            icon={<LocationIcon sx={{ fontSize: 32 }} />}
            color="#8e24aa"
            gradient="linear-gradient(135deg, #8e24aa 0%, #4a148c 100%)"
          />
        </Grid>
      </Grid>

      {/* Chart & Live Attendance Grid */}
      <Grid container spacing={4}>
        {/* Attendance Trend Chart */}
        <Grid item xs={12} lg={7}>
          <Card sx={{ borderRadius: 4, boxShadow: '0 10px 40px rgba(0,0,0,0.04)', height: '100%', overflow: 'hidden' }}>
            <CardContent sx={{ p: 4 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: '#2c3e50' }}>
                Attendance Trend (Today)
              </Typography>
              <Box sx={{ height: 320 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorPresent" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.3}/>
                        <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e0e0e0" />
                    <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#7f8c8d' }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: '#7f8c8d' }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                      cursor={{ stroke: alpha(theme.palette.primary.main, 0.2), strokeWidth: 2 }}
                    />
                    <Area type="monotone" dataKey="present" stroke={theme.palette.primary.main} strokeWidth={4} fillOpacity={1} fill="url(#colorPresent)" />
                  </AreaChart>
                </ResponsiveContainer>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Live Attendance Feed */}
        <Grid item xs={12} lg={5}>
          <Card sx={{ borderRadius: 4, boxShadow: '0 10px 40px rgba(0,0,0,0.04)', height: '100%' }}>
            <CardContent sx={{ p: 0 }}>
              <Box sx={{ p: 3, borderBottom: '1px solid', borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" sx={{ fontWeight: 700, color: '#2c3e50' }}>
                  Live Attendance Feed
                </Typography>
                <Chip label={`${attendanceRecords.length} Active`} color="success" size="small" sx={{ fontWeight: 600, borderRadius: 2 }} />
              </Box>
              
              <Box sx={{ maxHeight: 400, overflowY: 'auto', p: 2 }}>
                {attendanceRecords.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 5 }}>
                    <Typography color="text.secondary" sx={{ fontWeight: 500 }}>No attendance records found for today.</Typography>
                  </Box>
                ) : (
                  <Grid container spacing={2}>
                    {attendanceRecords.map((record: any) => (
                      <Grid item xs={12} key={record.id}>
                        <Paper sx={{ p: 2, borderRadius: 3, border: '1px solid', borderColor: alpha('#bdc3c7', 0.3), display: 'flex', alignItems: 'center', gap: 2, transition: 'transform 0.2s, box-shadow 0.2s', '&:hover': { transform: 'translateY(-2px)', boxShadow: '0 6px 15px rgba(0,0,0,0.05)' } }}>
                          <Avatar sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: theme.palette.primary.main, width: 48, height: 48, fontWeight: 700 }}>
                            {record.employeeName.charAt(0)}
                          </Avatar>
                          <Box sx={{ flexGrow: 1 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#2c3e50' }}>{record.employeeName}</Typography>
                            <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                              <Typography variant="caption" sx={{ color: '#27ae60', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#27ae60' }} /> IN: {record.checkIn}
                              </Typography>
                              {record.checkOut !== '—' && (
                                <Typography variant="caption" sx={{ color: '#e74c3c', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                  <Box component="span" sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: '#e74c3c' }} /> OUT: {record.checkOut}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </Paper>
                      </Grid>
                    ))}
                  </Grid>
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

// Helper Component for Stats
function StatCard({ title, value, icon, color, gradient }: { title: string, value: string | number, icon: React.ReactNode, color: string, gradient: string }) {
  return (
    <Card sx={{ 
      borderRadius: 4, 
      color: '#fff',
      background: gradient,
      boxShadow: `0 12px 30px ${alpha(color, 0.3)}`,
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.3s, box-shadow 0.3s',
      '&:hover': {
        transform: 'translateY(-5px)',
        boxShadow: `0 15px 40px ${alpha(color, 0.4)}`,
      }
    }}>
      <Box sx={{ position: 'absolute', top: -20, right: -20, opacity: 0.1, transform: 'scale(2)' }}>
        {icon}
      </Box>
      <CardContent sx={{ p: 4, position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600, opacity: 0.9, letterSpacing: '0.5px' }}>
            {title}
          </Typography>
          <Box sx={{ p: 1, borderRadius: 2, background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(10px)' }}>
            {icon}
          </Box>
        </Box>
        <Typography variant="h3" sx={{ fontWeight: 800 }}>
          {value}
        </Typography>
      </CardContent>
    </Card>
  );
}
