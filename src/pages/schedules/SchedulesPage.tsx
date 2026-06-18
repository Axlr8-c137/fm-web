import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Typography as MuiTypography,
  Grid,
  Paper,
  Button,
  TextField,
  MenuItem,
  CircularProgress,
  Chip,
  IconButton,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  Checkbox,
  FormControlLabel,
  FormGroup,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  alpha,
  useTheme,
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
  ChevronLeft as PrevIcon,
  ChevronRight as NextIcon,
  Today as TodayIcon,
  Schedule as ScheduleIcon,
  People as RosterIcon,
  AssignmentTurnedIn as AssignedIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

import { useAuthStore } from '../../stores/auth.store';
import { SiteService } from '../../api/site.service';
import { EmployeeService } from '../../api/employee.service';
import { ShiftService } from '../../api/shift.service';
import type { Shift, ScheduleResponseDto, RecurrenceType } from '../../types/shift';
import type { Employee } from '../../types/employee';

const Typography = MuiTypography as any;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAYS_OF_WEEK_MAP = [
  { label: 'Monday', value: 1 },
  { label: 'Tuesday', value: 2 },
  { label: 'Wednesday', value: 3 },
  { label: 'Thursday', value: 4 },
  { label: 'Friday', value: 5 },
  { label: 'Saturday', value: 6 },
  { label: 'Sunday', value: 7 },
];

const formatTimeTo12Hour = (timeStr: string | null | undefined): string => {
  if (!timeStr) return '—';
  try {
    const parts = timeStr.split(':');
    if (parts.length < 2) return timeStr;
    let hours = parseInt(parts[0], 10);
    const minutes = parts[1];
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const formattedHours = hours < 10 ? `0${hours}` : hours;
    return `${formattedHours}:${minutes} ${ampm}`;
  } catch (e) {
    return timeStr;
  }
};

export default function SchedulesPage() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';
  const isSupervisor = user?.role === 'SUPERVISOR';
  const isEmployee = user?.role === 'EMPLOYEE';

  // Calendar State
  const [currentMonth, setCurrentMonth] = useState<Date>(new Date());
  const [selectedSiteId, setSelectedSiteId] = useState<string>('');
  
  // Dialog States
  const [isShiftTemplateDialogOpen, setIsShiftTemplateDialogOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [shiftName, setShiftName] = useState('');
  const [shiftStartTime, setShiftStartTime] = useState('09:00');
  const [shiftEndTime, setShiftEndTime] = useState('17:00');

  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [assignEmployeeId, setAssignEmployeeId] = useState('');
  const [assignShiftId, setAssignShiftId] = useState('');
  const [assignDate, setAssignDate] = useState<string>('');
  
  // Bulk Assignment States
  const [isBulk, setIsBulk] = useState(false);
  const [bulkStartDate, setBulkStartDate] = useState('');
  const [bulkEndDate, setBulkEndDate] = useState('');
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('DAILY');
  const [selectedDaysOfWeek, setSelectedDaysOfWeek] = useState<number[]>([]);
  const [selectedWeeksOfMonth, setSelectedWeeksOfMonth] = useState<number[]>([]);

  // Details Dialog State
  const [selectedDayAssignments, setSelectedDayAssignments] = useState<ScheduleResponseDto[]>([]);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  // Date Strings for Schedule queries
  const startDateStr = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const endDateStr = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  // --- React Queries ---

  // 1. Fetch sites (Admins and Supervisors only)
  const { data: sitesRes, isLoading: sitesLoading } = useQuery({
    queryKey: ['schedules-sites'],
    queryFn: () => SiteService.getSites(1, 100),
    enabled: isAdmin || isSupervisor,
  });
  const sites = useMemo(() => sitesRes?.data || [], [sitesRes]);

  // Set default active site
  useEffect(() => {
    if (sites.length > 0 && !selectedSiteId) {
      setSelectedSiteId(sites[0].id);
    }
  }, [sites, selectedSiteId]);

  // 2. Fetch all employees to filter by site in memory
  const { data: employeesRes, isLoading: employeesLoading } = useQuery({
    queryKey: ['schedules-employees'],
    queryFn: () => EmployeeService.getEmployees(true),
    enabled: isAdmin || isSupervisor,
  });
  const allEmployees = useMemo(() => (employeesRes as any)?.data || [], [employeesRes]);
  
  // Filter employees belonging to the selected site
  const siteEmployees = useMemo(() => {
    if (!selectedSiteId) return [];
    return allEmployees.filter((emp: Employee) => emp.siteId === selectedSiteId);
  }, [allEmployees, selectedSiteId]);

  // 3. Fetch shift templates for the selected site
  const { data: shiftsRes, isLoading: shiftsLoading, refetch: refetchShifts } = useQuery({
    queryKey: ['shifts-templates', selectedSiteId],
    queryFn: () => ShiftService.listShifts(selectedSiteId),
    enabled: !!selectedSiteId && (isAdmin || isSupervisor),
  });
  const shifts = useMemo(() => (shiftsRes as any)?.data || [], [shiftsRes]);

  // 4. Fetch schedule assignments
  const { data: scheduleAssignments, isLoading: scheduleLoading, refetch: refetchSchedule } = useQuery({
    queryKey: ['schedule-assignments', selectedSiteId, startDateStr, endDateStr, allEmployees],
    queryFn: async () => {
      if (isEmployee) {
        // Employees load their own schedule
        const res = await ShiftService.getSchedule({ startDate: startDateStr, endDate: endDateStr });
        return res || [];
      }

      if (!selectedSiteId) return [];

      if (isAdmin) {
        // Admins can query all assignments and filter by siteId
        const res = await ShiftService.getSchedule({ startDate: startDateStr, endDate: endDateStr, all: true });
        const data = res || [];
        return data.filter((assignment: any) => assignment.siteId === selectedSiteId);
      }

      if (isSupervisor) {
        // Supervisors fetch schedules in parallel for all employees assigned to the site
        if (siteEmployees.length === 0) return [];
        const promises = siteEmployees.map((emp: any) => 
          ShiftService.getSchedule({ startDate: startDateStr, endDate: endDateStr, employeeId: emp.id })
            .then(res => res || [])
            .catch(() => [])
        );
        const results = await Promise.all(promises);
        return results.flat();
      }

      return [];
    },
    enabled: isEmployee ? (!!startDateStr && !!endDateStr) : (!!selectedSiteId && (isAdmin || (isSupervisor && allEmployees.length > 0))),
  });

  // --- React Mutations ---

  // Create/Update Shift Template Mutation
  const saveShiftTemplateMutation = useMutation({
    mutationFn: (data: { id?: string; name: string; startTime: string; endTime: string }) => {
      const startTimeWithSec = data.startTime.length === 5 ? `${data.startTime}:00` : data.startTime;
      const endTimeWithSec = data.endTime.length === 5 ? `${data.endTime}:00` : data.endTime;
      
      if (data.id) {
        return ShiftService.updateShift(data.id, {
          name: data.name,
          startTime: startTimeWithSec,
          endTime: endTimeWithSec,
        });
      } else {
        return ShiftService.createShift({
          siteId: selectedSiteId,
          name: data.name,
          startTime: startTimeWithSec,
          endTime: endTimeWithSec,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts-templates', selectedSiteId] });
      setIsShiftTemplateDialogOpen(false);
      resetShiftForm();
    },
    onError: (err: any) => {
      alert('Failed to save shift template: ' + (err?.message || 'Error occurred'));
    }
  });

  // Delete Shift Template Mutation
  const deleteShiftTemplateMutation = useMutation({
    mutationFn: (id: string) => ShiftService.deleteShift(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shifts-templates', selectedSiteId] });
    },
    onError: (err: any) => {
      alert(err?.message || 'Cannot delete shift template with active assignments.');
    }
  });

  // Assign Shift Mutation (Single or Bulk)
  const assignShiftMutation = useMutation({
    mutationFn: () => {
      if (isBulk) {
        return ShiftService.assignBulkShifts({
          employeeId: assignEmployeeId,
          shiftId: assignShiftId,
          startDate: bulkStartDate,
          endDate: bulkEndDate,
          recurrenceType,
          daysOfWeek: recurrenceType === 'WEEKLY' || recurrenceType === 'MONTHLY' ? selectedDaysOfWeek : undefined,
          weeksOfMonth: recurrenceType === 'MONTHLY' ? selectedWeeksOfMonth : undefined,
        });
      } else {
        return ShiftService.assignEmployee({
          employeeId: assignEmployeeId,
          shiftId: assignShiftId,
          date: assignDate,
        });
      }
    },
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['schedule-assignments', selectedSiteId] });
      setIsAssignDialogOpen(false);
      resetAssignForm();
      
      // If bulk, show results summary
      if (isBulk && res?.data) {
        const payload = res.data;
        alert(`Bulk Shift Assignment Complete:\n- Successfully scheduled: ${payload.successCount} shifts\n- Skipped conflicts: ${payload.conflictCount} dates`);
      }
    },
    onError: (err: any) => {
      alert('Assignment failed: ' + (err?.message || 'Check for duplicate bookings or conflicts.'));
    }
  });

  // Delete Assignment Mutation
  const unassignMutation = useMutation({
    mutationFn: (assignmentId: string) => ShiftService.unassignEmployee(assignmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-assignments', selectedSiteId] });
      setIsDetailsDialogOpen(false);
    },
    onError: (err: any) => {
      alert('Failed to unassign: ' + (err?.message || 'Error occurred'));
    }
  });

  // --- Calendar Layout Calculations ---

  const calendarDays = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    
    // Day of the week of first day (0 = Sunday)
    const startDayOfWeek = start.getDay();
    
    // Days in current month
    const days = eachDayOfInterval({ start, end });
    
    // Prepend padding days from the previous month to align with Sunday start
    const paddingStart = [];
    if (startDayOfWeek > 0) {
      const prevMonthEnd = endOfMonth(subMonths(currentMonth, 1));
      for (let i = startDayOfWeek - 1; i >= 0; i--) {
        paddingStart.push(new Date(prevMonthEnd.getFullYear(), prevMonthEnd.getMonth(), prevMonthEnd.getDate() - i));
      }
    }
    
    // Append padding days from next month to complete standard 42 grid (6 rows of 7 days)
    const paddingEnd = [];
    const totalDaysSoFar = paddingStart.length + days.length;
    const remaining = 42 - totalDaysSoFar;
    for (let i = 1; i <= remaining; i++) {
      paddingEnd.push(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, i));
    }
    
    return [...paddingStart, ...days, ...paddingEnd];
  }, [currentMonth]);

  // Map assignments to calendar days
  const assignmentsByDay = useMemo(() => {
    const map: Record<string, ScheduleResponseDto[]> = {};
    if (!scheduleAssignments) return map;
    
    scheduleAssignments.forEach((assignment: ScheduleResponseDto) => {
      const key = assignment.date;
      if (!map[key]) {
        map[key] = [];
      }
      map[key].push(assignment);
    });
    return map;
  }, [scheduleAssignments]);

  // --- Handlers & Helpers ---

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleCurrentMonth = () => setCurrentMonth(new Date());

  const resetShiftForm = () => {
    setEditingShift(null);
    setShiftName('');
    setShiftStartTime('09:00');
    setShiftEndTime('17:00');
  };

  const resetAssignForm = () => {
    setAssignEmployeeId('');
    setAssignShiftId('');
    setAssignDate('');
    setIsBulk(false);
    setBulkStartDate('');
    setBulkEndDate('');
    setRecurrenceType('DAILY');
    setSelectedDaysOfWeek([]);
    setSelectedWeeksOfMonth([]);
  };

  const handleOpenEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setShiftName(shift.name);
    // truncate startTime and endTime to HH:mm
    setShiftStartTime(shift.startTime.substring(0, 5));
    setShiftEndTime(shift.endTime.substring(0, 5));
    setIsShiftTemplateDialogOpen(true);
  };

  const handleOpenAssignForDay = (date: Date) => {
    if (!isAdmin) return; // Only Admin can assign
    resetAssignForm();
    const formattedDate = format(date, 'yyyy-MM-dd');
    setAssignDate(formattedDate);
    setBulkStartDate(formattedDate);
    // Pre-populate with next day or week for bulk end date
    setBulkEndDate(formattedDate);
    setIsAssignDialogOpen(true);
  };

  const handleOpenAssignButton = () => {
    resetAssignForm();
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    setAssignDate(todayStr);
    setBulkStartDate(todayStr);
    setBulkEndDate(todayStr);
    setIsAssignDialogOpen(true);
  };

  const handleDayClick = (date: Date, dayAssignments: ScheduleResponseDto[]) => {
    setSelectedDayAssignments(dayAssignments);
    // Pre-populate for quick assign if empty
    const formattedDate = format(date, 'yyyy-MM-dd');
    setAssignDate(formattedDate);
    setBulkStartDate(formattedDate);
    setBulkEndDate(formattedDate);
    
    setIsDetailsDialogOpen(true);
  };

  const handleDayOfWeekToggle = (val: number) => {
    setSelectedDaysOfWeek(prev => 
      prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]
    );
  };

  const handleWeekOfMonthToggle = (val: number) => {
    setSelectedWeeksOfMonth(prev =>
      prev.includes(val) ? prev.filter(x => x !== val) : [...prev, val]
    );
  };

  const handleSaveShiftTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftName.trim()) return;
    saveShiftTemplateMutation.mutate({
      id: editingShift?.id,
      name: shiftName.trim(),
      startTime: shiftStartTime,
      endTime: shiftEndTime,
    });
  };

  const handleAssignShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!assignEmployeeId || !assignShiftId) {
      alert('Please select employee and shift');
      return;
    }
    if (isBulk && (!bulkStartDate || !bulkEndDate)) {
      alert('Please specify date range');
      return;
    }
    if (!isBulk && !assignDate) {
      alert('Please specify date');
      return;
    }
    assignShiftMutation.mutate();
  };

  // Assign shift colors dynamically
  const getShiftColor = (name: string) => {
    const lower = name.toLowerCase();
    if (lower.includes('morning') || lower.includes('general') || lower.includes('day')) {
      return { bg: alpha(theme.palette.success.main, 0.12), border: theme.palette.success.main, text: theme.palette.success.dark };
    }
    if (lower.includes('evening') || lower.includes('afternoon')) {
      return { bg: alpha(theme.palette.warning.main, 0.12), border: theme.palette.warning.main, text: theme.palette.warning.dark };
    }
    if (lower.includes('night')) {
      return { bg: alpha(theme.palette.primary.main, 0.12), border: theme.palette.primary.main, text: theme.palette.primary.dark };
    }
    return { bg: alpha(theme.palette.secondary.main, 0.12), border: theme.palette.secondary.main, text: theme.palette.secondary.dark };
  };

  return (
    <Box sx={{ p: 3 }}>
      {/* Top Banner Header */}
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4" fontWeight={900} gutterBottom sx={{ letterSpacing: '-0.8px' }}>
            {isEmployee ? 'My Work Schedule' : 'Shift Scheduling & Rota'}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isEmployee 
              ? 'View your assigned shift timings and active task locations.' 
              : 'Configure shift templates, schedule employee shifts, and monitor site rosters.'}
          </Typography>
        </Box>

        {/* Global Controls (Sites and Assignments) */}
        {!isEmployee && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
            <TextField
              select
              size="small"
              label="Selected Site"
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              sx={{ minWidth: 220 }}
              slotProps={{ input: { sx: { borderRadius: 2.5 } } }}
              disabled={sitesLoading}
            >
              {sites.map((s: any) => (
                <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
              ))}
            </TextField>
            
            {isAdmin && (
              <Button
                variant="contained"
                color="primary"
                onClick={handleOpenAssignButton}
                startIcon={<AddIcon />}
                sx={{ borderRadius: 2.5, fontWeight: 700 }}
              >
                Assign Shift
              </Button>
            )}
            
            <IconButton 
              onClick={() => {
                refetchSchedule();
                refetchShifts();
              }}
              disabled={scheduleLoading || shiftsLoading}
              sx={{ border: 1, borderColor: 'divider', borderRadius: 2.5 }}
            >
              {scheduleLoading || shiftsLoading ? <CircularProgress size={20} /> : <RefreshIcon />}
            </IconButton>
          </Box>
        )}
      </Box>

      {/* Main Content Layout */}
      <Grid container spacing={3}>
        
        {/* Sidebar Panel: Shift Templates & Site Roster (Managers Only) */}
        {!isEmployee && (
          <Grid size={{ xs: 12, md: 4, lg: 3 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              
              {/* Shift Templates Management Card */}
              <Card variant="outlined" sx={{ borderRadius: 4 }}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: alpha(theme.palette.primary.main, 0.01) }}>
                  <Typography variant="subtitle1" fontWeight={850} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <ScheduleIcon color="primary" fontSize="small" /> Shift Templates
                  </Typography>
                  {isAdmin && (
                    <IconButton size="small" color="primary" onClick={() => { resetShiftForm(); setIsShiftTemplateDialogOpen(true); }}>
                      <AddIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
                <CardContent sx={{ p: 2 }}>
                  {shiftsLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={20} /></Box>
                  ) : shifts.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                      No templates defined for this site.
                    </Typography>
                  ) : (
                    <List disablePadding>
                      {shifts.map((s: Shift) => {
                        const colors = getShiftColor(s.name);
                        return (
                          <ListItem 
                            key={s.id} 
                            disablePadding 
                            sx={{ 
                              mb: 1.2, 
                              p: 1.2, 
                              borderRadius: 2.5, 
                              border: 1, 
                              borderColor: s.isActive ? colors.border : 'divider',
                              backgroundColor: s.isActive ? colors.bg : 'transparent',
                              opacity: s.isActive ? 1 : 0.6
                            }}
                          >
                            <ListItemText
                              primary={<Typography sx={{ fontWeight: 800, fontSize: '0.85rem', color: colors.text }}>{s.name}</Typography>}
                              secondary={<Typography variant="caption" sx={{ fontSize: '0.78rem', display: 'block', color: 'text.secondary' }}>{`${formatTimeTo12Hour(s.startTime)} - ${formatTimeTo12Hour(s.endTime)}`}</Typography>}
                            />
                            {isAdmin && (
                              <ListItemSecondaryAction sx={{ right: 8 }}>
                                <IconButton size="small" onClick={() => handleOpenOpenAssignWithShift(s.id)} title="Schedule employee to this shift">
                                  <AssignedIcon fontSize="inherit" color="action" />
                                </IconButton>
                                <IconButton size="small" onClick={() => handleOpenEditShift(s)} title="Edit template">
                                  <EditIcon fontSize="inherit" color="action" />
                                </IconButton>
                                <IconButton size="small" color="error" onClick={() => {
                                  if (confirm(`Deactivate/delete shift template "${s.name}"?`)) {
                                    deleteShiftTemplateMutation.mutate(s.id);
                                  }
                                }} title="Delete template">
                                  <DeleteIcon fontSize="inherit" />
                                </IconButton>
                              </ListItemSecondaryAction>
                            )}
                          </ListItem>
                        );
                      })}
                    </List>
                  )}
                </CardContent>
              </Card>

              {/* Site Roster / Employees Card */}
              <Card variant="outlined" sx={{ borderRadius: 4 }}>
                <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider', bgcolor: alpha(theme.palette.primary.main, 0.01) }}>
                  <Typography variant="subtitle1" fontWeight={850} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <RosterIcon color="primary" fontSize="small" /> Site Roster ({siteEmployees.length})
                  </Typography>
                </Box>
                <CardContent sx={{ p: 1.5, maxHeight: '35vh', overflowY: 'auto' }}>
                  {employeesLoading ? (
                    <Box sx={{ display: 'flex', justifyContent: 'center', py: 3 }}><CircularProgress size={20} /></Box>
                  ) : siteEmployees.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                      No employees enrolled at this site.
                    </Typography>
                  ) : (
                    <List disablePadding>
                      {siteEmployees.map((emp: Employee) => (
                        <ListItem key={emp.id} sx={{ py: 0.8, px: 1, borderRadius: 2, '&:hover': { bgcolor: 'action.hover' } }}>
                          <ListItemText 
                            primary={<Typography sx={{ fontWeight: 650, fontSize: '0.82rem' }}>{emp.fullName}</Typography>}
                            secondary={<Typography variant="caption" sx={{ fontSize: '0.75rem', display: 'block', color: 'text.secondary' }}>{emp.designation || 'Security Guard'}</Typography>}
                          />
                          {isAdmin && (
                            <IconButton 
                              size="small" 
                              color="primary"
                              onClick={() => {
                                resetAssignForm();
                                setAssignEmployeeId(emp.id);
                                setAssignDate(format(new Date(), 'yyyy-MM-dd'));
                                setBulkStartDate(format(new Date(), 'yyyy-MM-dd'));
                                setBulkEndDate(format(new Date(), 'yyyy-MM-dd'));
                                setIsAssignDialogOpen(true);
                              }}
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          )}
                        </ListItem>
                      ))}
                    </List>
                  )}
                </CardContent>
              </Card>

            </Box>
          </Grid>
        )}

        {/* Schedule Calendar Matrix (Main Area) */}
        <Grid size={{ xs: 12, md: !isEmployee ? 8 : 12, lg: !isEmployee ? 9 : 12 }}>
          <Card variant="outlined" sx={{ borderRadius: 4, height: '100%', display: 'flex', flexDirection: 'column' }}>
            
            {/* Calendar Controls Bar */}
            <Box sx={{ px: 3, py: 2, borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 2, bgcolor: alpha(theme.palette.primary.main, 0.01) }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <IconButton onClick={handlePrevMonth} size="small"><PrevIcon /></IconButton>
                <Typography variant="h6" fontWeight={850} sx={{ minWidth: 150, textAlign: 'center' }}>
                  {format(currentMonth, 'MMMM yyyy')}
                </Typography>
                <IconButton onClick={handleNextMonth} size="small"><NextIcon /></IconButton>
                <Button variant="outlined" size="small" startIcon={<TodayIcon />} onClick={handleCurrentMonth} sx={{ ml: 1, borderRadius: 2, fontWeight: 700 }}>
                  Today
                </Button>
              </Box>

              {/* Status Indicators */}
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                <Chip icon={<Box sx={{ width: 10, height: 10, bgcolor: theme.palette.success.main, borderRadius: '50%', ml: 1 }} />} label="Morning" size="small" variant="outlined" sx={{ fontSize: '0.72rem', fontWeight: 700 }} />
                <Chip icon={<Box sx={{ width: 10, height: 10, bgcolor: theme.palette.warning.main, borderRadius: '50%', ml: 1 }} />} label="Evening" size="small" variant="outlined" sx={{ fontSize: '0.72rem', fontWeight: 700 }} />
                <Chip icon={<Box sx={{ width: 10, height: 10, bgcolor: theme.palette.primary.main, borderRadius: '50%', ml: 1 }} />} label="Night" size="small" variant="outlined" sx={{ fontSize: '0.72rem', fontWeight: 700 }} />
              </Box>
            </Box>

            {/* Calendar Body */}
            <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
              
              {/* Day Headers */}
              <Grid container columns={7} sx={{ borderBottom: 1, borderColor: 'divider', textAlign: 'center', py: 1, bgcolor: 'action.hover' }}>
                {WEEKDAYS.map((day) => (
                  <Grid key={day} size={1} sx={{ width: '14.28%' }}>
                    <Typography variant="caption" fontWeight={800} color="text.secondary">
                      {day}
                    </Typography>
                  </Grid>
                ))}
              </Grid>

              {/* Days Matrix */}
              {scheduleLoading ? (
                <Box sx={{ display: 'flex', flexGrow: 1, alignItems: 'center', justifyContent: 'center', minHeight: '50vh' }}>
                  <CircularProgress />
                </Box>
              ) : (
                <Grid container columns={7} sx={{ flexGrow: 1, minHeight: '60vh' }}>
                  {calendarDays.map((day, idx) => {
                    const dateStr = format(day, 'yyyy-MM-dd');
                    const dayAssignments = assignmentsByDay[dateStr] || [];
                    const isCurrentM = isSameMonth(day, currentMonth);
                    const isToday = isSameDay(day, new Date());
                    
                    return (
                      <Grid 
                        key={idx} 
                        size={1} 
                        onClick={() => handleDayClick(day, dayAssignments)}
                        sx={{
                          width: '14.28%',
                          height: '100px',
                          borderRight: '1px solid',
                          borderBottom: '1px solid',
                          borderColor: 'divider',
                          p: 0.5,
                          display: 'flex',
                          flexDirection: 'column',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          backgroundColor: isToday 
                            ? alpha(theme.palette.primary.main, 0.03) 
                            : isCurrentM ? 'background.paper' : 'action.hover',
                          '&:hover': {
                            backgroundColor: alpha(theme.palette.primary.main, 0.05),
                          },
                          position: 'relative'
                        }}
                      >
                        {/* Day Number */}
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
                          <Typography 
                            variant="caption" 
                            fontWeight={isToday ? 900 : 700}
                            color={isToday ? 'primary.main' : isCurrentM ? 'text.primary' : 'text.secondary'}
                            sx={isToday ? {
                              bgcolor: 'primary.light',
                              px: 0.7,
                              py: 0.2,
                              borderRadius: '50%',
                              fontSize: '0.75rem'
                            } : { fontSize: '0.72rem' }}
                          >
                            {format(day, 'd')}
                          </Typography>
                          
                          {/* Quick Assign Icon (Manager only, on current month days) */}
                          {isAdmin && isCurrentM && (
                            <IconButton 
                              size="small" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenAssignForDay(day);
                              }}
                              sx={{ 
                                opacity: 0, 
                                transition: 'opacity 0.2s', 
                                '.MuiGrid-item:hover &': { opacity: 1 },
                                p: 0.2
                              }}
                            >
                              <AddIcon sx={{ fontSize: '0.75rem' }} />
                            </IconButton>
                          )}
                        </Box>

                        {/* List of Shift Assignments in cell */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.4, overflowY: 'auto', flexGrow: 1, '&::-webkit-scrollbar': { display: 'none' } }}>
                          {dayAssignments.slice(0, 3).map((asg) => {
                            const colors = getShiftColor(asg.shiftName);
                            return (
                              <Tooltip 
                                key={asg.assignmentId} 
                                title={`${asg.employeeName} - ${asg.shiftName} (${formatTimeTo12Hour(asg.startTime)} - ${formatTimeTo12Hour(asg.endTime)})`}
                              >
                                <Box
                                  sx={{
                                    px: 0.5,
                                    py: 0.2,
                                    borderRadius: 1.5,
                                    borderLeft: 3,
                                    borderColor: colors.border,
                                    backgroundColor: colors.bg,
                                    color: colors.text,
                                    fontSize: '0.65rem',
                                    fontWeight: 800,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center'
                                  }}
                                >
                                  <span>{isEmployee ? asg.shiftName : asg.employeeName}</span>
                                </Box>
                              </Tooltip>
                            );
                          })}
                          
                          {dayAssignments.length > 3 && (
                            <Typography variant="caption" color="text.secondary" fontWeight={800} align="center" sx={{ fontSize: '0.6rem' }}>
                              + {dayAssignments.length - 3} more
                            </Typography>
                          )}
                        </Box>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </Box>
          </Card>
        </Grid>
      </Grid>

      {/* --- dialogs & forms --- */}

      {/* 1. Shift Templates Dialog (CRUD) */}
      <Dialog 
        open={isShiftTemplateDialogOpen} 
        onClose={() => setIsShiftTemplateDialogOpen(false)}
        slotProps={{ paper: { sx: { borderRadius: 3.5, width: 420 } } }}
      >
        <DialogTitle sx={{ fontWeight: 850 }}>
          {editingShift ? 'Edit Shift Template' : 'Create Shift Template'}
        </DialogTitle>
        <Box component="form" onSubmit={handleSaveShiftTemplate}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            <TextField
              required
              fullWidth
              label="Shift Name"
              placeholder="e.g. Morning Guard Shift"
              value={shiftName}
              onChange={(e) => setShiftName(e.target.value)}
              slotProps={{ input: { sx: { borderRadius: 2 } } }}
            />
            
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField
                required
                fullWidth
                label="Start Time"
                type="time"
                value={shiftStartTime}
                onChange={(e) => setShiftStartTime(e.target.value)}
                slotProps={{ input: { sx: { borderRadius: 2 } } }}
              />
              <TextField
                required
                fullWidth
                label="End Time"
                type="time"
                value={shiftEndTime}
                onChange={(e) => setShiftEndTime(e.target.value)}
                slotProps={{ input: { sx: { borderRadius: 2 } } }}
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setIsShiftTemplateDialogOpen(false)} sx={{ borderRadius: 2 }}>Cancel</Button>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary"
              disabled={saveShiftTemplateMutation.isPending}
              sx={{ borderRadius: 2 }}
            >
              {saveShiftTemplateMutation.isPending ? <CircularProgress size={16} /> : 'Save Template'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* 2. Assign Shift Dialog (Single or Bulk Recurrence) */}
      <Dialog 
        open={isAssignDialogOpen} 
        onClose={() => setIsAssignDialogOpen(false)}
        slotProps={{ paper: { sx: { borderRadius: 4, width: 480 } } }}
      >
        <DialogTitle sx={{ fontWeight: 900 }}>
          Schedule Shift Assignment
        </DialogTitle>
        <Box component="form" onSubmit={handleAssignShift}>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            
            {/* Select Employee */}
            <FormControl fullWidth required>
              <InputLabel>Select Employee</InputLabel>
              <Select
                value={assignEmployeeId}
                onChange={(e) => setAssignEmployeeId(e.target.value)}
                label="Select Employee"
                sx={{ borderRadius: 2 }}
              >
                {siteEmployees.map((emp: Employee) => (
                  <MenuItem key={emp.id} value={emp.id}>{emp.fullName}</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Select Shift Template */}
            <FormControl fullWidth required>
              <InputLabel>Select Shift Template</InputLabel>
              <Select
                value={assignShiftId}
                onChange={(e) => setAssignShiftId(e.target.value)}
                label="Select Shift Template"
                sx={{ borderRadius: 2 }}
              >
                {shifts.map((s: Shift) => (
                  <MenuItem key={s.id} value={s.id}>{s.name} ({formatTimeTo12Hour(s.startTime)} - {formatTimeTo12Hour(s.endTime)})</MenuItem>
                ))}
              </Select>
            </FormControl>

            {/* Bulk Assignment Switch (Allowed for Admin) */}
            <FormControlLabel
              control={
                <Checkbox 
                  checked={isBulk} 
                  onChange={(e) => setIsBulk(e.target.checked)} 
                  color="primary"
                />
              }
              label={
                <Typography variant="body2" fontWeight={700}>
                  Set Recurring / Bulk Schedule
                </Typography>
              }
            />

            {/* Conditional Date inputs */}
            {!isBulk ? (
              <TextField
                required
                fullWidth
                label="Date"
                type="date"
                value={assignDate}
                onChange={(e) => setAssignDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true }, input: { sx: { borderRadius: 2 } } }}
              />
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <TextField
                    required
                    fullWidth
                    label="Start Date"
                    type="date"
                    value={bulkStartDate}
                    onChange={(e) => setBulkStartDate(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true }, input: { sx: { borderRadius: 2 } } }}
                  />
                  <TextField
                    required
                    fullWidth
                    label="End Date"
                    type="date"
                    value={bulkEndDate}
                    onChange={(e) => setBulkEndDate(e.target.value)}
                    slotProps={{ inputLabel: { shrink: true }, input: { sx: { borderRadius: 2 } } }}
                  />
                </Box>

                {/* Recurrence Type Selector */}
                <FormControl fullWidth>
                  <InputLabel>Recurrence Frequency</InputLabel>
                  <Select
                    value={recurrenceType}
                    onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                    label="Recurrence Frequency"
                    sx={{ borderRadius: 2 }}
                  >
                    <MenuItem value="DAILY">Every Day</MenuItem>
                    <MenuItem value="WEEKLY">Weekly recurrence</MenuItem>
                    <MenuItem value="MONTHLY">Monthly recurrence</MenuItem>
                  </Select>
                </FormControl>

                {/* Weekly settings: Checkdays */}
                {recurrenceType === 'WEEKLY' && (
                  <Box>
                    <Typography variant="caption" fontWeight={800} color="text.secondary" display="block" sx={{ mb: 1 }}>
                      DAYS OF THE WEEK
                    </Typography>
                    <FormGroup sx={{ display: 'flex', flexDirection: 'row', gap: 1 }}>
                      {DAYS_OF_WEEK_MAP.map((day) => (
                        <FormControlLabel
                          key={day.value}
                          control={
                            <Checkbox
                              checked={selectedDaysOfWeek.includes(day.value)}
                              onChange={() => handleDayOfWeekToggle(day.value)}
                              size="small"
                            />
                          }
                          label={<Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{day.label.substring(0, 3)}</Typography>}
                          sx={{ mr: 0.5 }}
                        />
                      ))}
                    </FormGroup>
                  </Box>
                )}

                {/* Monthly settings: weeks and optionally days */}
                {recurrenceType === 'MONTHLY' && (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <Box>
                      <Typography variant="caption" fontWeight={800} color="text.secondary" display="block" sx={{ mb: 1 }}>
                        WEEKS OF THE MONTH
                      </Typography>
                      <FormGroup sx={{ display: 'flex', flexDirection: 'row', gap: 1 }}>
                        {[1, 2, 3, 4].map((wk) => (
                          <FormControlLabel
                            key={wk}
                            control={
                              <Checkbox
                                checked={selectedWeeksOfMonth.includes(wk)}
                                onChange={() => handleWeekOfMonthToggle(wk)}
                                size="small"
                              />
                            }
                            label={<Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>Week {wk}</Typography>}
                          />
                        ))}
                      </FormGroup>
                    </Box>
                    
                    <Box>
                      <Typography variant="caption" fontWeight={800} color="text.secondary" display="block" sx={{ mb: 1 }}>
                        DAYS OF THE WEEK (OPTIONAL)
                      </Typography>
                      <FormGroup sx={{ display: 'flex', flexDirection: 'row', gap: 1 }}>
                        {DAYS_OF_WEEK_MAP.map((day) => (
                          <FormControlLabel
                            key={day.value}
                            control={
                              <Checkbox
                                checked={selectedDaysOfWeek.includes(day.value)}
                                onChange={() => handleDayOfWeekToggle(day.value)}
                                size="small"
                              />
                            }
                            label={<Typography sx={{ fontSize: '0.75rem', fontWeight: 600 }}>{day.label.substring(0, 3)}</Typography>}
                            sx={{ mr: 0.5 }}
                          />
                        ))}
                      </FormGroup>
                    </Box>
                  </Box>
                )}

              </Box>
            )}

          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setIsAssignDialogOpen(false)} sx={{ borderRadius: 2 }}>Cancel</Button>
            <Button 
              type="submit" 
              variant="contained" 
              color="primary"
              disabled={assignShiftMutation.isPending}
              sx={{ borderRadius: 2 }}
            >
              {assignShiftMutation.isPending ? <CircularProgress size={16} /> : 'Save Assignment'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* 3. Day / Assignment Details Dialog */}
      <Dialog 
        open={isDetailsDialogOpen} 
        onClose={() => setIsDetailsDialogOpen(false)}
        slotProps={{ paper: { sx: { borderRadius: 4, width: 420 } } }}
      >
        <DialogTitle sx={{ fontWeight: 900 }}>
          Assignments list
        </DialogTitle>
        <DialogContent sx={{ p: 0 }}>
          {selectedDayAssignments.length === 0 ? (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                No shifts scheduled for this day.
              </Typography>
              {isAdmin && (
                <Button 
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setIsDetailsDialogOpen(false);
                    setIsAssignDialogOpen(true);
                  }}
                  sx={{ mt: 2, borderRadius: 2, fontWeight: 700 }}
                >
                  Schedule an Employee
                </Button>
              )}
            </Box>
          ) : (
            <List sx={{ px: 2, py: 1 }}>
              {selectedDayAssignments.map((asg) => {
                const colors = getShiftColor(asg.shiftName);
                return (
                  <Paper 
                    key={asg.assignmentId} 
                    variant="outlined" 
                    sx={{ 
                      mb: 1.5, 
                      p: 1.8, 
                      borderRadius: 3, 
                      borderLeft: 4, 
                      borderColor: colors.border,
                      backgroundColor: colors.bg
                    }}
                  >
                    <Grid container sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                      <Grid size={{ xs: 8 }}>
                        <Typography variant="subtitle2" fontWeight={850}>{asg.employeeName}</Typography>
                        <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                          Shift: {asg.shiftName}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Time: {formatTimeTo12Hour(asg.startTime)} - {formatTimeTo12Hour(asg.endTime)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" display="block">
                          Location: {asg.siteName}
                        </Typography>
                      </Grid>
                      {isAdmin && (
                        <Grid size={{ xs: 4 }} sx={{ textAlign: 'right' }}>
                          <Button
                            size="small"
                            variant="text"
                            color="error"
                            startIcon={<DeleteIcon />}
                            onClick={() => {
                              if (confirm(`Remove shift assignment for ${asg.employeeName}?`)) {
                                unassignMutation.mutate(asg.assignmentId);
                              }
                            }}
                            sx={{ fontWeight: 700 }}
                          >
                            Remove
                          </Button>
                        </Grid>
                      )}
                    </Grid>
                  </Paper>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setIsDetailsDialogOpen(false)} sx={{ borderRadius: 2 }}>Close</Button>
        </DialogActions>
      </Dialog>

    </Box>
  );

  // Helper function to assign using a specific template directly
  function handleOpenOpenAssignWithShift(shiftId: string) {
    resetAssignForm();
    setAssignShiftId(shiftId);
    setAssignDate(format(new Date(), 'yyyy-MM-dd'));
    setBulkStartDate(format(new Date(), 'yyyy-MM-dd'));
    setBulkEndDate(format(new Date(), 'yyyy-MM-dd'));
    setIsAssignDialogOpen(true);
  }
}
