import { Button } from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import { styled } from '../lib/styled';

const StyledButton = styled(Button)(({ theme }) => ({
  height: 40,
  borderRadius: theme.spacing(0.5),
  borderColor: theme.palette.divider,
  color: theme.palette.common.white,
  backgroundColor: theme.palette.primary.main,
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
  },
}));

interface ClearButtonProps {
  onClick: () => void;
  disabled?: boolean;
  'aria-label'?: string;
}

export function ClearButton({
  onClick,
  disabled,
  'aria-label': ariaLabel = 'Clear',
}: ClearButtonProps) {
  return (
    <StyledButton
      size="small"
      variant="outlined"
      startIcon={<ClearIcon />}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      Clear
    </StyledButton>
  );
}
