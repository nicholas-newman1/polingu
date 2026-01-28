import { Snackbar, Alert } from '@mui/material';
import { useSnackbar } from '../hooks/useSnackbar';

const AUTO_HIDE_DURATION = 5000;

export function AppSnackbar() {
  const { snackbar, hideSnackbar } = useSnackbar();

  if (!snackbar) return null;

  return (
    <Snackbar
      key={snackbar.id}
      open={true}
      autoHideDuration={AUTO_HIDE_DURATION}
      onClose={hideSnackbar}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        onClose={hideSnackbar}
        severity={snackbar.severity}
        variant="filled"
        sx={{ width: '100%' }}
      >
        {snackbar.message}
      </Alert>
    </Snackbar>
  );
}
