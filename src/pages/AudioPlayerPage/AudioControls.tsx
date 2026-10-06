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
import EditNoteIcon from '@mui/icons-material/EditNote';
import CheckIcon from '@mui/icons-material/Check';
import { styled } from '../../lib/styled';
import { BOTTOM_MENU_BAR_HEIGHT, DRAWER_WIDTH } from '../../constants/layout';
import type { TranscriptFontSize } from '../../types/appSettings';
import { formatDuration } from '../../lib/utils/formatDuration';
import { useAudioPlayerContext } from '../../contexts/AudioPlayerContext';

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

const ProgressSliderWrapper = styled(Box)({
  position: 'relative',
});

const ProgressSlider = styled(Slider)({
  '&.MuiSlider-root': {
    padding: '10px 0',
    marginBottom: 0,
    display: 'block',
  },
  '& .MuiSlider-thumb': {
    width: 12,
    height: 12,
  },
});

const SeekTooltip = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: 'calc(100% + 6px)',
  transform: 'translateX(-50%)',
  padding: theme.spacing(0.25, 0.75),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.grey[800],
  color: theme.palette.common.white,
  fontSize: '0.7rem',
  fontWeight: 600,
  lineHeight: 1.4,
  pointerEvents: 'none',
  whiteSpace: 'nowrap',
  zIndex: 1,
}));

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

const SPEED_MIN = 0.5;
const SPEED_MAX = 2;
const SPEED_STEP = 0.1;

const FONT_SIZE_OPTIONS: { value: TranscriptFontSize; label: string }[] = [
  { value: 'small', label: 'Small' },
  { value: 'medium', label: 'Medium' },
  { value: 'large', label: 'Large' },
];

const SKIP_BUTTON_SX = { width: 36, height: 36, color: 'text.primary' } as const;

/** Reports the bar's rendered height (plus the bottom menu) whenever it changes. */
function useReportHeight(
  ref: React.RefObject<HTMLDivElement | null>,
  onHeightChange: ((height: number) => void) | undefined
) {
  const lastHeightRef = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!onHeightChange || !el) return;

    const notifyHeight = () => {
      const nextHeight = Math.round(el.getBoundingClientRect().height);
      if (!nextHeight || nextHeight === lastHeightRef.current) return;
      lastHeightRef.current = nextHeight;
      onHeightChange(nextHeight + BOTTOM_MENU_BAR_HEIGHT);
    };

    notifyHeight();
    const observer = new ResizeObserver(notifyHeight);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref, onHeightChange]);
}

/** Progress slider with a hover/drag time preview; playback pauses while dragging. */
function SeekBar() {
  const { isPlaying, currentTime, duration, seek, play, pause } = useAudioPlayerContext();
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [hoverPercent, setHoverPercent] = useState<number | null>(null);
  const sliderWrapperRef = useRef<HTMLDivElement>(null);
  const wasPlayingBeforeSeekRef = useRef(false);

  const handleSeekChange = (_: Event, value: number | number[]) => {
    if (!isSeeking) {
      setIsSeeking(true);
      wasPlayingBeforeSeekRef.current = isPlaying;
      if (isPlaying) pause();
    }
    setSeekValue(value as number);
  };

  const handleSeekCommit = (_: unknown, value: number | number[]) => {
    const nextTime = value as number;
    seek(nextTime);
    setSeekValue(nextTime);
    setIsSeeking(false);
    if (wasPlayingBeforeSeekRef.current) play();
    wasPlayingBeforeSeekRef.current = false;
  };

  const handleHoverMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = sliderWrapperRef.current?.getBoundingClientRect();
    if (!rect || rect.width <= 0 || !duration) return;
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverPercent(ratio * 100);
  };

  const seekingPercent = duration > 0 ? (seekValue / duration) * 100 : 0;
  const tooltipPercent = isSeeking ? seekingPercent : hoverPercent;
  const displayedTime = isSeeking ? seekValue : currentTime;

  return (
    <>
      <ProgressSliderWrapper
        ref={sliderWrapperRef}
        onMouseMove={handleHoverMove}
        onMouseLeave={() => setHoverPercent(null)}
      >
        {tooltipPercent !== null && duration > 0 && (
          <SeekTooltip sx={{ left: `${tooltipPercent}%` }}>
            {formatDuration((tooltipPercent / 100) * duration)}
          </SeekTooltip>
        )}
        <ProgressSlider
          value={displayedTime}
          max={duration || 1}
          onChange={handleSeekChange}
          onChangeCommitted={handleSeekCommit}
          size="small"
        />
      </ProgressSliderWrapper>
      <TimeRow>
        <Typography variant="caption" color={isSeeking ? 'text.primary' : 'text.secondary'}>
          {formatDuration(displayedTime)}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatDuration(duration)}
        </Typography>
      </TimeRow>
    </>
  );
}

function SpeedControl() {
  const { playbackRate, setPlaybackRate } = useAudioPlayerContext();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <SpeedButton
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-controls={anchor ? 'speed-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={!!anchor}
        sx={{ flexShrink: 0 }}
      >
        {`${playbackRate}x`}
      </SpeedButton>
      <Menu
        id="speed-menu"
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
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
            onChange={(_, value) => setPlaybackRate(value as number)}
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
    </>
  );
}

function PlaybackButtons() {
  const {
    isPlaying,
    currentTime,
    duration,
    hasNext,
    hasPrevious,
    togglePlay,
    seek,
    nextTrack,
    previousTrack,
  } = useAudioPlayerContext();

  return (
    <PlaybackGroup>
      <IconButton
        onClick={previousTrack}
        disabled={!hasPrevious}
        aria-label="Previous track"
        sx={SKIP_BUTTON_SX}
      >
        <SkipPreviousIcon />
      </IconButton>
      <IconButton
        onClick={() => seek(Math.max(0, currentTime - 10))}
        aria-label="Skip back 10 seconds"
        sx={SKIP_BUTTON_SX}
      >
        <Replay10Icon />
      </IconButton>
      <IconButton
        onClick={togglePlay}
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
        onClick={() => seek(Math.min(duration, currentTime + 10))}
        aria-label="Skip ahead 10 seconds"
        sx={SKIP_BUTTON_SX}
      >
        <Forward10Icon />
      </IconButton>
      <IconButton
        onClick={nextTrack}
        disabled={!hasNext}
        aria-label="Next track"
        sx={SKIP_BUTTON_SX}
      >
        <SkipNextIcon />
      </IconButton>
    </PlaybackGroup>
  );
}

function EditModeButton({ editMode, onToggle }: { editMode: boolean; onToggle?: () => void }) {
  return (
    <IconButton
      onClick={onToggle}
      aria-label={editMode ? 'Exit transcript edit mode' : 'Edit transcript'}
      aria-pressed={editMode}
      sx={{
        width: 32,
        height: 32,
        flexShrink: 0,
        mr: 0.5,
        color: editMode ? 'primary.contrastText' : 'text.secondary',
        bgcolor: editMode ? 'primary.main' : 'transparent',
        '&:hover': { bgcolor: editMode ? 'primary.dark' : 'action.hover' },
      }}
    >
      <EditNoteIcon fontSize="small" />
    </IconButton>
  );
}

function FontSizeControl({
  fontSize,
  onChange,
}: {
  fontSize: TranscriptFontSize;
  onChange: (size: TranscriptFontSize) => void;
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <FontSizeButton
        onClick={(e) => setAnchor(e.currentTarget)}
        aria-controls={anchor ? 'font-size-menu' : undefined}
        aria-haspopup="true"
        aria-expanded={!!anchor}
        aria-label="Change font size"
      >
        <FormatSizeIcon fontSize="small" />
      </FontSizeButton>
      <Menu
        id="font-size-menu"
        anchorEl={anchor}
        open={!!anchor}
        onClose={() => setAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {FONT_SIZE_OPTIONS.map((option) => {
          const selected = fontSize === option.value;
          return (
            <MenuItem
              key={option.value}
              selected={selected}
              onClick={() => {
                onChange(option.value);
                setAnchor(null);
              }}
            >
              {selected && (
                <ListItemIcon>
                  <CheckIcon fontSize="small" />
                </ListItemIcon>
              )}
              <ListItemText inset={!selected}>{option.label}</ListItemText>
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}

interface AudioControlsProps {
  fontSize: TranscriptFontSize;
  onFontSizeChange: (size: TranscriptFontSize) => void;
  onHeightChange?: (height: number) => void;
  editModeAvailable?: boolean;
  editMode?: boolean;
  onToggleEditMode?: () => void;
}

export function AudioControls({
  fontSize,
  onFontSizeChange,
  onHeightChange,
  editModeAvailable = false,
  editMode = false,
  onToggleEditMode,
}: AudioControlsProps) {
  const controlsRef = useRef<HTMLDivElement>(null);
  useReportHeight(controlsRef, onHeightChange);

  return (
    <ControlsBar ref={controlsRef}>
      <SeekBar />
      <ButtonRow>
        <SpeedControl />
        <PlaybackButtons />
        {editModeAvailable && <EditModeButton editMode={editMode} onToggle={onToggleEditMode} />}
        <FontSizeControl fontSize={fontSize} onChange={onFontSizeChange} />
      </ButtonRow>
    </ControlsBar>
  );
}

export const CONTROLS_HEIGHT = 108 + BOTTOM_MENU_BAR_HEIGHT;
