import type { Theme } from '@mui/material/styles';

/** Shared by rating buttons, recaps, and completion animations. Change rating colors here. */
const RATING_COLORS = {
  again: 'primary',
  hard: 'warning',
  good: 'info',
  easy: 'success',
} as const;

export type RatingOutcome = keyof typeof RATING_COLORS;

export function getRatingPalette(theme: Theme, outcome: RatingOutcome) {
  return theme.palette[RATING_COLORS[outcome]];
}
