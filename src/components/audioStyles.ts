import { Box } from '@mui/material';
import { styled } from '../lib/styled';

export const TrackIcon = styled(Box)(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: 999,
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}));
