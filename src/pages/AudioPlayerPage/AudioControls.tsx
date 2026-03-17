import { useState } from 'react';
import { Box, IconButton, Slider, Typography, ButtonBase, Menu } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import Replay10Icon from '@mui/icons-material/Replay10';
import Forward10Icon from '@mui/icons-material/Forward10';
import { styled } from '../../lib/styled';
import { DRAWER_WIDTH } from '../../components/Layout';

const ControlsBar = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: 0,
  left: 0,
  right: 0,
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(1, 2, 2),
  zIndex: theme.zIndex.appBar,
  [theme.breakpoints.up('md')]: {
    left: DRAWER_WIDTH,
  },
}));

const TimeRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

const ButtonRow = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
});

const PlaybackGroup = styled(Box)({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  flex: 1,
});

const SpeedButtonSpacer = styled(Box)({
  width: 48,
  minWidth: 48,
  flexShrink: 0,
});

const SpeedButton = styled(ButtonBase)(({ theme }) => ({
  fontSize: '0.8rem',
  fontWeight: 600,
  width: 48,
  minWidth: 48,
  height: 32,
  borderRadius: theme.shape.borderRadius,
  color: theme.palette.text.secondary,
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

function formatTime(seconds: number): string {
  if (!isFinite(seconds) || seconds < 0) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

const SPEED_MIN = 0.5;
const SPEED_MAX = 2;
const SPEED_STEP = 0.1;

interface AudioControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSetPlaybackRate: (rate: number) => void;
}

export function AudioControls({
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  onTogglePlay,
  onSeek,
  onSetPlaybackRate,
}: AudioControlsProps) {
  const [speedMenuAnchor, setSpeedMenuAnchor] = useState<HTMLElement | null>(null);

  const handleSeekChange = (_: Event, value: number | number[]) => {
    onSeek(value as number);
  };

  const handleSpeedChange = (_: Event, value: number | number[]) => {
    onSetPlaybackRate(value as number);
  };

  return (
    <ControlsBar>
      <Slider
        value={currentTime}
        max={duration || 1}
        onChange={handleSeekChange}
        size="small"
        sx={{
          p: 0,
          mb: 0.5,
          '& .MuiSlider-thumb': { width: 12, height: 12 },
        }}
      />
      <TimeRow>
        <Typography variant="caption" color="text.secondary">
          {formatTime(currentTime)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatTime(duration)}
        </Typography>
      </TimeRow>
      <ButtonRow>
        <SpeedButton
          onClick={(e) => setSpeedMenuAnchor(e.currentTarget)}
          aria-controls={speedMenuAnchor ? 'speed-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={!!speedMenuAnchor}
          sx={{ flexShrink: 0 }}
        >
          {playbackRate === 1 ? '1x' : `${playbackRate}x`}
        </SpeedButton>
        <PlaybackGroup>
          <IconButton
            onClick={() => onSeek(Math.max(0, currentTime - 10))}
            aria-label="Skip back 10 seconds"
            sx={{ width: 40, height: 40, color: 'text.primary' }}
          >
            <Replay10Icon fontSize="large" />
          </IconButton>
          <IconButton
            onClick={onTogglePlay}
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
              width: 48,
              height: 48,
            }}
          >
            {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
          </IconButton>
          <IconButton
            onClick={() => onSeek(Math.min(duration, currentTime + 10))}
            aria-label="Skip ahead 10 seconds"
            sx={{ width: 40, height: 40, color: 'text.primary' }}
          >
            <Forward10Icon fontSize="large" />
          </IconButton>
        </PlaybackGroup>
        <SpeedButtonSpacer />
        <Menu
          id="speed-menu"
          anchorEl={speedMenuAnchor}
          open={!!speedMenuAnchor}
          onClose={() => setSpeedMenuAnchor(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          slotProps={{
            paper: { sx: { minWidth: 220 } },
          }}
        >
          <Box sx={{ px: 2, pt: 1, pb: 2 }}>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: 'block', mb: 1, fontWeight: 600 }}
            >
              Speed
            </Typography>
            <Slider
              value={playbackRate}
              min={SPEED_MIN}
              max={SPEED_MAX}
              step={SPEED_STEP}
              onChange={handleSpeedChange}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${v}x`}
              marks={[
                { value: 0.5, label: '0.5x' },
                { value: 1, label: '1x' },
                { value: 1.5, label: '1.5x' },
                { value: 2, label: '2x' },
              ]}
              sx={{
                width: '100%',
                '& .MuiSlider-valueLabel': {
                  fontSize: '0.75rem',
                  fontWeight: 600,
                },
                '& .MuiSlider-markLabel': {
                  fontSize: '0.75rem',
                  fontWeight: 600,
                },
              }}
            />
          </Box>
        </Menu>
      </ButtonRow>
    </ControlsBar>
  );
}

export const CONTROLS_HEIGHT = 120;
