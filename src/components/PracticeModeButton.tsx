import { Button } from '@mui/material';
import { styled } from '../lib/styled';

interface StyledButtonProps {
  $active: boolean;
}

const StyledButton = styled(Button)<StyledButtonProps>(({ theme, $active }) => ({
  minWidth: 100,
  textTransform: 'none',
  ...($active
    ? {
        backgroundColor: theme.palette.success.main,
        color: theme.palette.success.contrastText,
        '&:hover': { backgroundColor: theme.palette.success.dark },
      }
    : {
        borderColor: theme.palette.divider,
        color: theme.palette.text.secondary,
        backgroundColor: theme.palette.background.paper,
        '&:hover': { backgroundColor: theme.palette.action.hover },
      }),
}));

interface PracticeModeButtonProps {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function PracticeModeButton({ active, onClick, disabled }: PracticeModeButtonProps) {
  return (
    <StyledButton
      variant={active ? 'contained' : 'outlined'}
      onClick={onClick}
      $active={active}
      size="small"
      disabled={disabled}
    >
      {active ? '✓ Practice' : 'Practice'}
    </StyledButton>
  );
}
