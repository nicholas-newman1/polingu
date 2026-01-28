import { Box } from '@mui/material';
import { styled } from '../../lib/styled';
import { alpha } from '../../lib/theme';

export const Section = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1),
}));

export const ChipGroup = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexWrap: 'wrap',
  gap: theme.spacing(0.5),
}));

export const SentenceCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$selected',
})<{ $selected?: boolean }>(({ theme, $selected }) => ({
  padding: theme.spacing(2),
  backgroundColor: $selected ? alpha(theme.palette.primary.main, 0.08) : theme.palette.action.hover,
  borderRadius: theme.spacing(1),
  border: $selected ? `2px solid ${theme.palette.primary.main}` : '2px solid transparent',
  cursor: 'pointer',
  transition: 'all 0.15s ease',
  '&:hover': {
    backgroundColor: $selected
      ? alpha(theme.palette.primary.main, 0.12)
      : theme.palette.action.selected,
  },
}));

export const SuggestionCard = styled(Box, {
  shouldForwardProp: (prop) => prop !== '$priority',
})<{ $priority: 'high' | 'medium' | 'low' }>(({ theme, $priority }) => ({
  padding: theme.spacing(2),
  backgroundColor: theme.palette.action.hover,
  borderRadius: theme.spacing(1),
  borderLeft: `4px solid ${
    $priority === 'high'
      ? theme.palette.error.main
      : $priority === 'medium'
        ? theme.palette.warning.main
        : theme.palette.info.main
  }`,
}));
