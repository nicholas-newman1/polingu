import HeadphonesIcon from '@mui/icons-material/Headphones';
import { BoxIconButton } from './BoxIconButton';

interface ListenButtonProps {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  'aria-label'?: string;
}

export function ListenButton({
  onClick,
  disabled,
  active = false,
  'aria-label': ariaLabel = 'Listening mode',
}: ListenButtonProps) {
  return (
    <BoxIconButton
      variant="outlined"
      active={active}
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
