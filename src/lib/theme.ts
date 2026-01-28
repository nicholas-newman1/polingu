import { createTheme, alpha } from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Palette {
    gender: {
      masculine: { main: string; dark: string; gradient: string };
      feminine: { main: string; dark: string; gradient: string };
      neuter: { main: string; dark: string; gradient: string };
    };
    levels: Record<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2', string>;
    consonants: { main: string; dark: string; gradient: string };
    yiRule: {
      i: { main: string; dark: string; gradient: string };
      y: { main: string; dark: string; gradient: string };
    };
    tooltip: { main: string; text: string; muted: string; accent: string; error: string };
    neutral: { main: string; dark: string };
  }
  interface PaletteOptions {
    gender?: {
      masculine: { main: string; dark: string; gradient: string };
      feminine: { main: string; dark: string; gradient: string };
      neuter: { main: string; dark: string; gradient: string };
    };
    levels?: Record<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2', string>;
    consonants?: { main: string; dark: string; gradient: string };
    yiRule?: {
      i: { main: string; dark: string; gradient: string };
      y: { main: string; dark: string; gradient: string };
    };
    tooltip?: { main: string; text: string; muted: string; accent: string; error: string };
    neutral?: { main: string; dark: string };
  }
}

export { alpha };

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#c23a22',
      dark: '#a03018',
      light: '#d45a42',
      contrastText: '#fff',
    },
    secondary: {
      main: '#c9a227',
      dark: '#a68520',
      light: '#e8c84a',
      contrastText: '#1a1612',
    },
    success: {
      main: '#2d6a4f',
      dark: '#1b4332',
      light: '#40916c',
    },
    warning: {
      main: '#ca8a04',
      dark: '#a16207',
      light: '#eab308',
    },
    info: {
      main: '#2a6f97',
      dark: '#1d5073',
      light: '#468faf',
    },
    error: {
      main: '#c23a22',
      dark: '#a03018',
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
    },
    text: {
      primary: '#1a1612',
      secondary: '#3d3632',
      disabled: '#6b6058',
    },
    divider: 'rgba(26, 22, 18, 0.1)',
    gender: {
      masculine: {
        main: '#3b82c4',
        dark: '#245a88',
        gradient: 'linear-gradient(180deg, #4a9ede 0%, #3b82c4 100%)',
      },
      feminine: {
        main: '#c23a22',
        dark: '#8b2815',
        gradient: 'linear-gradient(180deg, #d45a42 0%, #c23a22 100%)',
      },
      neuter: {
        main: '#40916c',
        dark: '#2d6a4f',
        gradient: 'linear-gradient(180deg, #52b883 0%, #40916c 100%)',
      },
    },
    levels: {
      A1: '#22c55e',
      A2: '#84cc16',
      B1: '#eab308',
      B2: '#f97316',
      C1: '#ef4444',
      C2: '#dc2626',
    },
    consonants: {
      main: '#6b4c9a',
      dark: '#3d2b5c',
      gradient: 'linear-gradient(180deg, #6b4c9a 0%, #553c7d 100%)',
    },
    yiRule: {
      i: {
        main: '#2e7d32',
        dark: '#1b5e20',
        gradient: 'linear-gradient(135deg, #2e7d32 0%, #1b5e20 100%)',
      },
      y: {
        main: '#c62828',
        dark: '#b71c1c',
        gradient: 'linear-gradient(135deg, #c62828 0%, #b71c1c 100%)',
      },
    },
    tooltip: {
      main: '#1a1a1a',
      text: '#ffffff',
      muted: '#a3a3a3',
      accent: '#60a5fa',
      error: '#f87171',
    },
    neutral: {
      main: '#6b7280',
      dark: '#4b5563',
    },
  },
  typography: {
    fontFamily: '"Crimson Pro", Georgia, serif',
    h1: {
      fontWeight: 300,
      letterSpacing: '-0.02em',
    },
    h2: {
      fontWeight: 300,
      letterSpacing: '-0.01em',
    },
    h3: {
      fontWeight: 400,
    },
    h4: {
      fontWeight: 400,
    },
    h5: {
      fontWeight: 500,
    },
    h6: {
      fontWeight: 500,
    },
    button: {
      fontWeight: 600,
      textTransform: 'none',
    },
    body1: {
      fontSize: '1rem',
      lineHeight: 1.6,
    },
    body2: {
      fontSize: '0.875rem',
      lineHeight: 1.5,
    },
  },
  shape: {
    borderRadius: 12,
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
          padding: '8px 16px',
          fontSize: '0.875rem',
          boxShadow: 'none',
          '&:hover': {
            boxShadow: 'none',
          },
        },
        sizeLarge: {
          padding: '12px 24px',
          fontSize: '1rem',
          borderRadius: 12,
        },
        contained: {
          '&:active': {
            transform: 'scale(0.98)',
          },
        },
        outlined: {
          borderWidth: 1,
          '&:hover': {
            borderWidth: 1,
          },
        },
      },
    },
    MuiIconButton: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(26, 22, 18, 0.08)',
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiSelect: {
      styleOverrides: {
        root: {
          borderRadius: 12,
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 12,
          '& .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(26, 22, 18, 0.15)',
          },
          '&:hover .MuiOutlinedInput-notchedOutline': {
            borderColor: 'rgba(26, 22, 18, 0.3)',
          },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: '0.75rem',
        },
      },
    },
  },
});

export default theme;
