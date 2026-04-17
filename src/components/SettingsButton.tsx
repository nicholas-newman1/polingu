import SettingsIcon from '@mui/icons-material/Settings';
import { BoxIconButton } from './BoxIconButton';

interface SettingsButtonProps {
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}

export function SettingsButton({ active, onClick, disabled }: SettingsButtonProps) {
  return (
    <BoxIconButton
      variant="outlined"
      active={active}
      onClick={onClick}
      disabled={disabled}
      size="small"
      sx={{ width: 40, height: 40 }}
      aria-label="Settings"
    >
      <SettingsIcon fontSize="small" />
    </BoxIconButton>
  );
}
