import { Box, Card, Chip, Typography, type Theme } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import type { CardCompletionOutcome } from '../hooks/useCardCompletion';

const EXIT_ANIMATIONS: Record<CardCompletionOutcome, string> = {
  good: 'cardExitGood 310ms cubic-bezier(0.32, 0, 0.2, 1) forwards',
  easy: 'cardExitEasy 310ms cubic-bezier(0.32, 0, 0.2, 1) forwards',
  hard: 'cardExitHard 310ms cubic-bezier(0.32, 0, 0.2, 1) forwards',
  again: 'cardExitAgain 310ms cubic-bezier(0.32, 0, 0.2, 1) forwards',
  next: 'cardExitNext 310ms cubic-bezier(0.32, 0, 0.2, 1) forwards',
};

function getExitShadowColor(theme: Theme, outcome: CardCompletionOutcome): string {
  switch (outcome) {
    case 'good':
      return theme.palette.success.main;
    case 'easy':
      return theme.palette.info.main;
    case 'hard':
      return theme.palette.warning.main;
    case 'again':
      return theme.palette.primary.main;
    case 'next':
      return theme.palette.text.primary;
  }
}

export const FlashcardWrapper = styled(Box)<{ $maxWidth: number }>(({ $maxWidth }) => ({
  position: 'relative',
  width: '100%',
  maxWidth: $maxWidth,
  margin: '0 auto',
}));

export const FlashcardSurface = styled(Card)<{
  $accent?: 'primary' | 'consonants';
  $exitOutcome?: CardCompletionOutcome | null;
}>(({ theme, $accent = 'primary', $exitOutcome }) => {
  const exitColor = $exitOutcome ? getExitShadowColor(theme, $exitOutcome) : null;
  return {
    padding: theme.spacing(3),
    minHeight: 420,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: alpha(theme.palette.background.paper, 0.95),
    backdropFilter: 'blur(8px)',
    boxShadow: exitColor
      ? `0 0 0 2px ${alpha(exitColor, 0.7)}, 0 12px 36px ${alpha(exitColor, 0.45)}`
      : `0 8px 32px ${alpha(theme.palette[$accent].main, 0.4)}`,
    transition: 'box-shadow 120ms ease-out',
    ...($exitOutcome
      ? {
          pointerEvents: 'none' as const,
          willChange: 'transform, opacity',
          animation: EXIT_ANIMATIONS[$exitOutcome],
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
