import { Box, Tooltip } from '@mui/material';
import { PlayArrow, Stop, VolumeOff } from '@mui/icons-material';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { BoxIconButton } from './BoxIconButton';

interface AudioButtonProps {
  isPlaying: boolean;
  onToggle: () => void;
  size?: 'small' | 'medium';
}

export function AudioButton({ isPlaying, onToggle, size = 'small' }: AudioButtonProps) {
  const { settings, updateSettings } = useAppSettings();
  const isMuted = !settings.autoPlayAudio;

  const handleToggleMute = () => {
    updateSettings({ autoPlayAudio: !settings.autoPlayAudio });
  };

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
      <BoxIconButton
        onClick={onToggle}
        size={size}
        sx={isPlaying ? { color: 'error.main' } : undefined}
        aria-label={isPlaying ? 'Stop audio' : 'Play audio'}
      >
        {isPlaying ? <Stop fontSize={size} /> : <PlayArrow fontSize={size} />}
      </BoxIconButton>
      <Tooltip title={isMuted ? 'Enable auto-play' : 'Disable auto-play'}>
        <BoxIconButton
          onClick={handleToggleMute}
          size={size}
          tone="danger"
          active={isMuted}
          aria-label={isMuted ? 'Enable auto-play audio' : 'Disable auto-play audio'}
        >
          <VolumeOff fontSize={size} />
        </BoxIconButton>
      </Tooltip>
    </Box>
  );
}
