import { useState, useRef, useEffect } from 'react';
import {
  Box,
  Typography as MuiTypography,
  Button,
  TextField,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  MenuItem,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  Paper,
  IconButton,
  Tooltip,
  alpha,
  useTheme,
  Switch,
  FormControlLabel,
  Checkbox,
  Accordion,
  AccordionSummary,
  AccordionDetails,
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
  CheckCircle as ApproveIcon,
  Cancel as RejectIcon,
  Fingerprint as FingerprintIcon,
  Work as WorkIcon,
  Height as HeightIcon,
  Home as HomeIcon,
  AccountBalance as AccountBalanceIcon,
  Language as LanguageIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { EmployeeService } from '../../api/employee.service';
import { useAuthStore } from '../../stores/auth.store';

const Typography = MuiTypography as any;

// ── Validation Schema ──────────────────────────────────────────────
const basicInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Enter a valid email address').optional().or(z.literal('')),
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(
      /^(\+91|91)?[6-9]\d{9}$/,
      'Enter a valid phone number (e.g. +919876543210, 919876543210 or 9876543210)'
    ),
  role: z.string().min(1, 'Role is required'),
  joiningDate: z.date().refine((d) => d instanceof Date && !isNaN(d.getTime()), { message: 'Joining date is required' }),
  
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
});

type BasicInfoForm = z.infer<typeof basicInfoSchema>;

// ── Document Slots ─────────────────────────────────────────────────
interface DocSlot {
  type: string;
  label: string;
  required: boolean;
  description: string;
  accept: string;
}

const DOC_SLOTS: DocSlot[] = [
  { type: 'AADHAAR_FRONT', label: 'Aadhaar Card (Front)', required: true, description: 'Front side of Aadhaar card (PDF/JPG/PNG)', accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'AADHAAR_BACK', label: 'Aadhaar Card (Back)', required: true, description: 'Back side of Aadhaar card (PDF/JPG/PNG)', accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'PAN', label: 'PAN Card', required: true, description: 'PAN card image or scanned document', accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'BANK_PASSBOOK', label: 'Bank Passbook / Statement', required: true, description: 'First page of bank passbook or statement', accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'DRIVING_LICENSE', label: 'Driving License', required: false, description: 'Driving license (front & back)', accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'VOTER_ID', label: 'Voter ID', required: false, description: 'Voter identity card', accept: '.pdf,.jpg,.jpeg,.png' },
  { type: 'PASSPORT', label: 'Passport', required: false, description: 'Passport (first & last page)', accept: '.pdf,.jpg,.jpeg,.png' },
];

type DocStatus = 'idle' | 'uploading' | 'done' | 'error';

interface DocState {
  file: File | null;
  status: DocStatus;
  fileUrl: string;
  docId: string;
  errorMsg: string;
  previewUrl: string;
  verificationStatus: 'PENDING' | 'APPROVED' | 'REJECTED' | null;
}

const initDocStates = (): Record<string, DocState> => {
  const initial: Record<string, DocState> = {};
  DOC_SLOTS.forEach((s) => {
    initial[s.type] = { file: null, status: 'idle', fileUrl: '', docId: '', errorMsg: '', previewUrl: '', verificationStatus: null };
  });
  return initial;
};

const STEPS = [
  { label: 'Basic Info', icon: <PersonIcon /> },
  { label: 'Documents', icon: <DocIcon /> },
];

// ── Props ──────────────────────────────────────────────────────────
interface CreateAndEnrollDialogProps {
  open: boolean;
  onClose: () => void;
  selectedSiteId: string | null;
  selectedSiteName: string;
  onSuccess: () => void;
}

// ── Component ──────────────────────────────────────────────────────
export default function CreateAndEnrollDialog({
  open,
  onClose,
  selectedSiteId,
  selectedSiteName,
  onSuccess,
}: CreateAndEnrollDialogProps) {
  const theme = useTheme();
  const user = useAuthStore((state) => state.user);

  const [activeStep, setActiveStep] = useState(0);
  const [createdEmployeeId, setCreatedEmployeeId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [docStates, setDocStates] = useState<Record<string, DocState>>(initDocStates);
  const [previewDoc, setPreviewDoc] = useState<{ url: string; type: string } | null>(null);
  const [verifyingDocId, setVerifyingDocId] = useState<string | null>(null);

  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const {
    control,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BasicInfoForm>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: 'EMPLOYEE',
      joiningDate: new Date(),
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
    },
  });

  // Reset all state when dialog is opened
  useEffect(() => {
    if (open) {
      setActiveStep(0);
      setCreatedEmployeeId(null);
      setApiError(null);
      setDocStates(initDocStates());
      setPreviewDoc(null);
      reset();
    }
  }, [open, reset]);

  // ── Step 1: Create Employee ──────────────────────────────────────
  const onBasicInfoSubmit = async (data: BasicInfoForm) => {
    setIsSubmitting(true);
    setApiError(null);
    try {
      const orgId = user?.organizationId;
      if (!orgId) {
        setApiError('Could not determine your organization. Please contact support.');
        return;
      }
      const payload: any = {
        fullName: `${data.firstName} ${data.lastName}`,
        email: data.email || undefined,
        phone: data.phone,
        role: data.role,
        status: 'ACTIVE',
        enrollmentDate: data.joiningDate ? data.joiningDate.toISOString().split('T')[0] : null,
        organizationId: orgId,
        siteId: selectedSiteId,
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
      };

      const res: any = await EmployeeService.createEmployee(payload);
      const newId = res?.id || res?.data?.id;
      if (newId) {
        setCreatedEmployeeId(newId);
        setActiveStep(1);
      } else {
        setApiError('Employee created but ID was not returned. Please check the employee list.');
        setActiveStep(1);
      }
    } catch (err: any) {
      const errData = err?.code && err?.message ? err : (err?.response?.data?.error || err?.response?.data);
      const status = err?.status || err?.response?.status;
      if (errData?.code === 'DUPLICATE_RESOURCE') {
        setApiError(errData.message || 'An employee with this email or phone already exists.');
      } else if (status === 409) {
        setApiError('An employee with these details already exists.');
      } else {
        setApiError(errData?.message || err?.message || 'Failed to create employee.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ── File Upload ──────────────────────────────────────────────────
  const handleFileSelected = async (docType: string, file: File) => {
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    setDocStates((prev) => ({
      ...prev,
      [docType]: { ...prev[docType], file, status: 'uploading', fileUrl: '', errorMsg: '', previewUrl, verificationStatus: null },
    }));
    try {
      const fileUrl = await EmployeeService.uploadDocumentFile(file);
      if (!fileUrl) throw new Error('No file URL returned from media service.');

      let docId = '';
      if (createdEmployeeId) {
        const docRes: any = await EmployeeService.uploadDocument(createdEmployeeId, docType, fileUrl);
        // Try to capture document ID for later approve/reject
        docId = docRes?.data?.id || docRes?.id || '';
      }

      setDocStates((prev) => ({
        ...prev,
        [docType]: { ...prev[docType], status: 'done', fileUrl, docId, errorMsg: '', previewUrl, verificationStatus: 'PENDING' },
      }));
    } catch (err: any) {
      setDocStates((prev) => ({
        ...prev,
        [docType]: { ...prev[docType], status: 'error', fileUrl: '', docId: '', errorMsg: err?.message || 'Upload failed. Please retry.', previewUrl: '' },
      }));
    }
  };

  // ── Approve / Reject Document ────────────────────────────────────
  const handleVerifyDoc = async (docType: string, approved: boolean) => {
    const state = docStates[docType];
    if (!state.docId) {
      setApiError('Document ID not available for verification. Please re-upload the document.');
      return;
    }
    setVerifyingDocId(state.docId);
    try {
      await EmployeeService.verifyDocument(state.docId, approved, approved ? undefined : 'Rejected by admin during onboarding');
      setDocStates((prev) => ({
        ...prev,
        [docType]: { ...prev[docType], verificationStatus: approved ? 'APPROVED' : 'REJECTED' },
      }));
    } catch (err: any) {
      setApiError(err?.message || 'Document verification failed.');
    } finally {
      setVerifyingDocId(null);
    }
  };

  // ── Finish ───────────────────────────────────────────────────────
  const handleFinish = () => {
    const missing = DOC_SLOTS.filter((s) => s.required && docStates[s.type].status !== 'done');
    if (missing.length > 0) {
      setApiError(`Required documents not uploaded: ${missing.map((s) => s.label).join(', ')}`);
      return;
    }
    onSuccess();
    onClose();
  };

  // ── Utilities ────────────────────────────────────────────────────
  const getDocStatusIcon = (status: DocStatus) => {
    switch (status) {
      case 'done': return <CheckIcon sx={{ color: theme.palette.success.main }} />;
      case 'uploading': return <CircularProgress size={20} />;
      case 'error': return <ErrorIcon sx={{ color: theme.palette.error.main }} />;
      default: return <PendingIcon sx={{ color: theme.palette.text.disabled }} />;
    }
  };

  const getVerificationChip = (docType: string) => {
    const { verificationStatus } = docStates[docType];
    if (!verificationStatus) return null;
    const colorMap: Record<string, 'warning' | 'success' | 'error'> = {
      PENDING: 'warning',
      APPROVED: 'success',
      REJECTED: 'error',
    };
    return (
      <Chip
        label={verificationStatus}
        size="small"
        color={colorMap[verificationStatus]}
        sx={{ fontWeight: 700, fontSize: '0.65rem', height: 20, ml: 1 }}
      />
    );
  };

  const getDocBorderColor = (status: DocStatus, required: boolean) => {
    if (status === 'done') return theme.palette.success.main + '60';
    if (status === 'error') return theme.palette.error.main + '60';
    if (status === 'uploading') return theme.palette.primary.main + '60';
    if (required) return theme.palette.warning.main + '40';
    return theme.palette.divider;
  };

  const isImageUrl = (url: string) => /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url);

  // ── Step Content ─────────────────────────────────────────────────
  const renderBasicInfo = () => (
    <Box component="form" id="create-enroll-form" onSubmit={handleSubmit(onBasicInfoSubmit)} sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {apiError && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setApiError(null)}>
          {apiError}
        </Alert>
      )}
      
      {/* Accordion 1: Basic Information */}
      <Accordion defaultExpanded sx={{ borderRadius: 2, '&:before': { display: 'none' }, boxShadow: 'none', border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03), borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <PersonIcon color="primary" />
            <Typography fontWeight={700}>Basic Information *</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 3 }}>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="firstName" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="First Name *" placeholder="John" variant="outlined"
                  error={!!errors.firstName} helperText={errors.firstName?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="lastName" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Last Name *" placeholder="Doe" variant="outlined"
                  error={!!errors.lastName} helperText={errors.lastName?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="phone" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Phone Number *" placeholder="+919876543210" variant="outlined"
                  error={!!errors.phone}
                  helperText={errors.phone?.message || 'Valid: +919876543210 · 919876543210 · 9876543210'}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="email" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Email Address" placeholder="john@example.com" variant="outlined"
                  error={!!errors.email} helperText={errors.email?.message || 'Optional'}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="dob" control={control} render={({ field }) => (
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
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="gender" control={control} render={({ field }) => (
                <TextField {...field} fullWidth select label="Gender" variant="outlined"
                  error={!!errors.gender} helperText={errors.gender?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                >
                  <MenuItem value=""><em>Select Gender</em></MenuItem>
                  <MenuItem value="Male">Male</MenuItem>
                  <MenuItem value="Female">Female</MenuItem>
                  <MenuItem value="Other">Other</MenuItem>
                </TextField>
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="maritalStatus" control={control} render={({ field }) => (
                <TextField {...field} fullWidth select label="Marital Status" variant="outlined"
                  error={!!errors.maritalStatus} helperText={errors.maritalStatus?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                >
                  <MenuItem value=""><em>Select Marital Status</em></MenuItem>
                  <MenuItem value="Single">Single</MenuItem>
                  <MenuItem value="Married">Married</MenuItem>
                  <MenuItem value="Divorced">Divorced</MenuItem>
                  <MenuItem value="Widowed">Widowed</MenuItem>
                </TextField>
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="bloodGroup" control={control} render={({ field }) => (
                <TextField {...field} fullWidth select label="Blood Group" variant="outlined"
                  error={!!errors.bloodGroup} helperText={errors.bloodGroup?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                >
                  <MenuItem value=""><em>Select Blood Group</em></MenuItem>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                    <MenuItem key={bg} value={bg}>{bg}</MenuItem>
                  ))}
                </TextField>
              )} />
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
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="aadhaar" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Aadhaar Number" placeholder="12-digit number" variant="outlined"
                  error={!!errors.aadhaar} helperText={errors.aadhaar?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').substring(0, 12);
                    field.onChange(val);
                  }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="pan" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="PAN Number" placeholder="ABCDE1234F" variant="outlined"
                  error={!!errors.pan} helperText={errors.pan?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().substring(0, 10);
                    field.onChange(val);
                  }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="education" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Education" placeholder="e.g. High School, Graduate" variant="outlined"
                  error={!!errors.education} helperText={errors.education?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="languagesKnown" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Languages Known" placeholder="e.g. English, Hindi, Marathi" variant="outlined"
                  error={!!errors.languagesKnown} helperText={errors.languagesKnown?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
              )} />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Accordion 3: Work Details */}
      <Accordion sx={{ borderRadius: 2, '&:before': { display: 'none' }, boxShadow: 'none', border: `1px solid ${theme.palette.divider}`, overflow: 'hidden' }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ bgcolor: alpha(theme.palette.primary.main, 0.03), borderBottom: `1px solid ${theme.palette.divider}` }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <WorkIcon color="primary" />
            <Typography fontWeight={700}>Work Details *</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 3 }}>
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="role" control={control} render={({ field }) => (
                <TextField {...field} fullWidth select label="System Role *" variant="outlined"
                  error={!!errors.role} helperText={errors.role?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                >
                  <MenuItem value="EMPLOYEE">Employee</MenuItem>
                  <MenuItem value="SUPERVISOR">Supervisor</MenuItem>
                  <MenuItem value="ADMIN">Admin</MenuItem>
                  <MenuItem value="CLIENT">Client</MenuItem>
                  <MenuItem value="ACCOUNT_TEAM">Account Team</MenuItem>
                  <MenuItem value="COMPLIANCE">Compliance Login</MenuItem>
                </TextField>
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="designation" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Designation" placeholder="e.g. Security Guard" variant="outlined"
                  error={!!errors.designation} helperText={errors.designation?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="joiningDate" control={control} render={({ field }) => (
                <DatePicker
                  label="Joining Date *"
                  value={field.value}
                  onChange={(date) => field.onChange(date)}
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      variant: 'outlined',
                      error: !!errors.joiningDate,
                      helperText: (errors.joiningDate?.message as string) || 'Date this employee joins the site',
                      slotProps: { input: { sx: { borderRadius: 2 } } },
                    },
                  }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="form11Number" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Form 11 Number" placeholder="Form 11" variant="outlined"
                  error={!!errors.form11Number} helperText={errors.form11Number?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="uanNumber" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="UAN Number" placeholder="UAN" variant="outlined"
                  error={!!errors.uanNumber} helperText={errors.uanNumber?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="esicNumber" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="ESIC Number" placeholder="ESIC" variant="outlined"
                  error={!!errors.esicNumber} helperText={errors.esicNumber?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
              <Controller name="policeVerificationStatus" control={control} render={({ field }) => (
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
              )} />
            </Grid>
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
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="heightFeet" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Height (ft)" placeholder="e.g. 5" variant="outlined"
                  error={!!errors.heightFeet} helperText={errors.heightFeet?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    field.onChange(val);
                  }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="heightInches" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Height (in)" placeholder="e.g. 9" variant="outlined"
                  error={!!errors.heightInches} helperText={errors.heightInches?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    field.onChange(val);
                  }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="weightKg" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Weight (kg)" placeholder="e.g. 70" variant="outlined"
                  error={!!errors.weightKg} helperText={errors.weightKg?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9.]/g, '');
                    field.onChange(val);
                  }}
                />
              )} />
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
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="emergencyContactNumber" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Emergency Contact Number" placeholder="10-digit number" variant="outlined"
                  error={!!errors.emergencyContactNumber} helperText={errors.emergencyContactNumber?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '').substring(0, 10);
                    field.onChange(val);
                  }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Controller name="residentialAddress" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Residential Address" placeholder="Address" variant="outlined"
                  error={!!errors.residentialAddress} helperText={errors.residentialAddress?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="city" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="City" placeholder="City" variant="outlined"
                  error={!!errors.city} helperText={errors.city?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="state" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="State" placeholder="State" variant="outlined"
                  error={!!errors.state} helperText={errors.state?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }} sx={{ display: 'flex', alignItems: 'center' }}>
              <Controller name="residentialProofStatus" control={control} render={({ field }) => (
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
              )} />
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
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="bankName" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Bank Name" placeholder="Bank Name" variant="outlined"
                  error={!!errors.bankName} helperText={errors.bankName?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="bankAccountNumber" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Bank Account Number" placeholder="Account Number" variant="outlined"
                  error={!!errors.bankAccountNumber} helperText={errors.bankAccountNumber?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    field.onChange(val);
                  }}
                />
              )} />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Controller name="bankIfscCode" control={control} render={({ field }) => (
                <TextField {...field} fullWidth label="Bank IFSC Code" placeholder="IFSC Code" variant="outlined"
                  error={!!errors.bankIfscCode} helperText={errors.bankIfscCode?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                  onChange={(e) => {
                    const val = e.target.value.toUpperCase().substring(0, 11);
                    field.onChange(val);
                  }}
                />
              )} />
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
          <Grid container spacing={2.5}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Controller name="preferredLang" control={control} render={({ field }) => (
                <TextField {...field} fullWidth select label="Preferred Language" variant="outlined"
                  error={!!errors.preferredLang} helperText={errors.preferredLang?.message}
                  slotProps={{ input: { sx: { borderRadius: 2 } } }}
                >
                  <MenuItem value="en">English</MenuItem>
                  <MenuItem value="hi">Hindi</MenuItem>
                  <MenuItem value="mr">Marathi</MenuItem>
                </TextField>
              )} />
            </Grid>
            <Grid size={{ xs: 12 }} sx={{ display: 'flex', alignItems: 'center' }}>
              <Controller name="termsAndConditionsAccepted" control={control} render={({ field }) => (
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
              )} />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* Site assignment is pre-set, just display it */}
      <Grid size={{ xs: 12 }}>
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: alpha(theme.palette.primary.main, 0.03),
            borderColor: alpha(theme.palette.primary.main, 0.25),
          }}
        >
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5, fontWeight: 700, textTransform: 'uppercase', fontSize: '0.65rem' }}>
            Auto-Enrolled At Site
          </Typography>
          <Typography variant="body2" fontWeight={700} color="primary.main">
            {selectedSiteName}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            This employee will be automatically enrolled at this site upon creation.
          </Typography>
        </Paper>
      </Grid>
    </Box>
  );

  const renderDocuments = () => (
    <Box>
      {apiError && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setApiError(null)}>
          {apiError}
        </Alert>
      )}

      <Box sx={{ mb: 2 }}>
        <Typography variant="subtitle2" fontWeight={800} gutterBottom>
          Upload Identification Documents
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Documents marked with{' '}
          <Chip label="Required" size="small" color="warning" sx={{ mx: 0.5, fontWeight: 700, fontSize: '0.68rem' }} />{' '}
          must be uploaded. You can approve or reject each document after upload.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
        {DOC_SLOTS.map((slot) => {
          const state = docStates[slot.type];
          return (
            <Paper
              key={slot.type}
              variant="outlined"
              sx={{
                p: 2,
                borderRadius: 2.5,
                borderColor: getDocBorderColor(state.status, slot.required),
                transition: 'border-color 0.3s',
                bgcolor: state.status === 'done'
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
                  e.target.value = '';
                }}
              />

              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2 }}>
                {/* Left: info */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.25 }}>
                    {getDocStatusIcon(state.status)}
                    <Typography variant="subtitle2" fontWeight={700} sx={{ fontSize: '0.82rem' }}>
                      {slot.label}
                    </Typography>
                    {slot.required ? (
                      <Chip label="Required" size="small" color="warning" sx={{ fontWeight: 700, fontSize: '0.65rem', height: 18 }} />
                    ) : (
                      <Chip label="Optional" size="small" variant="outlined" sx={{ fontWeight: 600, fontSize: '0.65rem', height: 18 }} />
                    )}
                    {getVerificationChip(slot.type)}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {slot.description}
                  </Typography>

                  {state.status === 'uploading' && (
                    <Box sx={{ mt: 1 }}>
                      <LinearProgress sx={{ borderRadius: 2 }} />
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>Uploading…</Typography>
                    </Box>
                  )}

                  {state.status === 'done' && (
                    <Box sx={{ mt: 0.75, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="caption" sx={{ color: theme.palette.success.main, fontWeight: 600 }}>
                        ✓ {state.file?.name || 'Uploaded'}
                      </Typography>
                      <Tooltip title="Preview Document">
                        <IconButton size="small" onClick={() => setPreviewDoc({ url: state.fileUrl, type: slot.type })}>
                          <ViewIcon fontSize="small" sx={{ color: theme.palette.primary.main }} />
                        </IconButton>
                      </Tooltip>

                      {/* Approve / Reject buttons */}
                      {state.verificationStatus !== 'APPROVED' && (
                        <Tooltip title="Approve Document">
                          <IconButton
                            size="small"
                            disabled={verifyingDocId === state.docId}
                            onClick={() => handleVerifyDoc(slot.type, true)}
                            sx={{ color: theme.palette.success.main }}
                          >
                            {verifyingDocId === state.docId ? <CircularProgress size={16} /> : <ApproveIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      )}
                      {state.verificationStatus !== 'REJECTED' && (
                        <Tooltip title="Reject Document">
                          <IconButton
                            size="small"
                            disabled={verifyingDocId === state.docId}
                            onClick={() => handleVerifyDoc(slot.type, false)}
                            sx={{ color: theme.palette.error.main }}
                          >
                            {verifyingDocId === state.docId ? <CircularProgress size={16} /> : <RejectIcon fontSize="small" />}
                          </IconButton>
                        </Tooltip>
                      )}
                    </Box>
                  )}

                  {state.status === 'error' && (
                    <Alert severity="error" sx={{ mt: 0.75, py: 0.25, borderRadius: 1.5, fontSize: '0.75rem' }}>
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
                    borderRadius: 1.5,
                    textTransform: 'none',
                    fontWeight: 700,
                    minWidth: 100,
                    flexShrink: 0,
                    fontSize: '0.78rem',
                    ...(state.status === 'done' && {
                      color: theme.palette.success.main,
                      borderColor: theme.palette.success.main,
                    }),
                  }}
                >
                  {state.status === 'done' ? 'Replace' : state.status === 'uploading' ? 'Uploading…' : 'Upload'}
                </Button>
              </Box>
            </Paper>
          );
        })}
      </Box>

      {/* Upload Summary */}
      <Box sx={{ mt: 2.5, p: 2, borderRadius: 2.5, bgcolor: alpha(theme.palette.info.main, 0.04), border: `1px solid ${alpha(theme.palette.info.main, 0.15)}` }}>
        <Typography variant="caption" fontWeight={700} color="text.secondary" display="block" sx={{ mb: 1 }}>
          Upload Summary
        </Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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
              sx={{ fontWeight: 600, fontSize: '0.7rem' }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );

  const isAnyDocUploading = DOC_SLOTS.some((s) => docStates[s.type].status === 'uploading');

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" scroll="paper">
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Box>
            <Typography variant="h6" fontWeight={800} component="div">
              Onboard & Enroll New Employee
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block">
              Creating employee for site: <strong>{selectedSiteName}</strong>
            </Typography>
          </Box>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        {/* Stepper Header */}
        <Box sx={{ px: 3, py: 1.5, borderBottom: `1px solid ${useTheme().palette.divider}` }}>
          <Stepper
            activeStep={activeStep}
            sx={{
              '& .MuiStepLabel-label': { fontWeight: 600, fontSize: '0.82rem' },
              '& .MuiStepIcon-root.Mui-active': { color: 'primary.main' },
              '& .MuiStepIcon-root.Mui-completed': { color: 'success.main' },
            }}
          >
            {STEPS.map((step, i) => (
              <Step key={step.label}>
                <StepLabel
                  icon={
                    <Box sx={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      width: 32, height: 32, borderRadius: '50%',
                      bgcolor: activeStep > i ? 'success.main' : activeStep === i ? 'primary.main' : 'divider',
                      color: activeStep >= i ? '#fff' : 'text.disabled',
                      transition: 'all 0.3s',
                      boxShadow: activeStep === i ? `0 0 0 4px ${alpha(theme.palette.primary.main, 0.2)}` : 'none',
                    }}>
                      {activeStep > i ? <DoneIcon sx={{ fontSize: 18 }} /> : step.icon}
                    </Box>
                  }
                >
                  {step.label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>
        </Box>

        <DialogContent sx={{ px: 3, py: 2.5 }}>
          {activeStep === 0 ? renderBasicInfo() : renderDocuments()}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: `1px solid ${theme.palette.divider}`, gap: 1 }}>
          {activeStep === 1 && (
            <Button
              onClick={() => { setApiError(null); setActiveStep(0); }}
              sx={{ fontWeight: 700 }}
            >
              ← Back
            </Button>
          )}
          <Box sx={{ flex: 1 }} />
          <Button onClick={onClose} sx={{ fontWeight: 700 }}>
            Cancel
          </Button>
          {activeStep === 0 ? (
            <Button
              type="submit"
              form="create-enroll-form"
              variant="contained"
              disabled={isSubmitting}
              sx={{ fontWeight: 700, borderRadius: 2, px: 4 }}
            >
              {isSubmitting ? <CircularProgress size={22} /> : 'Next: Upload Documents →'}
            </Button>
          ) : (
            <Button
              variant="contained"
              disabled={isSubmitting || isAnyDocUploading}
              onClick={handleFinish}
              sx={{ fontWeight: 700, borderRadius: 2, px: 4, bgcolor: 'success.main', '&:hover': { bgcolor: 'success.dark' } }}
            >
              {isSubmitting ? <CircularProgress size={22} /> : '✓ Finish & Enroll'}
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Document Preview Modal */}
      {previewDoc && (
        <Box
          sx={{
            position: 'fixed', inset: 0, zIndex: 10000,
            backgroundColor: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={() => setPreviewDoc(null)}
        >
          <Paper
            elevation={24}
            onClick={(e) => e.stopPropagation()}
            sx={{ maxWidth: 800, width: '90%', borderRadius: 3, overflow: 'hidden', position: 'relative' }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 3, py: 2, borderBottom: `1px solid ${theme.palette.divider}` }}>
              <Typography variant="subtitle1" fontWeight={700}>{previewDoc.type} — Document Preview</Typography>
              <IconButton size="small" onClick={() => setPreviewDoc(null)}><CloseIcon /></IconButton>
            </Box>
            <Box sx={{ p: 2, minHeight: 300, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {isImageUrl(previewDoc.url) ? (
                <img src={previewDoc.url} alt="Document preview" style={{ maxWidth: '100%', maxHeight: 480, borderRadius: 8 }} />
              ) : (
                <iframe src={previewDoc.url} title="Document preview" style={{ width: '100%', height: 480, border: 'none' }} />
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
    </>
  );
}
