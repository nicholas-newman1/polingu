import { Tooltip } from '@mui/material';
import { DarkMode, LightMode } from '@mui/icons-material';
import { BoxIconButton } from './BoxIconButton';
import { useColorMode } from '../hooks/useColorMode';

export function ColorModeToggle() {
  const { mode, toggleMode } = useColorMode();
  const isDark = mode === 'dark';
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode';

  return (
    <Tooltip title={label}>
      <BoxIconButton size="small" onClick={toggleMode} aria-label={label}>
        {isDark ? <LightMode fontSize="small" /> : <DarkMode fontSize="small" />}
      </BoxIconButton>
    </Tooltip>
  );
}
