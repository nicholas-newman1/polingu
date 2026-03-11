import { Box, IconButton, Tooltip } from '@mui/material';
import { PlayArrow, Stop, VolumeOff } from '@mui/icons-material';
import { useAppSettings } from '../contexts/AppSettingsContext';

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
    <Box sx={{ display: 'flex', alignItems: 'center' }}>
      <IconButton
        onClick={onToggle}
        size={size}
        sx={{
          color: isPlaying ? 'error.main' : 'text.disabled',
          p: 0.5,
        }}
        aria-label={isPlaying ? 'Stop audio' : 'Play audio'}
      >
        {isPlaying ? <Stop fontSize={size} /> : <PlayArrow fontSize={size} />}
      </IconButton>
      <Tooltip title={isMuted ? 'Enable auto-play' : 'Disable auto-play'}>
        <IconButton
          onClick={handleToggleMute}
          size={size}
          sx={{
            color: isMuted ? 'error.main' : 'text.disabled',
            p: 0.5,
          }}
          aria-label={isMuted ? 'Enable auto-play audio' : 'Disable auto-play audio'}
        >
          <VolumeOff fontSize={size} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
