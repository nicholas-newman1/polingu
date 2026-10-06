import { Box, LinearProgress, Typography } from '@mui/material';
import { styled } from '../lib/styled';

const Overlay = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(2),
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2, 3),
  boxShadow: theme.shadows[8],
  minWidth: 300,
  zIndex: theme.zIndex.snackbar,
}));

interface UploadProgressOverlayProps {
  progress: { status: string; uploadPercent?: number; error?: string };
  processingLabel: string;
}

export function UploadProgressOverlay({ progress, processingLabel }: UploadProgressOverlayProps) {
  return (
    <Overlay>
      <Typography variant="body2" gutterBottom>
        {progress.status === 'uploading' && 'Uploading...'}
        {progress.status === 'processing' && processingLabel}
        {progress.status === 'error' && `Error: ${progress.error}`}
      </Typography>
      {progress.status === 'uploading' && progress.uploadPercent !== undefined && (
        <LinearProgress variant="determinate" value={progress.uploadPercent} />
      )}
      {progress.status === 'processing' && <LinearProgress />}
    </Overlay>
  );
}
