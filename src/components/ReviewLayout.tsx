import { Box, Stack } from '@mui/material';
import { styled } from '../lib/styled';

export const ReviewMainContent = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
});

export const ReviewControlsRow = styled(Stack)(({ theme }) => ({
  marginBottom: theme.spacing(3),
  flexWrap: 'wrap',
  gap: theme.spacing(1),
}));
