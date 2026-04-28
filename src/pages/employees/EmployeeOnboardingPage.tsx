import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
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
} from '@mui/material';
import {
  Person as PersonIcon,
  Description as DocIcon,
  CheckCircle as DoneIcon,
  CloudUpload as UploadIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { EmployeeService } from '../../api/employee.service';
import { useAuthStore } from '../../stores/auth.store';

const basicInfoSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: z.string().email('Invalid email').optional().or(z.literal('')),
  phone: z.string().min(10, 'Phone is required'),
  role: z.string(),
  joiningDate: z.date(),
});

type BasicInfoSchema = z.infer<typeof basicInfoSchema>;

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('AADHAAR');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form for Basic Info
  const { control, handleSubmit, formState: { errors }, reset } = useForm<BasicInfoSchema>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      role: 'EMPLOYEE',
      joiningDate: new Date(),
    }
  });

  const handleNext = () => {
    setApiError(null);
    setActiveStep((prevActiveStep) => prevActiveStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1);
  };

  const onBasicInfoSubmit = async (data: BasicInfoSchema) => {
    setIsSubmitting(true);
    setApiError(null);
    try {
      const payload = {
        fullName: `${data.firstName} ${data.lastName}`,
        email: data.email,
        phone: data.phone,
        role: data.role,
        status: 'ACTIVE',
        joiningDate: data.joiningDate.toISOString(),
        organizationId: user?.organizationId,
      };
      
      const res = await EmployeeService.createEmployee(payload);
      
      // apiClient response interceptor unwraps the response. 
      // It might be directly the object, or wrapped in a data field.
      const newEmployeeId = (res as any).id || (res as any).data?.id;
      
      if (newEmployeeId) {
         setCreatedEmployeeId(newEmployeeId);
         handleNext();
      } else {
         console.warn("Could not find ID in response:", res);
         // Fallback if structure is different
         handleNext();
      }
    } catch (error: any) {
      console.error("Failed to create employee", error);
      // The Axios interceptor unwraps the error, so `error` may directly be the backend error object
      const errData = (error.code && error.message) ? error : (error.response?.data?.error || error.response?.data);
      const status = error.status || error.response?.status;
      
      if (errData && errData.code) {
        switch (errData.code) {
          case 'DUPLICATE_RESOURCE':
            setApiError(errData.message || 'An employee with this email or phone already exists.');
            break;
          case 'VALIDATION_ERROR':
            setApiError(`Validation failed: ${errData.message || 'Please check your input.'}`);
            break;
          case 'AUTH_UNAUTHORIZED':
            setApiError('You do not have permission to perform this action.');
            break;
          case 'SERVER_ERROR':
            setApiError('A server error occurred while creating the employee. Please try again later.');
            break;
          default:
            setApiError(errData.message || 'Failed to create employee. Please try again.');
        }
      } else if (status === 409) {
        setApiError('An employee with these details already exists.');
      } else {
        setApiError(error.message || 'Failed to create employee. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Simulated Document Upload
  const handleDocumentUpload = async () => {
    if (!createdEmployeeId) {
      setApiError("Employee was not created properly. Please start over.");
      return;
    }
    setIsSubmitting(true);
    setApiError(null);
    try {
      await EmployeeService.uploadDocument(createdEmployeeId, documentType, 'https://example.com/dummy-doc.pdf');
      handleNext();
    } catch (error: any) {
      console.error("Failed to upload document", error);
      const errData = (error.code && error.message) ? error : (error.response?.data?.error || error.response?.data);
      setApiError(errData?.message || 'Failed to upload document. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
                      fullWidth 
                      label="First Name" 
                      placeholder="John" 
                      variant="outlined" 
                      error={!!errors.firstName}
                      helperText={errors.firstName?.message}
                      sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
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
                      fullWidth 
                      label="Last Name" 
                      placeholder="Doe" 
                      variant="outlined" 
                      error={!!errors.lastName}
                      helperText={errors.lastName?.message}
                      sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
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
                      fullWidth 
                      label="Email" 
                      placeholder="john.doe@example.com" 
                      variant="outlined"
                      error={!!errors.email}
                      helperText={errors.email?.message}
                      sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
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
                      fullWidth 
                      label="Phone" 
                      placeholder="+91 98765 43210" 
                      variant="outlined"
                      error={!!errors.phone}
                      helperText={errors.phone?.message}
                      sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
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
                      fullWidth 
                      select 
                      label="Role" 
                      variant="outlined"
                      error={!!errors.role}
                      helperText={errors.role?.message}
                      sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
                    >
                      <MenuItem value="EMPLOYEE">Employee</MenuItem>
                      <MenuItem value="SUPERVISOR">Supervisor</MenuItem>
                      <MenuItem value="ADMIN">Admin</MenuItem>
                      <MenuItem value="SUPER_ADMIN">Super Admin</MenuItem>
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
                          fullWidth: true, 
                          variant: 'outlined',
                          error: !!errors.joiningDate,
                          helperText: errors.joiningDate?.message,
                          sx: { '& .MuiInputBase-root': { borderRadius: 2 } }
                        } 
                      }}
                    />
                  )}
                />
              </Grid>
            </Grid>
          </Box>
        );
      case 1:
        return (
          <Box sx={{ py: 4, textAlign: 'center' }}>
            {apiError && (
              <Alert severity="error" sx={{ mb: 3, borderRadius: 2, textAlign: 'left' }} onClose={() => setApiError(null)}>
                {apiError}
              </Alert>
            )}
            
            <Box sx={{ mb: 4, textAlign: 'left' }}>
              <TextField
                select
                fullWidth
                label="Document Type"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                variant="outlined"
                sx={{ '& .MuiInputBase-root': { borderRadius: 2 } }}
              >
                <MenuItem value="AADHAAR">Aadhaar</MenuItem>
                <MenuItem value="PAN">PAN</MenuItem>
                <MenuItem value="RATION_CARD">Ration Card</MenuItem>
                <MenuItem value="VOTER_ID">Voter ID</MenuItem>
                <MenuItem value="DRIVING_LICENSE">Driving License</MenuItem>
                <MenuItem value="PASSPORT">Passport</MenuItem>
                <MenuItem value="BANK_PASSBOOK">Bank Passbook</MenuItem>
                <MenuItem value="OTHER">Other</MenuItem>
              </TextField>
            </Box>

            <Box
              onClick={() => fileInputRef.current?.click()}
              sx={{
                p: 6,
                border: `2px dashed ${alpha(theme.palette.primary.main, 0.2)}`,
                borderRadius: 4,
                backgroundColor: alpha(theme.palette.primary.main, 0.02),
                cursor: 'pointer',
                transition: 'all 0.2s',
                '&:hover': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.05),
                  borderColor: theme.palette.primary.main,
                },
              }}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                style={{ display: 'none' }} 
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    setSelectedFile(e.target.files[0]);
                  }
                }} 
              />
              <UploadIcon sx={{ fontSize: 48, color: theme.palette.primary.main, mb: 2 }} />
              <Typography variant="h6" fontWeight={700}>
                {selectedFile ? 'Document Selected' : 'Upload Identification Documents'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {selectedFile ? selectedFile.name : 'Upload Aadhaar, PAN or Voter ID (PDF/JPG)'}
              </Typography>
              <Button 
                variant="outlined" 
                sx={{ mt: 3, borderRadius: 2 }} 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  fileInputRef.current?.click(); 
                }}
              >
                {selectedFile ? 'Change File' : 'Select Files'}
              </Button>
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  if (activeStep === steps.length) {
    return (
      <Paper
        elevation={0}
        sx={{
          p: 6,
          mt: 4,
          borderRadius: 6,
          textAlign: 'center',
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <DoneIcon sx={{ fontSize: 64, color: theme.palette.success.main, mb: 2 }} />
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Onboarding Complete!
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          The employee has been successfully registered and their credentials have been generated.
        </Typography>

        <Alert severity="info" sx={{ mb: 4, textAlign: 'left', borderRadius: 2, border: `1px solid ${alpha(theme.palette.info.main, 0.3)}` }}>
          <Typography variant="subtitle2" fontWeight={700} gutterBottom>Action Required: Face Enrollment</Typography>
          <Typography variant="body2">
            The mandatory multi-pose face enrollment must be completed via the Android Application. 
            An Administrator should log into the mobile app, navigate to the employee list, and complete the "Enroll Face" workflow.
          </Typography>
        </Alert>
        <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center' }}>
          <Button variant="contained" onClick={() => {
            setActiveStep(0);
            setCreatedEmployeeId(null);
            setSelectedFile(null);
            reset();
          }} sx={{ borderRadius: 2, px: 4 }}>
            Onboard Another
          </Button>
          <Button variant="outlined" onClick={() => navigate('/employees')} sx={{ borderRadius: 2, px: 4 }}>
            Back to Employees
          </Button>
        </Box>
      </Paper>
    );
  }

  return (
    <Box sx={{ p: 3, maxWidth: 800, mx: 'auto' }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" fontWeight={800} gutterBottom>
          Onboard New Employee
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Follow the steps to register a new employee in the system
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
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  backgroundColor: activeStep >= index ? theme.palette.primary.main : theme.palette.divider,
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
          p: 4,
          borderRadius: 4,
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
              sx={{ borderRadius: 2, px: 4, fontWeight: 700, boxShadow: theme.shadows[2] }}
            >
              {isSubmitting ? <CircularProgress size={24} /> : 'Next'}
            </Button>
          ) : (
             <Button
               variant="contained"
               disabled={isSubmitting}
               onClick={handleDocumentUpload}
               sx={{ borderRadius: 2, px: 4, fontWeight: 700, boxShadow: theme.shadows[2] }}
             >
               {isSubmitting ? <CircularProgress size={24} /> : 'Finish'}
             </Button>
          )}
        </Box>
      </Paper>
    </Box>
  );
}
