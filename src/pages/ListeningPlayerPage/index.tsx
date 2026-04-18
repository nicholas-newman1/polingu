import { useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Box, IconButton, Stack, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import SkipPreviousIcon from '@mui/icons-material/SkipPrevious';
import SettingsIcon from '@mui/icons-material/Settings';
import { styled } from '../../lib/styled';
import { useListening } from '../../contexts/ListeningContext';
import { ListeningSettingsPanel } from '../../components/ListeningSettingsPanel';
import { useState } from 'react';

const PageContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: theme.spacing(2),
  gap: theme.spacing(3),
  maxWidth: 720,
  margin: '0 auto',
  width: '100%',
}));

const CardArea = styled(Box)(({ theme }) => ({
  width: '100%',
  padding: theme.spacing(4, 3),
  borderRadius: theme.spacing(2),
  backgroundColor: theme.palette.background.paper,
  border: `1px solid ${theme.palette.divider}`,
  textAlign: 'center',
  minHeight: 220,
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'center',
  gap: theme.spacing(1),
}));

const PlayButton = styled(IconButton)(({ theme }) => ({
  width: 72,
  height: 72,
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  '&:hover': {
    backgroundColor: theme.palette.primary.dark,
  },
}));

const SideButton = styled(IconButton)({
  width: 72,
  height: 72,
});

const MetaChip = styled(Box)(({ theme }) => ({
  alignSelf: 'center',
  padding: theme.spacing(0.25, 1),
  borderRadius: 999,
  backgroundColor: theme.palette.action.hover,
  color: theme.palette.text.secondary,
  fontSize: '0.7rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.5,
}));

export function ListeningPlayerPage() {
  const navigate = useNavigate();
  const {
    isActive,
    isPlaying,
    currentItem,
    currentIndex,
    queue,
    currentRepetition,
    meta,
    settings,
    togglePlay,
    next,
    previous,
    updateSettings,
  } = useListening();

  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    if (!isActive && !currentItem) {
      const t = setTimeout(() => {
        navigate('/listen', { replace: true });
      }, 300);
      return () => clearTimeout(t);
    }
  }, [isActive, currentItem, navigate]);

  if (!isActive || !currentItem) {
    return <Navigate to="/listen" replace />;
  }

  const totalReps = currentItem.isLearned
    ? settings.learned.repetitions
    : settings.unknown.repetitions;

  return (
    <PageContainer data-qa="listening-player-page">
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ width: '100%' }}
      >
        <Typography variant="body2" color="text.secondary">
          {meta?.title ?? 'Listening'}
          {meta?.subtitle ? ` · ${meta.subtitle}` : ''}
        </Typography>
        <Stack direction="row" spacing={0.5}>
          <IconButton
            size="small"
            onClick={() => setShowSettings((v) => !v)}
            aria-label="Toggle settings"
            data-qa="toggle-listening-settings"
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Stack>
      </Stack>

      {showSettings && (
        <Box sx={{ width: '100%' }}>
          <ListeningSettingsPanel
            settings={settings}
            onChange={(updates) => {
              void updateSettings(updates);
            }}
          />
        </Box>
      )}

      <CardArea data-qa="listening-current-card">
        <MetaChip>
          {currentItem.feature === 'sentences'
            ? 'Sentence'
            : currentItem.feature === 'vocabulary'
              ? 'Word'
              : 'Declension'}{' '}
          · {currentIndex + 1}/{queue.length}
          {totalReps > 1 ? ` · rep ${currentRepetition}/${totalReps}` : ''}
          {currentItem.isLearned ? ' · learned' : ''}
        </MetaChip>
        <Typography variant="h4" fontWeight={700} lang="pl">
          {currentItem.primaryText}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {currentItem.secondaryText}
        </Typography>
      </CardArea>

      <Stack direction="row" spacing={3} alignItems="center" justifyContent="center">
        <SideButton onClick={previous} aria-label="Previous" disabled={currentIndex === 0}>
          <SkipPreviousIcon fontSize="large" />
        </SideButton>
        <PlayButton onClick={togglePlay} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? <PauseIcon fontSize="large" /> : <PlayArrowIcon fontSize="large" />}
        </PlayButton>
        <SideButton onClick={next} aria-label="Next" disabled={currentIndex >= queue.length - 1}>
          <SkipNextIcon fontSize="large" />
        </SideButton>
      </Stack>
    </PageContainer>
  );
}
