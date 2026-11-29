import { Box, CircularProgress } from '@mui/material';
import { useAuthContext } from '../contexts/AuthContext';

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuthContext();

  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <CircularProgress sx={{ color: 'text.disabled' }} />
      </Box>
    );
  }

  return children;
}
