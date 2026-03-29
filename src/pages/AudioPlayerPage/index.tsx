import { useState, useEffect, useCallback, useRef } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { styled } from '../../lib/styled';
import { useAudioPlayerContext } from '../../contexts/AudioPlayerContext';
import { useTranslationContext } from '../../hooks/useTranslationContext';
import { usePageTitle } from '../../hooks/usePageTitle';
import { TranscriptView } from './TranscriptView';
import { AudioControls, CONTROLS_HEIGHT } from './AudioControls';

const PlayerContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
});

const TranscriptArea = styled(Box)<{ $controlsHeight: number }>(({ $controlsHeight }) => ({
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  paddingBottom: $controlsHeight,
}));

const CenterBox = styled(Box)({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export function AudioPlayerPage() {
  const {
    activeAudioId,
    audioItem,
    isPlaying,
    currentTime,
    duration,
    activeSegmentIndex,
    playbackRate,
    hasStartedPlayback,
    loading,
    error,
    hasNext,
    hasPrevious,
    play,
    pause,
    togglePlay,
    seek,
    setPlaybackRate,
    setHasStartedPlayback,
    nextTrack,
    previousTrack,
  } = useAudioPlayerContext();
  const [controlsHeight, setControlsHeight] = useState(CONTROLS_HEIGHT);
  const wasPlayingBeforeSeekRef = useRef(false);
  const { handleDailyLimitReached } = useTranslationContext();
  usePageTitle(audioItem?.title || 'Audio');

  const handleSeekToSegment = useCallback(
    (time: number) => {
      seek(time);
      if (!isPlaying) {
        setHasStartedPlayback(true);
        play();
      }
    },
    [seek, play, isPlaying, setHasStartedPlayback]
  );

  const handleSyncToCurrent = useCallback(() => {
    if (!isPlaying) {
      setHasStartedPlayback(true);
      play();
    }
  }, [isPlaying, play, setHasStartedPlayback]);

  const handleTogglePlay = useCallback(() => {
    if (!isPlaying) {
      setHasStartedPlayback(true);
    }
    togglePlay();
  }, [isPlaying, togglePlay, setHasStartedPlayback]);

  const handleSeekStart = useCallback(() => {
    wasPlayingBeforeSeekRef.current = isPlaying;
    if (isPlaying) {
      pause();
    }
  }, [isPlaying, pause]);

  const handleSeekEnd = useCallback(() => {
    if (wasPlayingBeforeSeekRef.current) {
      play();
    }
    wasPlayingBeforeSeekRef.current = false;
  }, [play]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }
      e.preventDefault();
      handleTogglePlay();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleTogglePlay]);

  if (!activeAudioId) {
    return <Navigate to="/audio" replace />;
  }

  if (loading) {
    return (
      <CenterBox>
        <CircularProgress />
      </CenterBox>
    );
  }

  if (error) {
    return (
      <CenterBox>
        <Typography color="error">{error}</Typography>
      </CenterBox>
    );
  }

  if (audioItem?.status === 'processing') {
    return (
      <CenterBox>
        <Box textAlign="center">
          <CircularProgress sx={{ mb: 2 }} />
          <Typography>Transcribing audio...</Typography>
          <Typography variant="body2" color="text.secondary">
            This may take a few minutes
          </Typography>
        </Box>
      </CenterBox>
    );
  }

  return (
    <PlayerContainer>
      <TranscriptArea $controlsHeight={controlsHeight}>
        <TranscriptView
          transcript={audioItem?.transcript ?? []}
          activeSegmentIndex={activeSegmentIndex}
          hasStartedPlayback={hasStartedPlayback}
          onDailyLimitReached={handleDailyLimitReached}
          onWordTap={pause}
          onSeekToSegment={handleSeekToSegment}
          onSyncToCurrent={handleSyncToCurrent}
          controlsHeight={controlsHeight}
        />
      </TranscriptArea>

      <AudioControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        playbackRate={playbackRate}
        hasNext={hasNext}
        hasPrevious={hasPrevious}
        onTogglePlay={handleTogglePlay}
        onSeek={seek}
        onSeekStart={handleSeekStart}
        onSeekEnd={handleSeekEnd}
        onSetPlaybackRate={setPlaybackRate}
        onNextTrack={nextTrack}
        onPreviousTrack={previousTrack}
        onHeightChange={setControlsHeight}
      />
    </PlayerContainer>
  );
}
