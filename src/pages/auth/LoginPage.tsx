import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Button, 
  TextField, 
  Typography, 
  Container, 
  Paper, 
  InputAdornment, 
  IconButton,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Fade,
  Stack,
  useTheme,
  alpha
} from '@mui/material';
import { 
  Email as EmailIcon, 
  Lock as LockIcon, 
  Visibility, 
  VisibilityOff,
  Business as BusinessIcon,
  PhoneAndroid as PhoneIcon
} from '@mui/icons-material';
import { useAuthStore } from '../../stores/auth.store';
import { Logo } from '../../components/common';


const LoginPage: React.FC = () => {
  const theme = useTheme();
  const [loginMode, setLoginMode] = useState<'password' | 'otp'>('otp');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Timer for Resend OTP
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<any>(null);

  const { login, requestOtp, verifyOtp } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (timer > 0) {
      timerRef.current = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
    } else if (timer === 0 && timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timer]);

  // Auto-submit OTP when 6 digits are reached
  useEffect(() => {
    if (otp.length === 6 && loginMode === 'otp' && otpSent) {
      handleVerifyOtp();
    }
  }, [otp]);

  const handleModeChange = (_: React.SyntheticEvent, newValue: 'password' | 'otp') => {
    setLoginMode(newValue);
    setError(null);
    setOtpSent(false);
    setOtp('');
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid credentials. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await requestOtp('+91' + phone);
      setOtpSent(true);
      setTimer(60);
      setOtp('');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otp.length !== 6) return;
    
    setIsLoading(true);
    setError(null);
    try {
      await verifyOtp('+91' + phone, otp);
      navigate('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid or expired OTP.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkipOtp = () => {
    // Dev mode bypass
    useAuthStore.setState({ isAuthenticated: true, user: { id: 'dev', email: 'dev@fm.com', role: 'ADMIN', name: 'Dev User' } });
    navigate('/dashboard');
  };

  return (
    <Box 
      sx={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        background: (theme) => theme.palette.mode === 'light' 
          ? 'linear-gradient(135deg, #f3f7f5 0%, #eef3f1 50%, #e5edea 100%)'
          : 'linear-gradient(135deg, #0b1513 0%, #0d1e1a 50%, #060a09 100%)',
        py: 4,
        position: 'relative',
        overflow: 'hidden',
        transition: 'background 0.5s ease'
      }}
    >
      {/* Decorative Glow Blob 1 */}
      <Box
        sx={{
          position: 'absolute',
          top: '10%',
          left: '10%',
          width: { xs: '200px', md: '350px' },
          height: { xs: '200px', md: '350px' },
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(204, 164, 59, 0.12) 0%, rgba(204, 164, 59, 0) 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      {/* Decorative Glow Blob 2 */}
      <Box
        sx={{
          position: 'absolute',
          bottom: '10%',
          right: '10%',
          width: { xs: '250px', md: '400px' },
          height: { xs: '250px', md: '400px' },
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(23, 83, 70, 0.18) 0%, rgba(23, 83, 70, 0) 70%)',
          filter: 'blur(70px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      <Container maxWidth="sm" sx={{ position: 'relative', zIndex: 1 }}>
        <Paper 
          elevation={0} 
          sx={{ 
            p: { xs: 3, md: 5 }, 
            borderRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            backgroundColor: (theme) => theme.palette.mode === 'light' 
              ? 'rgba(255, 255, 255, 0.82)' 
              : 'rgba(18, 30, 27, 0.75)',
            backdropFilter: 'blur(20px)',
            border: (theme) => theme.palette.mode === 'light'
              ? '1px solid rgba(12, 52, 43, 0.08)'
              : '1px solid rgba(204, 164, 59, 0.18)',
            boxShadow: (theme) => theme.palette.mode === 'light'
              ? '0 20px 40px -15px rgba(12, 52, 43, 0.08), 0 15px 25px -10px rgba(0, 0, 0, 0.03)'
              : '0 25px 50px -12px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.05)',
          }}
        >
          {/* Logo with branding text */}
          <Box sx={{ mb: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Logo 
              size={90} 
              showText={true} 
              textColor={theme.palette.mode === 'light' ? '#0c342b' : '#ffffff'}
              subTextColor={theme.palette.mode === 'light' ? '#9a7d23' : '#CCA43B'}
              hoverEffect={true}
            />
            
            <Typography 
              variant="caption" 
              sx={{ 
                backgroundColor: (theme) => theme.palette.mode === 'light'
                  ? 'rgba(12, 52, 43, 0.06)'
                  : 'rgba(204, 164, 59, 0.12)',
                color: (theme) => theme.palette.mode === 'light'
                  ? '#0c342b'
                  : '#CCA43B',
                px: 1.5,
                py: 0.5,
                borderRadius: '6px',
                fontWeight: 800,
                letterSpacing: 1.2,
                mt: 1.5,
                fontSize: '0.65rem'
              }}
            >
              SECURE FACILITY ACCESS
            </Typography>
          </Box>

          {!otpSent && (
            <Tabs 
              value={loginMode} 
              onChange={handleModeChange} 
              centered 
              sx={{ 
                mb: 3, 
                width: '100%',
                '& .MuiTabs-indicator': {
                  backgroundColor: '#CCA43B',
                  height: 3,
                  borderRadius: 1.5
                },
                '& .MuiTab-root': {
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  color: (theme) => alpha(theme.palette.text.primary, 0.5),
                  '&.Mui-selected': {
                    color: (theme) => theme.palette.mode === 'light' ? '#0c342b' : '#ffffff',
                  }
                }
              }}
            >
              <Tab label="Password" value="password" />
              <Tab label="OTP Login" value="otp" />
            </Tabs>
          )}

          <Typography variant="h4" sx={{ fontSize: '24px', fontWeight: 800, mb: 1, color: 'text.primary' }}>
            {otpSent ? 'Verify Number' : 'Welcome back'}
          </Typography>
          
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4, textAlign: 'center', maxWidth: '300px' }}>
            {otpSent 
              ? `A 6-digit code has been sent to +91 ${phone}` 
              : loginMode === 'password' 
                ? 'Enter your credentials to access your administrative dashboard.' 
                : 'Enter your phone number to sign in via verification code.'}
          </Typography>

          {error && (
            <Fade in={!!error}>
              <Alert severity="error" sx={{ width: '100%', mb: 3 }}>
                {error}
              </Alert>
            </Fade>
          )}

          {loginMode === 'password' ? (
            <Box component="form" onSubmit={handlePasswordLogin} sx={{ width: '100%' }}>
              <TextField
                fullWidth
                label="Email Address"
                margin="normal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <EmailIcon color="action" />
                      </InputAdornment>
                    ),
                  }
                }}
              />
              <TextField
                fullWidth
                label="Password"
                type={showPassword ? 'text' : 'password'}
                margin="normal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <LockIcon color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          onClick={() => setShowPassword(!showPassword)}
                          edge="end"
                        >
                          {showPassword ? <VisibilityOff /> : <Visibility />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  }
                }}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={isLoading}
                sx={{ 
                  mt: 4, 
                  mb: 2, 
                  height: 56, 
                  borderRadius: '16px',
                  backgroundColor: 'primary.main',
                  fontSize: '1.1rem',
                  fontWeight: '600'
                }}
              >
                {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Sign in'}
              </Button>
            </Box>
          ) : (
            <Box sx={{ width: '100%' }}>
              {!otpSent ? (
                <Box component="form" onSubmit={(e) => { e.preventDefault(); handleSendOtp(); }}>
                  <TextField
                    fullWidth
                    label="Phone Number"
                    margin="normal"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit number"
                    sx={{ '& .MuiOutlinedInput-root': { borderRadius: '16px' } }}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <PhoneIcon color="primary" />
                            <Typography sx={{ ml: 1, fontWeight: '600', color: 'text.primary' }}>+91</Typography>
                          </InputAdornment>
                        ),
                      }
                    }}
                  />
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={isLoading}
                    onClick={handleSendOtp}
                    sx={{ 
                      mt: 4, 
                      mb: 2, 
                      height: 56, 
                      borderRadius: '16px',
                      backgroundColor: 'primary.main',
                      fontSize: '1.1rem',
                      fontWeight: '600'
                    }}
                  >
                    {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Continue'}
                  </Button>
                </Box>
              ) : (
                <Box component="form" onSubmit={handleVerifyOtp}>
                  <TextField
                    fullWidth
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    placeholder="      "
                    autoFocus
                    sx={{ 
                      mb: 4,
                      '& .MuiOutlinedInput-root': { 
                        borderRadius: '16px',
                        backgroundColor: (theme) => theme.palette.mode === 'light' ? '#f0f4f8' : '#2c2c2c',
                        '& fieldset': { border: 'none' }
                      },
                      '& .MuiInputBase-input': {
                        textAlign: 'center',
                        fontSize: '24px',
                        fontWeight: '700',
                        letterSpacing: '12px'
                      }
                    }}
                  />
                  
                  <Stack 
                    direction="row" 
                    spacing={1} 
                    sx={{ 
                      mb: 3, 
                      justifyContent: 'center', 
                      alignItems: 'center' 
                    }}
                  >
                    <Typography variant="body2" color="text.secondary">
                      {timer > 0 ? `Resend in ${timer}s` : "Didn't receive the code?"}
                    </Typography>
                    {timer === 0 && (
                      <Button variant="text" size="small" onClick={handleSendOtp} disabled={isLoading}>
                        Resend
                      </Button>
                    )}
                  </Stack>

                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    disabled={isLoading || otp.length < 6}
                    onClick={() => handleVerifyOtp()}
                    sx={{ 
                      height: 56, 
                      borderRadius: '16px',
                      backgroundColor: 'primary.main',
                      fontSize: '1.1rem',
                      fontWeight: '600'
                    }}
                  >
                    {isLoading ? <CircularProgress size={24} color="inherit" /> : 'Verify & Login'}
                  </Button>
                  
                  <Button 
                    fullWidth 
                    variant="text" 
                    onClick={() => setOtpSent(false)}
                    sx={{ mt: 2 }}
                    disabled={isLoading}
                  >
                    Change Phone Number
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {(import.meta.env.DEV || true) && (
            <Button 
              fullWidth 
              variant="text" 
              color="primary"
              onClick={handleSkipOtp}
              sx={{ mt: 2, fontSize: '0.8rem' }}
            >
              Skip OTP (Dev Mode)
            </Button>
          )}

          <Typography variant="caption" color="text.secondary" sx={{ mt: 4 }}>
            © 2026 Facility Management Portal. All rights reserved.
          </Typography>
        </Paper>
      </Container>
    </Box>
  );
};

export default LoginPage;
