import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, IconButton, Slider, Typography } from '@mui/material';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { styled } from '../lib/styled';
import { useAudioPlayerContext } from '../contexts/AudioPlayerContext';
import { DRAWER_WIDTH } from './Layout';
import { BOTTOM_MENU_BAR_HEIGHT } from './BottomMenu/BottomMenuBar';
import { QueueDrawer } from './QueueDrawer';

export const MINI_PLAYER_HEIGHT = 64;

const Bar = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: BOTTOM_MENU_BAR_HEIGHT,
  left: 0,
  right: 0,
  height: MINI_PLAYER_HEIGHT,
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(0, 1, 0, 2),
  zIndex: theme.zIndex.appBar + 1,
  cursor: 'pointer',
  [theme.breakpoints.up('md')]: {
    left: DRAWER_WIDTH,
  },
}));

const TrackInfo = styled(Box)({
  flex: 1,
  minWidth: 0,
});

const TrackIcon = styled(Box)(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: 999,
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}));

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function MiniPlayerBar() {
  const navigate = useNavigate();
  const {
    activeAudioId,
    audioItem,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    _debugPosState,
  } = useAudioPlayerContext();
  const [queueOpen, setQueueOpen] = useState(false);

  if (!activeAudioId || !audioItem) return null;

  return (
    <>
      <Bar onClick={() => navigate('/audio/player')}>
        <TrackIcon>
          <HeadphonesIcon sx={{ fontSize: 18 }} />
        </TrackIcon>
        <TrackInfo>
          <Typography variant="body2" fontWeight={700} noWrap>
            {audioItem.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </Typography>
        </TrackInfo>
        <Slider
          value={currentTime}
          max={duration || 1}
          size="small"
          sx={{
            width: 80,
            mx: 0.5,
            p: 0,
            '& .MuiSlider-thumb': { display: 'none' },
            '& .MuiSlider-track': { transition: 'none' },
          }}
          onClick={(e) => e.stopPropagation()}
        />
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            togglePlay();
          }}
          sx={{ color: 'text.primary' }}
        >
          {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
        </IconButton>
        <IconButton
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            setQueueOpen(true);
          }}
          sx={{ color: 'text.secondary' }}
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Bar>
      <QueueDrawer open={queueOpen} onClose={() => setQueueOpen(false)} />
      {_debugPosState && (
        <Box
          sx={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bgcolor: 'rgba(0,0,0,0.85)',
            color: '#0f0',
            fontSize: 11,
            fontFamily: 'monospace',
            p: 0.5,
            zIndex: 99999,
            textAlign: 'center',
          }}
        >
          MS: {_debugPosState}
        </Box>
      )}
    </>
  );
}
