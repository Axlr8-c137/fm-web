import { createTheme, type PaletteMode } from '@mui/material/styles';

export const getTheme = (mode: PaletteMode) => {
  return createTheme({
    palette: {
      mode,
      primary: {
        main: mode === 'light' ? '#1A73E8' : '#8AB4F8', // Google Blue / M3 Blue
        light: '#E8F0FE',
        dark: '#174EA6',
        contrastText: '#FFFFFF',
      },
      secondary: {
        main: mode === 'light' ? '#00796B' : '#4DB6AC',
        light: '#E0F2F1',
        dark: '#004D40',
      },
      background: {
        default: mode === 'light' ? '#F8F9FA' : '#121212',
        paper: mode === 'light' ? '#FFFFFF' : '#1E1E1E',
      },
      text: {
        primary: mode === 'light' ? '#202124' : '#E8EAED',
        secondary: mode === 'light' ? '#5F6368' : '#9AA0A6',
      },
    },
    typography: {
      fontFamily: [
        'Inter',
        'Roboto',
        '"Helvetica Neue"',
        'Arial',
        'sans-serif',
      ].join(','),
      h1: { fontSize: '2.5rem', fontWeight: 600 },
      h2: { fontSize: '2rem', fontWeight: 600 },
      h3: { fontSize: '1.75rem', fontWeight: 600 },
      h4: { fontSize: '1.5rem', fontWeight: 600 },
      h5: { fontSize: '1.25rem', fontWeight: 600 },
      h6: { fontSize: '1rem', fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 500 },
    },
    shape: {
      borderRadius: 12, // More rounded, premium M3 look
    },
    components: {
      MuiButton: {
        styleOverrides: {
          root: ({ ownerState, theme }: { ownerState: any, theme: any }) => ({
            borderRadius: 8,
            padding: '8px 24px',
            boxShadow: 'none',
            '&:hover': {
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            },
            ...(ownerState.variant === 'contained' && ownerState.color === 'primary' && {
              background: theme.palette.mode === 'light' 
                ? 'linear-gradient(45deg, #1A73E8 30%, #4285F4 90%)'
                : 'linear-gradient(45deg, #8AB4F8 30%, #ADCCFF 90%)',
            }),
          }),
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 16,
            boxShadow: mode === 'light' 
              ? '0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.24)'
              : '0 4px 6px rgba(0,0,0,0.3)',
            backgroundImage: 'none',
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: mode === 'light' ? '#FFFFFF' : '#1E1E1E',
            color: mode === 'light' ? '#202124' : '#E8EAED',
            boxShadow: '0 1px 2px 0 rgba(60,64,67,0.3), 0 2px 6px 2px rgba(60,64,67,0.15)',
          },
        },
      },
    },
  });
};
