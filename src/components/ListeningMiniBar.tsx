import { IconButton, Typography } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import CloseIcon from '@mui/icons-material/Close';
import { useListening } from '../contexts/ListeningContext';
import { MiniBar, MiniBarTrackInfo, TrackIcon } from './audioStyles';

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
    totalRepetitions,
    meta,
    togglePlay,
    next,
    previous,
    stop,
  } = useListening();

  if (!isActive || !currentItem) return null;
  if (location.pathname === '/listen/play') return null;

  return (
    <MiniBar
      onClick={() => navigate('/listen/play')}
      data-qa="listening-mini-bar"
      role="button"
      aria-label="Open listening player"
      sx={{ gap: 1, pl: 1.5 }}
    >
      <TrackIcon sx={{ bgcolor: 'success.main', color: 'common.white' }}>
        <HeadphonesIcon sx={{ fontSize: 18 }} />
      </TrackIcon>
      <MiniBarTrackInfo>
        <Typography variant="body2" fontWeight={700} noWrap>
          {currentItem.primaryText}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {meta?.title ?? 'Listening'} · {currentIndex + 1}/{queue.length}
          {totalRepetitions > 1 ? ` · rep ${currentRepetition}/${totalRepetitions}` : ''}
        </Typography>
      </MiniBarTrackInfo>
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
    </MiniBar>
  );
}
