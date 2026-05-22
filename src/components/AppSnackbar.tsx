import { Snackbar, Alert, Button } from '@mui/material';
import { useSnackbar } from '../hooks/useSnackbar';

const AUTO_HIDE_DURATION = 5000;
const AUTO_HIDE_DURATION_WITH_ACTION = 8000;

export function AppSnackbar() {
  const { snackbar, hideSnackbar } = useSnackbar();

  if (!snackbar) return null;

  const handleActionClick = () => {
    snackbar.action?.onClick();
    hideSnackbar();
  };

  return (
    <Snackbar
      key={snackbar.id}
      open={true}
      autoHideDuration={snackbar.action ? AUTO_HIDE_DURATION_WITH_ACTION : AUTO_HIDE_DURATION}
      onClose={hideSnackbar}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert
        onClose={hideSnackbar}
        severity={snackbar.severity}
        variant="filled"
        sx={{
          width: '100%',
          alignItems: 'center',
          '& .MuiAlert-action': { alignItems: 'center', py: 0, mr: 0.5 },
        }}
        action={
          snackbar.action ? (
            <Button
              color="inherit"
              size="small"
              onClick={handleActionClick}
              sx={{
                fontWeight: 600,
                textTransform: 'none',
                py: 0.25,
                px: 1.25,
                minHeight: 0,
                lineHeight: 1.4,
                backgroundColor: 'rgba(255, 255, 255, 0.16)',
                border: '1px solid rgba(255, 255, 255, 0.4)',
                '&:hover': { backgroundColor: 'rgba(255, 255, 255, 0.28)' },
              }}
            >
              {snackbar.action.label}
            </Button>
          ) : undefined
        }
      >
        {snackbar.message}
      </Alert>
    </Snackbar>
  );
}
