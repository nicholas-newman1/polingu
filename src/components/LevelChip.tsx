import { Chip } from '@mui/material';
import { styled } from '../lib/styled';
import type { CEFRLevel } from '../types/sentences';

/** Clickable CEFR level chip; inactive levels are greyed out. */
export const ToggleLevelChip = styled(Chip)<{ $level: CEFRLevel; $active?: boolean }>(
  ({ theme, $level, $active = true }) => ({
    backgroundColor: $active ? theme.palette.levels[$level] : theme.palette.neutral.main,
    color: theme.palette.common.white,
    fontWeight: 600,
    fontSize: '0.75rem',
    cursor: 'pointer',
    '&:hover': {
      backgroundColor: $active ? theme.palette.levels[$level] : theme.palette.neutral.dark,
    },
  })
);
