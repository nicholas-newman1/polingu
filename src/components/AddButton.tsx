import { IconButton } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { styled } from '../lib/styled';

const StyledButton = styled(IconButton)(({ theme }) => ({
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  borderRadius: theme.spacing(1),
  padding: theme.spacing(1),
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

interface AddButtonProps {
  onClick: () => void;
  disabled?: boolean;
  'aria-label'?: string;
}

export function AddButton({
  onClick,
  disabled,
  'aria-label': ariaLabel = 'Add',
}: AddButtonProps) {
  return (
    <StyledButton onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      <AddIcon />
    </StyledButton>
  );
}

