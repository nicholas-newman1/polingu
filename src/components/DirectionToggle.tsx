import { Button } from '@mui/material';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { styled } from '../lib/styled';

export type TranslationDirection = 'en-to-pl' | 'pl-to-en';

const StyledButton = styled(Button)(({ theme }) => ({
  textTransform: 'none',
  fontWeight: 500,
  gap: theme.spacing(1),
  borderColor: theme.palette.divider,
  color: theme.palette.text.secondary,
  backgroundColor: theme.palette.background.paper,
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
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
      <SwapHorizIcon sx={{ fontSize: size === 'small' ? 18 : 22 }} />
      {englishFirst ? 'PL' : 'EN'}
    </StyledButton>
  );
}
