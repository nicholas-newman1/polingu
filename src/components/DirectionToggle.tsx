import { Button } from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { styled } from '../lib/styled';
import type { TranslationDirection } from '../types/common';

const StyledButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  fontWeight: 500,
  gap: theme.spacing(1),
  borderColor: theme.palette.divider,
  color: theme.palette.text.secondary,
  backgroundColor: theme.palette.background.paper,
  transition: 'transform 140ms ease, background-color 150ms ease, border-color 150ms ease',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  '&:active': {
    transform: 'scale(0.97)',
  },
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
    '&:active': {
      transform: 'none',
    },
  },
}));

const SwapIcon = styled(SwapHorizIcon)<{ $flipped: boolean }>(({ $flipped }) => ({
  transform: $flipped ? 'rotate(180deg)' : 'rotate(0deg)',
  transition: 'transform 260ms cubic-bezier(0.34, 1.56, 0.64, 1)',
  '@media (prefers-reduced-motion: reduce)': {
    transition: 'none',
  },
}));

interface DirectionToggleProps {
  direction: TranslationDirection;
  onToggle: () => void;
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
}

export function DirectionToggle({
  direction,
  onToggle,
  size = 'small',
  disabled,
}: DirectionToggleProps) {
  const englishFirst = direction === 'en-to-pl';

  return (
    <StyledButton variant="outlined" size={size} onClick={onToggle} disabled={disabled}>
      {englishFirst ? 'EN' : 'PL'}
      <SwapIcon $flipped={!englishFirst} sx={{ fontSize: size === 'small' ? 18 : 22 }} />
      {englishFirst ? 'PL' : 'EN'}
    </StyledButton>
  );
}
