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
  designation: z.string().optional(),
  joiningDate: z.date().refine((d) => d instanceof Date && !isNaN(d.getTime()), { message: 'Joining date is required' }),
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
      designation: '',
      joiningDate: new Date(),
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
        designation: data.designation || undefined,
        status: 'ACTIVE',
        enrollmentDate: data.joiningDate ? data.joiningDate.toISOString().split('T')[0] : null,
        organizationId: orgId,
        siteId: selectedSiteId,
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
    <Box component="form" id="create-enroll-form" onSubmit={handleSubmit(onBasicInfoSubmit)}>
      {apiError && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: 2 }} onClose={() => setApiError(null)}>
          {apiError}
        </Alert>
      )}
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
          <Controller name="role" control={control} render={({ field }) => (
            <TextField {...field} fullWidth select label="System Role *" variant="outlined"
              error={!!errors.role} helperText={errors.role?.message}
              slotProps={{ input: { sx: { borderRadius: 2 } } }}
            >
              <MenuItem value="EMPLOYEE">Employee</MenuItem>
              <MenuItem value="SUPERVISOR">Supervisor</MenuItem>
              <MenuItem value="ADMIN">Admin</MenuItem>
              <MenuItem value="CLIENT">Client</MenuItem>
            </TextField>
          )} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <Controller name="designation" control={control} render={({ field }) => (
            <TextField {...field} fullWidth label="Designation" placeholder="e.g. Security Guard" variant="outlined"
              helperText="Job title or designation"
              slotProps={{ input: { sx: { borderRadius: 2 } } }}
            />
          )} />
        </Grid>
        <Grid size={{ xs: 12 }}>
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
