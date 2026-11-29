import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconButton, Slider, Typography } from '@mui/material';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useAudioPlayerContext } from '../contexts/AudioPlayerContext';
import { QueueDrawer } from './QueueDrawer';
import { MiniBar, MiniBarTrackInfo, TrackIcon } from './audioStyles';
import { formatDuration } from '../lib/utils/formatDuration';

export function MiniPlayerBar() {
  const navigate = useNavigate();
  const { activeAudioId, audioItem, isPlaying, currentTime, duration, togglePlay } =
    useAudioPlayerContext();
  const [queueOpen, setQueueOpen] = useState(false);

  if (!activeAudioId || !audioItem) return null;

  return (
    <>
      <MiniBar onClick={() => navigate('/audio/player')}>
        <TrackIcon>
          <HeadphonesIcon sx={{ fontSize: 18 }} />
        </TrackIcon>
        <MiniBarTrackInfo>
          <Typography variant="body2" fontWeight={700} noWrap>
            {audioItem.title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {formatDuration(currentTime)} / {formatDuration(duration)}
          </Typography>
        </MiniBarTrackInfo>
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
          aria-label={isPlaying ? 'Pause' : 'Play'}
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
          aria-label="Queue"
        >
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </MiniBar>
      <QueueDrawer open={queueOpen} onClose={() => setQueueOpen(false)} />
    </>
  );
}
