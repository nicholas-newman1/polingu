import { Box, Card, Chip, Typography } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';

export const FlashcardWrapper = styled(Box)<{ $maxWidth: number; $hasStack?: boolean }>(
  ({ theme, $maxWidth, $hasStack }) => ({
    position: 'relative',
    isolation: 'isolate',
    width: '100%',
    maxWidth: $maxWidth,
    margin: '0 auto',
    marginBottom: $hasStack ? theme.spacing(3) : 0,
  })
);

export const FlashcardSurface = styled(Card)<{
  $accent?: 'primary' | 'consonants';
  $promoted?: boolean;
}>(({ theme, $accent = 'primary', $promoted }) => {
  const isDark = theme.palette.mode === 'dark';
  return {
    position: 'relative',
    zIndex: 2,
    padding: theme.spacing(3),
    minHeight: 420,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${alpha(theme.palette.text.primary, isDark ? 0.13 : 0.08)}`,
    boxShadow: `${isDark ? '0 4px 14px rgba(0, 0, 0, 0.45)' : '0 3px 10px rgba(26, 22, 18, 0.07)'}, 0 8px 32px ${alpha(theme.palette[$accent].main, 0.34)}`,
    transformOrigin: 'center bottom',
    ...($promoted
      ? {
          animation: 'cardPromoteTop 300ms cubic-bezier(0.22, 1, 0.36, 1)',
          '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
        }
      : {}),
    [theme.breakpoints.up('sm')]: {
      padding: theme.spacing(4),
      minHeight: 460,
    },
  };
});

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
