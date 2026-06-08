import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography as MuiTypography,
  Stepper,
  Step,
  StepLabel,
  Button,
  Paper,
  TextField,
  Grid,
  MenuItem,
  useTheme,
  alpha,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  Tooltip,
  IconButton,
} from '@mui/material';
import {
  Person as PersonIcon,
  Description as DocIcon,
  CheckCircle as DoneIcon,
  CloudUpload as UploadIcon,
  CheckCircleOutlined as CheckIcon,
  ErrorOutlined as ErrorIcon,
  HourglassEmpty as PendingIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod'  ;
import { z } from 'zod';
import { EmployeeService } from '../../api/employee.service';
import { useAuthStore } from '../../stores/auth.store';
import apiClient from '../../api/client';

const Typography = MuiTypography as any;

const basicInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().min(10, 'Phone is required'),
  role: z.string(),
  joiningDate: z.date(),
  organizationId: z.string().optional(),
  siteId: z.string().optional(),
});

type BasicInfoSchema = z.infer<typeof basicInfoSchema>;

interface DocSlot {
  type: string;
  label: string;
  required: boolean;
  description: string;
  accept: string;
}

// Document slots definition — required types must be uploaded before finish
const DOC_SLOTS: DocSlot[] = [
  { type: 'AADHAAR', label: 'Aadhaar Card', required: true, description: 'Front & back of Aadhaar card (PDF/JPG/PNG)', accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'PAN', label: 'PAN Card', required: true, description: 'PAN card image or scanned document', accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'BANK_PASSBOOK', label: 'Bank Passbook / Statement', required: false, description: 'First page of bank passbook or statement', accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'DRIVING_LICENSE', label: 'Driving License', required: false, description: 'Driving license (front & back)', accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'VOTER_ID', label: 'Voter ID', required: false, description: 'Voter identity card', accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'PASSPORT', label: 'Passport', required: false, description: 'Passport (first & last page)', accept: '.pdf,.jpg,.jpeg,.png' },
];

type DocStatus = 'idle' | 'uploading' | 'done' | 'error';

interface DocState {
  file: File | null;
  status: DocStatus;
  fileUrl: string;
  errorMsg: string;
  previewUrl: string;
}

const steps = [
  { label: 'Basic Info', icon: <PersonIcon /> },
  { label: 'Documents', icon: <DocIcon /> },
];

export default function EmployeeOnboardingPage() {
  const navigate = useNavigate();
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);

  const [activeStep, setActiveStep] = useState(0);
  const [createdEmployeeId, setCreatedEmployeeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [sitesLoading, setSitesLoading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; type: string } | null>(null);

  // Per-document state map: docType -> DocState
  const [docStates, setDocStates] = useState<Record<string, DocState>>(() => {
    const initial: Record<string, DocState> = {};
    DOC_SLOTS.forEach((s) => {
      initial[s.type] = { file: null, status: 'idle', fileUrl: '', errorMsg: '', previewUrl: '' };
    });
    return initial;
  });

  // One ref per doc slot
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  // Load organizations for SUPER_ADMIN
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      // GET /v1/admin/organizations returns ApiResponse<PaginatedOrganizations>
      // apiClient already unwraps axios → { success, data: { organizations: [...], meta } }
      apiClient.get('/admin/organizations?page=1&limit=100')
        .then((res: any) => {
          // paginated: res.data.organizations OR res.organizations (depending on unwrap level)
          const orgList = res?.data?.organizations
            ?? res?.organizations
            ?? res?.data
            ?? [];
          setOrganizations(Array.isArray(orgList) ? orgList : []);
        })
        .catch((err) => console.error('Failed to load organizations', err));
    }
  }, [user]);

  // Helper to load sites for a given org
  const loadSitesForOrg = (orgId: string) => {
    if (!orgId) { setSites([]); return; }
    setSitesLoading(true);
    apiClient.get(`/sites?organizationId=${orgId}&limit=100`)
      .then((res: any) => {
        const list = res?.data?.data || res?.data || [];
        setSites(Array.isArray(list) ? list : []);
      })
      .catch((err) => console.error('Failed to load sites', err))
      .finally(() => setSitesLoading(false));
  };

  // For ADMIN: load their org's sites on mount
  useEffect(() => {
    if (user?.role !== 'SUPER_ADMIN' && user?.organizationId) {
      loadSitesForOrg(user.organizationId);
    }
  }, [user]);

  const { control, handleSubmit, watch, formState: { errors }, reset, setValue } = useForm<BasicInfoSchema>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: 'EMPLOYEE',
      joiningDate: new Date(),
      organizationId: '',
      siteId: '',
    }
  });

  // For SUPER_ADMIN: reload sites whenever the org selection changes
  const watchedOrgId = watch('organizationId');
  useEffect(() => {
    if (user?.role === 'SUPER_ADMIN') {
      loadSitesForOrg(watchedOrgId || '');
      setValue('siteId', ''); // Dynamically reset assigned site when organization changes
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedOrgId, user?.role]);


  const handleBack = () => {
    setApiError(null);
    setActiveStep((prev) => prev - 1);
  };

  const onBasicInfoSubmit = async (data: BasicInfoSchema) => {
    setIsSubmitting(true);
    setApiError(null);
    try {
      const selectedOrgId = user?.role === 'SUPER_ADMIN' ? data.organizationId : user?.organizationId;
      if (!selectedOrgId) {
        setApiError('Organization selection is required.');
        return;
      }

      const payload: any = {
        fullName: `${data.firstName} ${data.lastName}`,
        email: data.email,
        phone: data.phone,
        role: data.role,
        status: 'ACTIVE',
        joiningDate: data.joiningDate.toISOString(),
        organizationId: selectedOrgId,
      };
      // Only include siteId if one was selected
      if (data.siteId) payload.siteId = data.siteId;

      const res = await EmployeeService.createEmployee(payload);
      const newEmployeeId = (res as any).id || (res as any).data?.id;
      if (newEmployeeId) {
        setCreatedEmployeeId(newEmployeeId);
        setActiveStep(1);
      } else {
        console.warn('Could not find ID in response:', res);
        setActiveStep(1);
      }
    } catch (error: any) {
      const errData = (error.code && error.message) ? error : (error.response?.data?.error || error.response?.data);
      const status = error.status || error.response?.status;
      if (errData?.code === 'DUPLICATE_RESOURCE') {
        setApiError(errData.message || 'An employee with this email or phone already exists.');
      } else if (status === 409) {
        setApiError('An employee with these details already exists.');
      } else {
        setApiError(errData?.message || error.message || 'Failed to create employee.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Upload a single document file and register it
  const handleFileSelected = async (docType: string, file: File) => {
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';

    setDocStates((prev) => ({
      ...prev,
      [docType]: { file, status: 'uploading', fileUrl: '', errorMsg: '', previewUrl },
    }));

    try {
      // 1. Upload file to media service
      const fileUrl = await EmployeeService.uploadDocumentFile(file);
      if (!fileUrl) throw new Error('No file URL returned from media service');

      // 2. Register document on the employee record
      if (createdEmployeeId) {
        await EmployeeService.uploadDocument(createdEmployeeId, docType, fileUrl);
      }

      setDocStates((prev) => ({
        ...prev,
        [docType]: { file, status: 'done', fileUrl, errorMsg: '', previewUrl },
      }));
    } catch (err: any) {
      setDocStates((prev) => ({
        ...prev,
        [docType]: {
          file,
          status: 'error',
          fileUrl: '',
          errorMsg: err?.message || 'Upload failed. Please retry.',
          previewUrl: '',
        },
      }));
    }
  };

  const handleFinish = async () => {
    // Validate mandatory docs
    const missingRequired = DOC_SLOTS.filter(
      (s) => s.required && docStates[s.type].status !== 'done'
    );
    if (missingRequired.length > 0) {
      setApiError(`Please upload required documents: ${missingRequired.map((s) => s.label).join(', ')}`);
      return;
    }
    setActiveStep(steps.length);
  };

  const isImageUrl = (url: string) =>
    /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);

  const getDocStatusIcon = (status: DocStatus) => {
    switch (status) {
      case 'done': return <CheckIcon sx={{ color: theme.palette.success.main }} />;
      case 'uploading': return <CircularProgress size={20} />;
      case 'error': return <ErrorIcon sx={{ color: theme.palette.error.main }} />;
      default: return <PendingIcon sx={{ color: theme.palette.text.disabled }} />;
    }
  };

  const getDocBorderColor = (status: DocStatus, required: boolean) => {
    if (status === 'done') return theme.palette.success.main + '60';
    if (status === 'error') return theme.palette.error.main + '60';
    if (status === 'uploading') return theme.palette.primary.main + '60';
    if (required) return theme.palette.warning.main + '40';
    return theme.palette.divider;
  };

  const renderStepContent = (step: number) => {
    switch (step) {
      case 0:
        return (
          <Box component="form" id="basic-info-form" onSubmit={handleSubmit(onBasicInfoSubmit)}>
            {apiError && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setApiError(null)}>
                {apiError}
              </Alert>
            )}
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="firstName"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth label="First Name" placeholder="John" variant="outlined"
                      error={!!errors.firstName} helperText={errors.firstName?.message}
                      slotProps={{ input: { sx: { borderRadius: 2 } } }}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="lastName"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth label="Last Name" placeholder="Doe" variant="outlined"
                      error={!!errors.lastName} helperText={errors.lastName?.message}
                      slotProps={{ input: { sx: { borderRadius: 2 } } }}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="email"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth label="Email" placeholder="john.doe@example.com" variant="outlined"
                      error={!!errors.email} helperText={errors.email?.message}
                      slotProps={{ input: { sx: { borderRadius: 2 } } }}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="phone"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth label="Phone" placeholder="+91 98765 43210" variant="outlined"
                      error={!!errors.phone} helperText={errors.phone?.message}
                      slotProps={{ input: { sx: { borderRadius: 2 } } }}
                    />
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="role"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth select label="Role" variant="outlined"
                      error={!!errors.role} helperText={errors.role?.message}
                      slotProps={{ input: { sx: { borderRadius: 2 } } }}
                    >
                      <MenuItem value="EMPLOYEE">Employee</MenuItem>
                      <MenuItem value="SUPERVISOR">Supervisor</MenuItem>
                      <MenuItem value="ADMIN">Admin</MenuItem>
                      <MenuItem value="CLIENT">Client</MenuItem>
                    </TextField>
                  )}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Controller
                  name="joiningDate"
                  control={control}
                  render={({ field }) => (
                    <DatePicker
                      label="Joining Date"
                      value={field.value}
                      onChange={(date) => field.onChange(date)}
                      slotProps={{
                        textField: {
                          fullWidth: true, variant: 'outlined',
                          error: !!errors.joiningDate,
                          helperText: errors.joiningDate?.message,
                          slotProps: { input: { sx: { borderRadius: 2 } } }
                        }
                      }}
                    />
                  )}
                />
              </Grid>

              {user?.role === 'SUPER_ADMIN' && (
                <Grid size={{ xs: 12 }}>
                  <Controller
                    name="organizationId"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        fullWidth select label="Assign Organization" variant="outlined"
                        error={!!errors.organizationId} helperText={errors.organizationId?.message}
                        slotProps={{ input: { sx: { borderRadius: 2 } } }}
                      >
                        <MenuItem value=""><em>Select Organization</em></MenuItem>
                        {organizations.map((org: any) => (
                          <MenuItem key={org.id} value={org.id}>{org.name}</MenuItem>
                        ))}
                      </TextField>
                    )}
                  />
                </Grid>
              )}

              {/* Site assignment — shown for all roles once sites are available */}
              <Grid size={{ xs: 12 }}>
                <Controller
                  name="siteId"
                  control={control}
                  render={({ field }) => (
                    <TextField
                      {...field}
                      fullWidth select label="Assign Site (Optional)" variant="outlined"
                      disabled={sitesLoading || sites.length === 0}
                      helperText={
                        sitesLoading
                          ? 'Loading sites…'
                          : sites.length === 0
                            ? user?.role === 'SUPER_ADMIN'
                              ? 'Select an organization first to see its sites'
                              : 'No active sites found for your organization'
                            : 'Select the site this employee will be assigned to'
                      }
                      slotProps={{ input: { sx: { borderRadius: 2 } } }}
                    >
                      <MenuItem value=""><em>No Site Assigned</em></MenuItem>
                      {sites.map((site: any) => (
                        <MenuItem key={site.id} value={site.id}>
                          <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontWeight: 600 }}>{site.name}</span>
                            {site.address && (
                              <span style={{ fontSize: '0.75rem', color: 'text.secondary' }}>
                                {site.address}
                              </span>
                            )}
                          </Box>
                        </MenuItem>
                      ))}
                    </TextField>
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 1:
        return (
          <Box>
            {apiError && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setApiError(null)}>
                {apiError}
              </Alert>
            )}

            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" fontWeight={800} gutterBottom>
                Upload Identification Documents
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Documents marked with <Chip label="Required" size="small" color="warning" sx={{ mx: 0.5, fontWeight: 700, fontSize: '0.7rem' }} /> must be uploaded before proceeding. Others are optional.
              </Typography>
            </Box>

            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {DOC_SLOTS.map((slot) => {
                const state = docStates[slot.type];
                return (
                  <Paper
                    key={slot.type}
                    variant="outlined"
                    sx={{
                      p: 2.5,
                      borderRadius: 3,
                      borderColor: getDocBorderColor(state.status, slot.required),
                      transition: 'border-color 0.3s',
                      backgroundColor: state.status === 'done'
                        ? alpha(theme.palette.success.main, 0.03)
                        : state.status === 'error'
                          ? alpha(theme.palette.error.main, 0.03)
                          : 'transparent',
                    }}
                  >
                    {/* Hidden file input */}
                    <input
                      type="file"
                      accept={slot.accept}
                      style={{ display: 'none' }}
                      ref={(el) => { fileInputRefs.current[slot.type] = el; }}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelected(slot.type, file);
                        // Reset input so same file can be re-selected
                        e.target.value = '';
                      }}
                    />

                    <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                      {/* Left: doc info */}
                      <Box sx={{ flex: 1 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          {getDocStatusIcon(state.status)}
                          <Typography variant="subtitle2" fontWeight={700}>
                            {slot.label}
                          </Typography>
                          {slot.required && (
                            <Chip label="Required" size="small" color="warning" sx={{ fontWeight: 700, fontSize: '0.68rem', height: 20 }} />
                          )}
                          {!slot.required && (
                            <Chip label="Optional" size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.68rem', height: 20 }} />
                          )}
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          {slot.description}
                        </Typography>

                        {state.status === 'uploading' && (
                          <Box sx={{ mt: 1.5 }}>
                            <LinearProgress sx={{ borderRadius: 2 }} />
                            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                              Uploading...
                            </Typography>
                          </Box>
                        )}

                        {state.status === 'done' && (
                          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="caption" sx={{ color: theme.palette.success.main, fontWeight: 600 }}>
                              ✓ {state.file?.name || 'Uploaded successfully'}
                            </Typography>
                            <Tooltip title="Preview">
                              <IconButton
                                size="small"
                                onClick={() => setPreviewDoc({ url: state.fileUrl, type: slot.type })}
                              >
                                <ViewIcon fontSize="small" sx={{ color: theme.palette.primary.main }} />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        )}

                        {state.status === 'error' && (
                          <Alert severity="error" sx={{ mt: 1, py: 0.5, borderRadius: 2, fontSize: '0.78rem' }}>
                            {state.errorMsg}
                          </Alert>
                        )}
                      </Box>

                      {/* Right: upload button */}
                      <Button
                        variant={state.status === 'done' ? 'outlined' : 'contained'}
                        size="small"
                        startIcon={<UploadIcon />}
                        disabled={state.status === 'uploading'}
                        onClick={() => fileInputRefs.current[slot.type]?.click()}
                        sx={{
                          borderRadius: 2,
                          textTransform: 'none',
                          fontWeight: 700,
                          minWidth: 120,
                          flexShrink: 0,
                          ...(state.status === 'done' && { color: theme.palette.success.main, borderColor: theme.palette.success.main }),
                        }}
                      >
                        {state.status === 'done' ? 'Replace' : state.status === 'uploading' ? 'Uploading...' : 'Upload'}
                      </Button>
                    </Box>
                  </Paper>
                );
              })}
            </Box>

            {/* Summary of upload status */}
            <Box sx={{ mt: 3, p: 2, borderRadius: 3, backgroundColor: alpha(theme.palette.info.main, 0.04), border: `1px solid ${alpha(theme.palette.info.main, 0.15)}` }}>
              <Typography variant="body2" fontWeight={700} color="text.secondary" gutterBottom>
                Upload Summary
              </Typography>
              <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                {DOC_SLOTS.map((slot) => (
                  <Chip
                    key={slot.type}
                    label={slot.label}
                    size="small"
                    color={
                      docStates[slot.type].status === 'done' ? 'success' :
                      docStates[slot.type].status === 'error' ? 'error' :
                      slot.required ? 'warning' : 'default'
                    }
                    variant={docStates[slot.type].status === 'done' ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 600, fontSize: '0.72rem' }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  // Success screen
  if (activeStep === steps.length) {
    const uploadedCount = DOC_SLOTS.filter((s) => docStates[s.type].status === 'done').length;
    return (
      <Paper
        elevation={0}
        sx={{
          p: 6, mt: 4, borderRadius: 6, textAlign: 'center',
          border: `1px solid ${theme.palette.divider}`,
          background: `linear-gradient(135deg, ${alpha(theme.palette.success.main, 0.04)}, ${alpha(theme.palette.primary.main, 0.04)})`,
        }}
      >
        <DoneIcon sx={{ fontSize: 72, color: theme.palette.success.main, mb: 2 }} />
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Onboarding Complete!
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          The employee has been successfully registered with <strong>{uploadedCount} document{uploadedCount !== 1 ? 's' : ''}</strong> uploaded.
        </Typography>

        <Alert severity="info" sx={{ mb: 4, textAlign: 'left', borderRadius: 3, border: `1px solid ${alpha(theme.palette.info.main, 0.25)}` }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Action Required: Face Enrollment</Typography>
          <Typography variant="body2">
            The mandatory multi-pose face enrollment must be completed via the Android Application.
            An Administrator should log into the mobile app, navigate to the employee list, and complete the "Enroll Face" workflow.
          </Typography>
        </Alert>

        <Alert severity="warning" sx={{ mb: 4, textAlign: 'left', borderRadius: 3, border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}` }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Pending: Document Verification</Typography>
          <Typography variant="body2">
            Uploaded documents are pending admin verification. You can review and verify them from the Employee Profile → Documents section.
          </Typography>
        </Alert>

        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button
            variant="contained"
            onClick={() => {
              setActiveStep(0);
              setCreatedEmployeeId(null);
              setDocStates(() => {
                const initial: Record<string, DocState> = {};
                DOC_SLOTS.forEach((s) => {
                  initial[s.type] = { file: null, status: 'idle', fileUrl: '', errorMsg: '', previewUrl: '' };
                });
                return initial;
              });
              reset();
            }}
            sx={{ borderRadius: 2.5, px: 4, fontWeight: 700 }}
          >
            Onboard Another
          </Button>
          <Button variant="outlined" onClick={() => navigate('/employees')} sx={{ borderRadius: 2.5, px: 4, fontWeight: 700 }}>
            Back to Employees
          </Button>
        </Box>
      </Paper>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 860, mx: 'auto' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Onboard New Employee
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Follow the steps to register a new employee and upload their identification documents
        </Typography>
      </Box>

      <Stepper
        activeStep={activeStep}
        sx={{
          mb: 5,
          '& .MuiStepLabel-label': { fontWeight: 600 },
          '& .MuiStepIcon-root.Mui-active': { color: theme.palette.primary.main },
          '& .MuiStepIcon-root.Mui-completed': { color: theme.palette.success.main }
        }}
      >
        {steps.map((step, index) => (
          <Step key={step.label}>
            <StepLabel icon={
              <Box
                sx={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 36, height: 36, borderRadius: '50%',
                  backgroundColor: activeStep > index ? theme.palette.success.main : activeStep === index ? theme.palette.primary.main : theme.palette.divider,
                  color: activeStep >= index ? '#fff' : theme.palette.text.disabled,
                  transition: 'all 0.3s',
                  boxShadow: activeStep === index ? `0 0 0 4px ${alpha(theme.palette.primary.main, 0.2)}` : 'none',
                }}
              >
                {step.icon}
              </Box>
            }>
              {step.label}
            </StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper
        elevation={0}
        sx={{
          p: 4, borderRadius: 4,
          border: `1px solid ${theme.palette.divider}`,
          backgroundColor: theme.palette.background.paper,
        }}
      >
        {renderStepContent(activeStep)}

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, pt: 2, borderTop: `1px solid ${theme.palette.divider}` }}>
          <Button
            disabled={activeStep === 0 || isSubmitting}
            onClick={handleBack}
            sx={{ fontWeight: 700 }}
          >
            Back
          </Button>

          {activeStep === 0 ? (
            <Button
              type="submit"
              form="basic-info-form"
              variant="contained"
              disabled={isSubmitting}
              sx={{ borderRadius: 2.5, px: 5, fontWeight: 700, boxShadow: theme.shadows[2] }}
            >
              {isSubmitting ? <CircularProgress size={24} /> : 'Next →'}
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={isSubmitting || DOC_SLOTS.some((s) => s.required && docStates[s.type].status === 'uploading')}
              onClick={handleFinish}
              sx={{ borderRadius: 2.5, px: 5, fontWeight: 700, boxShadow: theme.shadows[2] }}
            >
              {isSubmitting ? <CircularProgress size={24} /> : 'Finish Onboarding'}
            </Button>
          )}
        </Box>
      </Paper>

      {/* Document Preview Modal */}
      {previewDoc && (
        <Box
          sx={{
            position: 'fixed', inset: 0, zIndex: 9999,
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setPreviewDoc(null)}
        >
          <Paper
            elevation={24}
            onClick={(e) => e.stopPropagation()}
            sx={{ maxWidth: 780, width: '90%', borderRadius: 3, overflow: 'hidden', position: 'relative' }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, py: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle1" fontWeight={700}>{previewDoc.type} Preview</Typography>
              <IconButton size="small" onClick={() => setPreviewDoc(null)}><CloseIcon /></IconButton>
            </Box>
            <Box sx={{ p: 2, minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isImageUrl(previewDoc.url) ? (
                <img src={previewDoc.url} alt="Document preview" style={{ maxWidth: '100%', maxHeight: 480, borderRadius: 8 }} />
              ) : (
                <iframe src={previewDoc.url} title="Document" style={{ width: '100%', height: 480, border: 'none' }} />
              )}
            </Box>
            <Box sx={{ px: 3, py: 2, display: 'flex', justifyContent: 'flex-end', borderTop: `1px solid ${theme.palette.divider}` }}>
              <Button href={previewDoc.url} target="_blank" rel="noopener noreferrer" variant="outlined" sx={{ borderRadius: 2 }}>
                Open in New Tab
              </Button>
            </Box>
          </Paper>
        </Box>
      )}
    </Box>
  );
}
