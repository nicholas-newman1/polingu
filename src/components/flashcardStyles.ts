import { Box, Card, Chip, Typography } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';

export const FlashcardWrapper = styled(Box)<{ $maxWidth: number }>(({ $maxWidth }) => ({
  width: '100%',
  maxWidth: $maxWidth,
  margin: '0 auto',
}));

export const FlashcardSurface = styled(Card)<{ $accent?: 'primary' | 'consonants' }>(
  ({ theme, $accent = 'primary' }) => ({
    padding: theme.spacing(3),
    minHeight: 420,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: alpha(theme.palette.background.paper, 0.95),
    backdropFilter: 'blur(8px)',
    boxShadow: `0 8px 32px ${alpha(theme.palette[$accent].main, 0.4)}`,
    [theme.breakpoints.up('sm')]: {
      padding: theme.spacing(4),
      minHeight: 460,
    },
  })
);

export const FlashcardMetaChip = styled(Chip)(({ theme }) => ({
  backgroundColor: theme.palette.background.default,
  color: theme.palette.text.secondary,
}));

export const FlashcardHint = styled(Typography)({
  fontStyle: 'italic',
});

export const AccentNoteBox = styled(Box)<{ $accent: 'primary' | 'info' }>(({ theme, $accent }) => ({
  marginTop: theme.spacing(2),
  padding: theme.spacing(1.5),
  backgroundColor: alpha(theme.palette.text.primary, 0.03),
  borderRadius: theme.spacing(1),
  borderLeft: `3px solid ${alpha(theme.palette[$accent].main, 0.5)}`,
}));
