import { useMemo, type ReactNode } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { createAppTheme } from '../lib/theme';
import { useColorMode } from '../hooks/useColorMode';

interface ThemedAppProps {
  children: ReactNode;
}

export function ThemedApp({ children }: ThemedAppProps) {
  const { mode } = useColorMode();
  const theme = useMemo(() => createAppTheme(mode), [mode]);
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
