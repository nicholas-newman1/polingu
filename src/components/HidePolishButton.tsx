import { Tooltip } from '@mui/material';
import VisibilityOff from '@mui/icons-material/VisibilityOff';
import Visibility from '@mui/icons-material/Visibility';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { BoxIconButton } from './BoxIconButton';

export function HidePolishButton() {
  const { settings, updateSettings } = useAppSettings();
  const isHidden = settings.hidePolishText;

  const handleToggle = () => {
    updateSettings({ hidePolishText: !isHidden });
  };

  return (
    <Tooltip title={isHidden ? 'Show Polish text' : 'Hide Polish text (audio only)'}>
      <BoxIconButton
        onClick={handleToggle}
        size="small"
        active={isHidden}
        aria-label={isHidden ? 'Show Polish text' : 'Hide Polish text'}
        aria-pressed={isHidden}
      >
        {isHidden ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
      </BoxIconButton>
    </Tooltip>
  );
}
