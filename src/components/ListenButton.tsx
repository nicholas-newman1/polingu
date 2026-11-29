import HeadphonesIcon from '@mui/icons-material/Headphones';
import { BoxIconButton } from './BoxIconButton';

interface ListenButtonProps {
  onClick: () => void;
  disabled?: boolean;
  'aria-label': string;
}

export function ListenButton({ onClick, disabled, 'aria-label': ariaLabel }: ListenButtonProps) {
  return (
    <BoxIconButton
      variant="outlined"
      onClick={onClick}
      disabled={disabled}
      size="small"
      sx={{ width: 40, height: 40 }}
      aria-label={ariaLabel}
      data-qa="listen-button"
    >
      <HeadphonesIcon fontSize="small" />
    </BoxIconButton>
  );
}
