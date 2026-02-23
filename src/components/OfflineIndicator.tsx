import { Snackbar, Alert, CircularProgress, Box, Typography } from '@mui/material';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import SyncIcon from '@mui/icons-material/Sync';
import { useOnlineStatus } from '../hooks/useOnlineStatus';

/**
 * Displays an indicator when the app is offline or syncing.
 * Shows a snackbar notification when offline status changes.
 */
export function OfflineIndicator() {
  const { isOnline, isSyncing, pendingSyncCount } = useOnlineStatus();

  // Show offline notification
  if (!isOnline) {
    return (
      <Snackbar open={true} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert
          severity="warning"
          icon={<CloudOffIcon />}
          sx={{
            alignItems: 'center',
            '& .MuiAlert-message': {
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            },
          }}
        >
          <Typography variant="body2">
            You're offline
            {pendingSyncCount > 0 && ` • ${pendingSyncCount} changes pending`}
          </Typography>
        </Alert>
      </Snackbar>
    );
  }

  // Show syncing notification
  if (isSyncing) {
    return (
      <Snackbar open={true} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert
          severity="info"
          icon={
            <Box sx={{ display: 'flex', alignItems: 'center' }}>
              <SyncIcon
                sx={{
                  animation: 'spin 1s linear infinite',
                  '@keyframes spin': {
                    '0%': { transform: 'rotate(0deg)' },
                    '100%': { transform: 'rotate(360deg)' },
                  },
                }}
              />
            </Box>
          }
          sx={{
            alignItems: 'center',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2">Syncing...</Typography>
            <CircularProgress size={16} />
          </Box>
        </Alert>
      </Snackbar>
    );
  }

  return null;
}
