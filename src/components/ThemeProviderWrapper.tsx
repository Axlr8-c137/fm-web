import React, { useMemo } from 'react';
import { ThemeProvider, CssBaseline } from '@mui/material';
import { useThemeStore } from '../stores/themeStore';
import { getTheme } from '../styles/theme';

interface ThemeProviderWrapperProps {
  children: React.ReactNode;
}

export const ThemeProviderWrapper: React.FC<ThemeProviderWrapperProps> = ({ children }) => {
  const mode = useThemeStore((state) => state.mode);
  
  const theme = useMemo(() => getTheme(mode), [mode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
};
