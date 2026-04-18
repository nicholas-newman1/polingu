import { Box, IconButton, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import CloseIcon from '@mui/icons-material/Close';
import { styled } from '../lib/styled';
import { useListening } from '../contexts/ListeningContext';
import { DRAWER_WIDTH } from './Layout';
import { BOTTOM_MENU_BAR_HEIGHT } from './BottomMenu/BottomMenuBar';

export const LISTENING_MINI_BAR_HEIGHT = 64;

const Bar = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: BOTTOM_MENU_BAR_HEIGHT,
  left: 0,
  right: 0,
  height: LISTENING_MINI_BAR_HEIGHT,
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(0, 1, 0, 1.5),
  zIndex: theme.zIndex.appBar + 1,
  cursor: 'pointer',
  [theme.breakpoints.up('md')]: {
    left: DRAWER_WIDTH,
  },
}));

const TrackIcon = styled(Box)(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: 999,
  backgroundColor: theme.palette.success.main,
  color: theme.palette.common.white,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}));

const TrackInfo = styled(Box)({
  flex: 1,
  minWidth: 0,
});

export function ListeningMiniBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const {
    isActive,
    isPlaying,
    currentItem,
    currentIndex,
    queue,
    currentRepetition,
    meta,
    togglePlay,
    next,
    previous,
    stop,
    settings,
  } = useListening();

  if (!isActive || !currentItem) return null;
  if (location.pathname === '/listen/play') return null;

  const reps = currentItem.isLearned ? settings.learned.repetitions : settings.unknown.repetitions;

  return (
    <Bar
      onClick={() => navigate('/listen/play')}
      data-qa="listening-mini-bar"
      role="button"
      aria-label="Open listening player"
    >
      <TrackIcon>
        <HeadphonesIcon sx={{ fontSize: 18 }} />
      </TrackIcon>
      <TrackInfo>
        <Typography variant="body2" fontWeight={700} noWrap>
          {currentItem.primaryText}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {meta?.title ?? 'Listening'} · {currentIndex + 1}/{queue.length}
          {reps > 1 ? ` · rep ${currentRepetition}/${reps}` : ''}
        </Typography>
      </TrackInfo>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          previous();
        }}
        aria-label="Previous"
        sx={{ color: 'text.primary' }}
      >
        <SkipPreviousIcon />
      </IconButton>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        aria-label={isPlaying ? 'Pause' : 'Play'}
        sx={{ color: 'text.primary' }}
      >
        {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
      </IconButton>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          next();
        }}
        aria-label="Next"
        sx={{ color: 'text.primary' }}
      >
        <SkipNextIcon />
      </IconButton>
      <IconButton
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          stop();
        }}
        aria-label="Stop listening"
        sx={{ color: 'text.secondary' }}
      >
        <CloseIcon fontSize="small" />
      </IconButton>
    </Bar>
  );
}
