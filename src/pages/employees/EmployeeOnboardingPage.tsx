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
  Switch,
  FormControlLabel,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Avatar,
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
  Fingerprint as FingerprintIcon,
  Work as WorkIcon,
  Height as HeightIcon,
  Home as HomeIcon,
  AccountBalance as AccountBalanceIcon,
  Language as LanguageIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { EmployeeService } from '../../api/employee.service';
import { useAuthStore } from '../../stores/auth.store';
import apiClient from '../../api/client';
import ratnamLogo from '../../assets/ratnam.png';
import { normalizeUrl } from '../../utils/url';

const Typography = MuiTypography as any;

const basicInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().regex(/^\+91 \d{10}$/, 'Phone must be +91 followed by 10 digits'),
  role: z.string(),
  joiningDate: z.date(),
  organizationId: z.string().optional(),
  siteId: z.string().optional(),
  
  // New fields
  dob: z.date().nullable().optional(),
  gender: z.string().optional(),
  maritalStatus: z.string().optional(),
  bloodGroup: z.string().optional(),
  aadhaar: z.string().regex(/^\d{12}$/, 'Aadhaar must be exactly 12 digits').optional().or(z.literal('')),
  pan: z.string().regex(/^[A-Z]{5}\d{4}[A-Z]$/i, 'Invalid PAN format').optional().or(z.literal('')),
  education: z.string().optional(),
  languagesKnown: z.string().optional(),
  designation: z.string().optional(),
  form11Number: z.string().optional(),
  uanNumber: z.string().optional(),
  esicNumber: z.string().optional(),
  policeVerificationStatus: z.boolean().optional(),
  heightFeet: z.string().regex(/^\d*$/, 'Must be a number').optional().or(z.literal('')),
  heightInches: z.string().regex(/^\d*$/, 'Must be a number').optional().or(z.literal('')),
  weightKg: z.string().regex(/^\d*\.?\d*$/, 'Must be a number').optional().or(z.literal('')),
  emergencyContactNumber: z.string().regex(/^\d{10}$/, 'Emergency contact must be 10 digits').optional().or(z.literal('')),
  residentialAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  residentialProofStatus: z.boolean().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().regex(/^\d*$/, 'Must be a number').optional().or(z.literal('')),
  bankIfscCode: z.string().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, 'Invalid IFSC format').optional().or(z.literal('')),
  preferredLang: z.string().optional(),
  termsAndConditionsAccepted: z.boolean().optional(),
  photoUrl: z.string().optional().or(z.literal('')),
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
  const isSupervisor = user?.role === 'SUPERVISOR';

  const [activeStep, setActiveStep] = useState(0);
  const [createdEmployeeId, setCreatedEmployeeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPhotoUploading, setIsPhotoUploading] = useState(false);
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

  const { control, handleSubmit, watch, formState: { errors }, reset, setValue, getValues } = useForm<BasicInfoSchema>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '+91 ',
      role: 'EMPLOYEE',
      joiningDate: new Date(),
      organizationId: '',
      siteId: '',
      dob: null,
      gender: '',
      maritalStatus: '',
      bloodGroup: '',
      aadhaar: '',
      pan: '',
      education: '',
      languagesKnown: '',
      designation: '',
      form11Number: '',
      uanNumber: '',
      esicNumber: '',
      policeVerificationStatus: false,
      heightFeet: '',
      heightInches: '',
      weightKg: '',
      emergencyContactNumber: '',
      residentialAddress: '',
      city: '',
      state: '',
      residentialProofStatus: false,
      bankName: '',
      bankAccountNumber: '',
      bankIfscCode: '',
      preferredLang: 'en',
      termsAndConditionsAccepted: false,
      photoUrl: ratnamLogo,
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
    setApiError(null);
    const selectedOrgId = user?.role === 'SUPER_ADMIN' ? data.organizationId : user?.organizationId;
    if (!selectedOrgId) {
      setApiError('Organization selection is required.');
      return;
    }
    setActiveStep(1);
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

    setIsSubmitting(true);
    setApiError(null);

    try {
      const data = getValues();
      const selectedOrgId = user?.role === 'SUPER_ADMIN' ? data.organizationId : user?.organizationId;
      if (!selectedOrgId) {
        setApiError('Organization selection is required.');
        setIsSubmitting(false);
        return;
      }

      const payload: any = {
        fullName: `${data.firstName} ${data.lastName}`,
        email: data.email || undefined,
        phone: data.phone.replace(/\s+/g, ''),
        role: data.role,
        status: 'ACTIVE',
        enrollmentDate: data.joiningDate ? data.joiningDate.toISOString().split('T')[0] : null,
        organizationId: selectedOrgId,
        dob: data.dob ? data.dob.toISOString().split('T')[0] : null,
        dateOfBirth: data.dob ? data.dob.toISOString().split('T')[0] : null,
        gender: data.gender || undefined,
        maritalStatus: data.maritalStatus || undefined,
        bloodGroup: data.bloodGroup || undefined,
        aadhaar: data.aadhaar || undefined,
        pan: data.pan ? data.pan.toUpperCase() : undefined,
        education: data.education || undefined,
        languagesKnown: data.languagesKnown || undefined,
        designation: data.designation || undefined,
        form11Number: data.form11Number || undefined,
        uanNumber: data.uanNumber || undefined,
        esicNumber: data.esicNumber || undefined,
        policeVerificationStatus: data.policeVerificationStatus || false,
        heightFeet: (data.heightFeet && !isNaN(parseInt(data.heightFeet))) ? parseInt(data.heightFeet) : null,
        heightInches: (data.heightInches && !isNaN(parseInt(data.heightInches))) ? parseInt(data.heightInches) : null,
        weightKg: (data.weightKg && !isNaN(parseFloat(data.weightKg))) ? parseFloat(data.weightKg) : null,
        emergencyContactNumber: data.emergencyContactNumber || undefined,
        residentialAddress: data.residentialAddress || undefined,
        city: data.city || undefined,
        state: data.state || undefined,
        residentialProofStatus: data.residentialProofStatus || false,
        bankName: data.bankName || undefined,
        bankAccountNumber: data.bankAccountNumber || undefined,
        bankIfscCode: data.bankIfscCode ? data.bankIfscCode.toUpperCase() : undefined,
        preferredLang: data.preferredLang || 'en',
        termsAndConditionsAccepted: data.termsAndConditionsAccepted || false,
        photoUrl: data.photoUrl || null,
      };
      // Only include siteId if one was selected
      if (data.siteId) payload.siteId = data.siteId;

      let employeeId = createdEmployeeId;

      if (!employeeId) {
        // Create new employee
        const res = await EmployeeService.createEmployee(payload);
        const newEmployeeId = (res as any).id || (res as any).data?.id || (res as any).data?.data?.id;
        if (!newEmployeeId) {
          throw new Error('Failed to retrieve new employee ID.');
        }
        employeeId = newEmployeeId;
        setCreatedEmployeeId(employeeId);
      } else {
        // Update existing employee (if we are retrying onboarding after doc upload failure)
        await EmployeeService.updateEmployee(employeeId, payload);
      }

      // Upload and register all documents that are done
      const uploadPromises = Object.entries(docStates)
        .filter(([_, state]) => state.status === 'done' && state.fileUrl)
        .map(([docType, state]) =>
          EmployeeService.uploadDocument(employeeId!, docType, state.fileUrl)
        );

      await Promise.all(uploadPromises);
      setActiveStep(steps.length);
    } catch (error: any) {
      const errData = (error.code && error.message) ? error : (error.response?.data?.error || error.response?.data);
      const status = error.status || error.response?.status;
      if (errData?.code === 'DUPLICATE_RESOURCE') {
        setApiError(errData.message || 'An employee with this email or phone already exists.');
      } else if (status === 409) {
        setApiError('An employee with these details already exists.');
      } else {
        setApiError(errData?.message || error.message || 'Failed to complete onboarding.');
      }
    } finally {
      setIsSubmitting(false);
    }
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
          <Box component="form" id="basic-info-form" onSubmit={handleSubmit(onBasicInfoSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {apiError && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setApiError(null)}>
                {apiError}
              </Alert>
            )}

            {/* Accordion 1: Basic Information */}
            <Accordion defaultExpanded sx={{ borderRadius: 2, '&:before': { display: 'none' }, boxShadow: 'none', border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03), borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <PersonIcon color="primary" />
                  <Typography fontWeight={700}>Basic Information</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 3 }}>
                <Grid container spacing={3}>
                  {/* Profile Photo Upload */}
                  <Grid size={{ xs: 12 }} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 2 }}>
                    <Controller
                      name="photoUrl"
                      control={control}
                      render={({ field }) => {
                        const initials = (watch('firstName') || watch('lastName'))
                          ? `${watch('firstName')?.[0] || ''}${watch('lastName')?.[0] || ''}`.toUpperCase()
                          : '?';
                        return (
                          <Box sx={{ position: 'relative', display: 'inline-block' }}>
                            <input
                              type="file"
                              accept="image/*"
                              id="onboard-profile-photo-input"
                              style={{ display: 'none' }}
                              onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;
                                setIsPhotoUploading(true);
                                try {
                                  const url = await EmployeeService.uploadDocumentFile(file);
                                  field.onChange(url);
                                } catch (err: any) {
                                  alert('Failed to upload photo: ' + (err.message || 'Unknown error'));
                                } finally {
                                  setIsPhotoUploading(false);
                                }
                              }}
                            />
                            <label htmlFor="onboard-profile-photo-input">
                              <Tooltip title="Upload Profile Photo">
                                <Box sx={{
                                  position: 'relative',
                                  cursor: 'pointer',
                                  borderRadius: '50%',
                                  overflow: 'hidden',
                                  width: 100,
                                  height: 100,
                                  border: `3px solid ${theme.palette.primary.main}`,
                                  '&:hover .upload-overlay': {
                                    opacity: 1
                                  }
                                }}>
                                  <Avatar
                                    src={normalizeUrl(field.value)}
                                    sx={{
                                      width: '100%',
                                      height: '100%',
                                      fontSize: '2.5rem',
                                      fontWeight: 700,
                                      bgcolor: 'grey.200',
                                      color: 'text.secondary'
                                    }}
                                  >
                                    {initials}
                                  </Avatar>
                                  
                                  {/* Upload Hover Overlay */}
                                  <Box className="upload-overlay" sx={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    bgcolor: 'rgba(0,0,0,0.5)',
                                    color: 'common.white',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    opacity: 0,
                                    transition: 'opacity 0.2s ease-in-out',
                                  }}>
                                    <UploadIcon fontSize="small" />
                                    <Typography variant="caption" sx={{ fontSize: '0.65rem', mt: 0.5, fontWeight: 600 }}>
                                      UPLOAD
                                    </Typography>
                                  </Box>

                                  {/* Uploading Spinner */}
                                  {isPhotoUploading && (
                                    <Box sx={{
                                      position: 'absolute',
                                      top: 0,
                                      left: 0,
                                      width: '100%',
                                      height: '100%',
                                      bgcolor: 'rgba(0,0,0,0.6)',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                    }}>
                                      <CircularProgress size={28} />
                                    </Box>
                                  )}
                                </Box>
                              </Tooltip>
                            </label>
                          </Box>
                        );
                      }}
                    />
                  </Grid>

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
                          onChange={(e) => {
                            let val = e.target.value;
                            if (!val.startsWith('+91 ')) {
                              if (val.startsWith('+91')) {
                                val = '+91 ' + val.substring(3).trim();
                              } else if (val.startsWith('+')) {
                                val = '+91 ' + val.substring(1).replace(/\D/g, '');
                              } else {
                                val = '+91 ' + val.replace(/\D/g, '');
                              }
                            }
                            let digits = val.substring(4).replace(/\D/g, '');
                            if (digits.length > 10) digits = digits.substring(0, 10);
                            field.onChange('+91 ' + digits);
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="dob"
                      control={control}
                      render={({ field }) => (
                        <DatePicker
                          label="Date of Birth"
                          value={field.value}
                          onChange={(date) => field.onChange(date)}
                          slotProps={{
                            textField: {
                              fullWidth: true, variant: 'outlined',
                              error: !!errors.dob,
                              helperText: errors.dob?.message,
                              slotProps: { input: { sx: { borderRadius: 2 } } }
                            }
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="gender"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth select label="Gender" variant="outlined"
                          error={!!errors.gender} helperText={errors.gender?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                        >
                          <MenuItem value=""><em>Select Gender</em></MenuItem>
                          <MenuItem value="Male">Male</MenuItem>
                          <MenuItem value="Female">Female</MenuItem>
                          <MenuItem value="Other">Other</MenuItem>
                        </TextField>
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="maritalStatus"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth select label="Marital Status" variant="outlined"
                          error={!!errors.maritalStatus} helperText={errors.maritalStatus?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                        >
                          <MenuItem value=""><em>Select Marital Status</em></MenuItem>
                          <MenuItem value="Single">Single</MenuItem>
                          <MenuItem value="Married">Married</MenuItem>
                          <MenuItem value="Divorced">Divorced</MenuItem>
                          <MenuItem value="Widowed">Widowed</MenuItem>
                        </TextField>
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="bloodGroup"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth select label="Blood Group" variant="outlined"
                          error={!!errors.bloodGroup} helperText={errors.bloodGroup?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                        >
                          <MenuItem value=""><em>Select Blood Group</em></MenuItem>
                          {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                            <MenuItem key={bg} value={bg}>{bg}</MenuItem>
                          ))}
                        </TextField>
                      )}
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Accordion 2: Identity & Education */}
            <Accordion sx={{ borderRadius: 2, '&:before': { display: 'none' }, boxShadow: 'none', border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03), borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <FingerprintIcon color="primary" />
                  <Typography fontWeight={700}>Identity & Education</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 3 }}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="aadhaar"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="Aadhaar Number" placeholder="12-digit number" variant="outlined"
                          error={!!errors.aadhaar} helperText={errors.aadhaar?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').substring(0, 12);
                            field.onChange(val);
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="pan"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="PAN Number" placeholder="ABCDE1234F" variant="outlined"
                          error={!!errors.pan} helperText={errors.pan?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase().substring(0, 10);
                            field.onChange(val);
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="education"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="Education" placeholder="e.g. High School, Graduate" variant="outlined"
                          error={!!errors.education} helperText={errors.education?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="languagesKnown"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="Languages Known" placeholder="e.g. English, Hindi, Marathi" variant="outlined"
                          error={!!errors.languagesKnown} helperText={errors.languagesKnown?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Accordion 3: Work Details */}
            <Accordion sx={{ borderRadius: 2, '&:before': { display: 'none' }, boxShadow: 'none', border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03), borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <WorkIcon color="primary" />
                  <Typography fontWeight={700}>Work Details</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 3 }}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="role"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth select label="Role" variant="outlined"
                          error={!!errors.role} helperText={errors.role?.message}
                          disabled={isSupervisor}
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
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="designation"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="Designation" placeholder="e.g. Security Guard" variant="outlined"
                          error={!!errors.designation} helperText={errors.designation?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="form11Number"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="Form 11 Number" placeholder="Form 11" variant="outlined"
                          error={!!errors.form11Number} helperText={errors.form11Number?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="uanNumber"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="UAN Number" placeholder="UAN" variant="outlined"
                          error={!!errors.uanNumber} helperText={errors.uanNumber?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="esicNumber"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="ESIC Number" placeholder="ESIC" variant="outlined"
                          error={!!errors.esicNumber} helperText={errors.esicNumber?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
                    <Controller
                      name="policeVerificationStatus"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={
                            <Switch
                              checked={!!field.value}
                              onChange={(e) => field.onChange(e.target.checked)}
                              color="primary"
                            />
                          }
                          label="Police Verification Status"
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

                  {!isSupervisor && (
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
                  )}
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Accordion 4: Physical Attributes */}
            <Accordion sx={{ borderRadius: 2, '&:before': { display: 'none' }, boxShadow: 'none', border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03), borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <HeightIcon color="primary" />
                  <Typography fontWeight={700}>Physical Attributes</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 3 }}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Controller
                      name="heightFeet"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="Height (ft)" placeholder="e.g. 5" variant="outlined"
                          error={!!errors.heightFeet} helperText={errors.heightFeet?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            field.onChange(val);
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Controller
                      name="heightInches"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="Height (in)" placeholder="e.g. 9" variant="outlined"
                          error={!!errors.heightInches} helperText={errors.heightInches?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            field.onChange(val);
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Controller
                      name="weightKg"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="Weight (kg)" placeholder="e.g. 70" variant="outlined"
                          error={!!errors.weightKg} helperText={errors.weightKg?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                          onChange={(e) => {
                            const val = e.target.value.replace(/[^0-9.]/g, '');
                            field.onChange(val);
                          }}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Accordion 5: Contact & Address */}
            <Accordion sx={{ borderRadius: 2, '&:before': { display: 'none' }, boxShadow: 'none', border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03), borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <HomeIcon color="primary" />
                  <Typography fontWeight={700}>Contact & Address</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 3 }}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="emergencyContactNumber"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="Emergency Contact Number" placeholder="10-digit number" variant="outlined"
                          error={!!errors.emergencyContactNumber} helperText={errors.emergencyContactNumber?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '').substring(0, 10);
                            field.onChange(val);
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <Controller
                      name="residentialAddress"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="Residential Address" placeholder="Address" variant="outlined"
                          error={!!errors.residentialAddress} helperText={errors.residentialAddress?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="city"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="City" placeholder="City" variant="outlined"
                          error={!!errors.city} helperText={errors.city?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="state"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="State" placeholder="State" variant="outlined"
                          error={!!errors.state} helperText={errors.state?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
                    <Controller
                      name="residentialProofStatus"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={
                            <Switch
                              checked={!!field.value}
                              onChange={(e) => field.onChange(e.target.checked)}
                              color="primary"
                            />
                          }
                          label="Residential Proof Status"
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Accordion 6: Bank Details */}
            <Accordion sx={{ borderRadius: 2, '&:before': { display: 'none' }, boxShadow: 'none', border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03), borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <AccountBalanceIcon color="primary" />
                  <Typography fontWeight={700}>Bank Details</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 3 }}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Controller
                      name="bankName"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="Bank Name" placeholder="Bank Name" variant="outlined"
                          error={!!errors.bankName} helperText={errors.bankName?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Controller
                      name="bankAccountNumber"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="Bank Account Number" placeholder="Account Number" variant="outlined"
                          error={!!errors.bankAccountNumber} helperText={errors.bankAccountNumber?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            field.onChange(val);
                          }}
                        />
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <Controller
                      name="bankIfscCode"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth label="Bank IFSC Code" placeholder="IFSC Code" variant="outlined"
                          error={!!errors.bankIfscCode} helperText={errors.bankIfscCode?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                          onChange={(e) => {
                            const val = e.target.value.toUpperCase().substring(0, 11);
                            field.onChange(val);
                          }}
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>

            {/* Accordion 7: Preferences & Legal */}
            <Accordion sx={{ borderRadius: 2, '&:before': { display: 'none' }, boxShadow: 'none', border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03), borderBottom: `1px solid ${theme.palette.divider}` }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <LanguageIcon color="primary" />
                  <Typography fontWeight={700}>Preferences</Typography>
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 3 }}>
                <Grid container spacing={3}>
                  <Grid size={{ xs: 12, md: 6 }}>
                    <Controller
                      name="preferredLang"
                      control={control}
                      render={({ field }) => (
                        <TextField
                          {...field}
                          fullWidth select label="Preferred Language" variant="outlined"
                          error={!!errors.preferredLang} helperText={errors.preferredLang?.message}
                          slotProps={{ input: { sx: { borderRadius: 2 } } }}
                        >
                          <MenuItem value="en">English</MenuItem>
                          <MenuItem value="hi">Hindi</MenuItem>
                          <MenuItem value="mr">Marathi</MenuItem>
                        </TextField>
                      )}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }} sx={{ display: 'flex', alignItems: 'center' }}>
                    <Controller
                      name="termsAndConditionsAccepted"
                      control={control}
                      render={({ field }) => (
                        <FormControlLabel
                          control={
                            <Checkbox
                              checked={!!field.value}
                              onChange={(e) => field.onChange(e.target.checked)}
                              color="primary"
                            />
                          }
                          label="Accept Terms and Conditions"
                        />
                      )}
                    />
                  </Grid>
                </Grid>
              </AccordionDetails>
            </Accordion>
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
