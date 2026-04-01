import { useEffect, useRef, useState } from 'react';
import {
  Box,
  IconButton,
  Slider,
  Typography,
  ButtonBase,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import Replay10Icon from '@mui/icons-material/Replay10';
import Forward10Icon from '@mui/icons-material/Forward10';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import FormatSizeIcon from '@mui/icons-material/FormatSize';
import CheckIcon from '@mui/icons-material/Check';
import { styled } from '../../lib/styled';
import { DRAWER_WIDTH } from '../../components/Layout';
import { BOTTOM_MENU_BAR_HEIGHT } from '../../components/BottomMenu/BottomMenuBar';
import type { TranscriptFontSize } from '../../types/appSettings';

const ControlsBar = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: BOTTOM_MENU_BAR_HEIGHT,
  left: 0,
  right: 0,
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(0.5, 2, 1),
  zIndex: theme.zIndex.appBar + 1,
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
  gap: 8,
  flex: 1,
});

const ProgressSlider = styled(Slider)({
  '&.MuiSlider-root': {
    padding: 0,
    marginBottom: 4,
  },
  '& .MuiSlider-thumb': {
    width: 12,
    height: 12,
  },
});

const FontSizeButton = styled(ButtonBase)(({ theme }) => ({
  width: 48,
  minWidth: 48,
  height: 32,
  borderRadius: theme.shape.borderRadius,
  color: theme.palette.text.secondary,
  flexShrink: 0,
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

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
  hasNext: boolean;
  hasPrevious: boolean;
  fontSize: TranscriptFontSize;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onSeekStart?: () => void;
  onSeekEnd?: () => void;
  onSetPlaybackRate: (rate: number) => void;
  onNextTrack: () => void;
  onPreviousTrack: () => void;
  onFontSizeChange: (size: TranscriptFontSize) => void;
  onHeightChange?: (height: number) => void;
}

const FONT_SIZE_OPTIONS: { value: TranscriptFontSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

export function AudioControls({
  isPlaying,
  currentTime,
  duration,
  playbackRate,
  hasNext,
  hasPrevious,
  fontSize,
  onTogglePlay,
  onSeek,
  onSeekStart,
  onSeekEnd,
  onSetPlaybackRate,
  onNextTrack,
  onPreviousTrack,
  onFontSizeChange,
  onHeightChange,
}: AudioControlsProps) {
  const [speedMenuAnchor, setSpeedMenuAnchor] = useState<HTMLElement | null>(null);
  const [fontSizeMenuAnchor, setFontSizeMenuAnchor] = useState<HTMLElement | null>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const controlsRef = useRef<HTMLDivElement>(null);
  const lastHeightRef = useRef(0);

  useEffect(() => {
    if (!onHeightChange || !controlsRef.current) return;

    const notifyHeight = () => {
      if (!controlsRef.current) return;
      const nextHeight = Math.round(controlsRef.current.getBoundingClientRect().height);
      if (!nextHeight || nextHeight === lastHeightRef.current) return;
      lastHeightRef.current = nextHeight;
      onHeightChange(nextHeight + BOTTOM_MENU_BAR_HEIGHT);
    };

    notifyHeight();

    const observer = new ResizeObserver(() => {
      notifyHeight();
    });

    observer.observe(controlsRef.current);
    return () => observer.disconnect();
  }, [onHeightChange]);

  const handleSeekChange = (_: Event, value: number | number[]) => {
    const nextTime = value as number;
    if (!isSeeking) {
      setIsSeeking(true);
      onSeekStart?.();
    }
    setSeekValue(nextTime);
  };

  const handleSeekCommit = (_: unknown, value: number | number[]) => {
    const nextTime = value as number;
    onSeek(nextTime);
    setSeekValue(nextTime);
    setIsSeeking(false);
    onSeekEnd?.();
  };

  const handleSpeedChange = (_: Event, value: number | number[]) => {
    onSetPlaybackRate(value as number);
  };

  return (
    <ControlsBar ref={controlsRef}>
      <ProgressSlider
        value={isSeeking ? seekValue : currentTime}
        max={duration || 1}
        onChange={handleSeekChange}
        onChangeCommitted={handleSeekCommit}
        size="small"
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
            onClick={onPreviousTrack}
            disabled={!hasPrevious}
            aria-label="Previous track"
            sx={{ width: 36, height: 36, color: 'text.primary' }}
          >
            <SkipPreviousIcon />
          </IconButton>
          <IconButton
            onClick={() => onSeek(Math.max(0, currentTime - 10))}
            aria-label="Skip back 10 seconds"
            sx={{ width: 36, height: 36, color: 'text.primary' }}
          >
            <Replay10Icon />
          </IconButton>
          <IconButton
            onClick={onTogglePlay}
            sx={{
              bgcolor: 'primary.main',
              color: 'primary.contrastText',
              '&:hover': { bgcolor: 'primary.dark' },
              width: 40,
              height: 40,
            }}
          >
            {isPlaying ? <PauseIcon fontSize="small" /> : <PlayArrowIcon fontSize="small" />}
          </IconButton>
          <IconButton
            onClick={() => onSeek(Math.min(duration, currentTime + 10))}
            aria-label="Skip ahead 10 seconds"
            sx={{ width: 36, height: 36, color: 'text.primary' }}
          >
            <Forward10Icon />
          </IconButton>
          <IconButton
            onClick={onNextTrack}
            disabled={!hasNext}
            aria-label="Next track"
            sx={{ width: 36, height: 36, color: 'text.primary' }}
          >
            <SkipNextIcon />
          </IconButton>
        </PlaybackGroup>
        <FontSizeButton
          onClick={(e) => setFontSizeMenuAnchor(e.currentTarget)}
          aria-controls={fontSizeMenuAnchor ? 'font-size-menu' : undefined}
          aria-haspopup="true"
          aria-expanded={!!fontSizeMenuAnchor}
          aria-label="Change font size"
        >
          <FormatSizeIcon fontSize="small" />
        </FontSizeButton>
        <Menu
          id="font-size-menu"
          anchorEl={fontSizeMenuAnchor}
          open={!!fontSizeMenuAnchor}
          onClose={() => setFontSizeMenuAnchor(null)}
          anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
          transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          {FONT_SIZE_OPTIONS.map((option) => (
            <MenuItem
              key={option.value}
              selected={fontSize === option.value}
              onClick={() => {
                onFontSizeChange(option.value);
                setFontSizeMenuAnchor(null);
              }}
            >
              {fontSize === option.value && (
                <ListItemIcon>
                  <CheckIcon fontSize="small" />
                </ListItemIcon>
              )}
              <ListItemText inset={fontSize !== option.value}>{option.label}</ListItemText>
            </MenuItem>
          ))}
        </Menu>
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

export const CONTROLS_HEIGHT = 108 + BOTTOM_MENU_BAR_HEIGHT;
