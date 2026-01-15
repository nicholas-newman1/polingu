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
      }),
}));

interface PracticeModeButtonProps {
  active: boolean;
  onClick: () => void;
}

export function PracticeModeButton({ active, onClick }: PracticeModeButtonProps) {
  return (
    <StyledButton
      variant={active ? 'contained' : 'outlined'}
      onClick={onClick}
      $active={active}
      size="small"
    >
      {active ? '✓ Practice' : 'Practice'}
    </StyledButton>
  );
}

