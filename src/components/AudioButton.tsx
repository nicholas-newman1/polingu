import { Box, Tooltip } from '@mui/material';
import PlayArrow from '@mui/icons-material/PlayArrow';
import Stop from '@mui/icons-material/Stop';
import VolumeUp from '@mui/icons-material/VolumeUp';
import VolumeOff from '@mui/icons-material/VolumeOff';
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
        active={isPlaying}
        aria-label={isPlaying ? 'Stop audio' : 'Play audio'}
        aria-pressed={isPlaying}
      >
        {isPlaying ? <Stop fontSize={size} /> : <PlayArrow fontSize={size} />}
      </BoxIconButton>
      <Tooltip title={isMuted ? 'Enable auto-play & chimes' : 'Mute auto-play & chimes'}>
        <BoxIconButton
          onClick={handleToggleMute}
          size={size}
          active={isMuted}
          aria-label={
            isMuted ? 'Enable auto-play audio and chimes' : 'Mute auto-play audio and chimes'
          }
          aria-pressed={isMuted}
        >
          {isMuted ? <VolumeOff fontSize={size} /> : <VolumeUp fontSize={size} />}
        </BoxIconButton>
      </Tooltip>
    </Box>
  );
}
