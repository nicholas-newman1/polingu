import { Box, Dialog, DialogActions, DialogContent } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';

export const ModalDialog = styled(Dialog)<{ $maxWidth?: number; $maxHeight?: string }>(
  ({ theme, $maxWidth = 500, $maxHeight }) => ({
    '& .MuiDialog-paper': {
      width: '100%',
      maxWidth: $maxWidth,
      margin: theme.spacing(2),
      maxHeight: $maxHeight,
    },
  })
);

export const ModalHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2, 3),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

export const ModalContent = styled(DialogContent)(({ theme }) => ({
  padding: theme.spacing(3),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
}));

export const ModalActions = styled(DialogActions)<{ $spread?: boolean }>(({ theme, $spread }) => ({
  padding: theme.spacing(2, 3),
  borderTop: `1px solid ${theme.palette.divider}`,
  justifyContent: $spread ? 'space-between' : undefined,
}));

export const ExamplePairBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
  padding: theme.spacing(1.5),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: alpha(theme.palette.text.primary, 0.02),
  border: `1px solid ${theme.palette.divider}`,
}));

export const ExampleRowHeader = styled(Box)({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
});
