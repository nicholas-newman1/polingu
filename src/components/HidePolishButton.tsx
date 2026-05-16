import { Tooltip } from '@mui/material';
import { VisibilityOff, Visibility } from '@mui/icons-material';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { BoxIconButton } from './BoxIconButton';

interface HidePolishButtonProps {
  size?: 'small' | 'medium';
}

export function HidePolishButton({ size = 'small' }: HidePolishButtonProps) {
  const { settings, updateSettings } = useAppSettings();
  const isHidden = settings.hidePolishText;

  const handleToggle = () => {
    updateSettings({ hidePolishText: !isHidden });
  };

  return (
    <Tooltip title={isHidden ? 'Show Polish text' : 'Hide Polish text (audio only)'}>
      <BoxIconButton
        onClick={handleToggle}
        size={size}
        active={isHidden}
        aria-label={isHidden ? 'Show Polish text' : 'Hide Polish text'}
        aria-pressed={isHidden}
      >
        {isHidden ? <VisibilityOff fontSize={size} /> : <Visibility fontSize={size} />}
      </BoxIconButton>
    </Tooltip>
  );
}
