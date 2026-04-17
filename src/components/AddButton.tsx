import AddIcon from '@mui/icons-material/Add';
import { BoxIconButton } from './BoxIconButton';

interface AddButtonProps {
  onClick: () => void;
  disabled?: boolean;
  'aria-label'?: string;
}

export function AddButton({ onClick, disabled, 'aria-label': ariaLabel = 'Add' }: AddButtonProps) {
  return (
    <BoxIconButton variant="outlined" onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
      <AddIcon />
    </BoxIconButton>
  );
}
