import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { styled } from '../../lib/styled';
import { subscribeToAudioItem, getAudioDownloadUrl } from '../../lib/audio';
import { useTranscriptPlayer } from '../../hooks/useTranscriptPlayer';
import { useTranslationContext } from '../../hooks/useTranslationContext';
import { TranscriptView } from './TranscriptView';
import { AudioControls, CONTROLS_HEIGHT } from './AudioControls';
import type { AudioItem } from '../../types/audio';

const PlayerContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
  minHeight: 0,
});

const TranscriptArea = styled(Box)({
  flex: 1,
  minHeight: 0,
  display: 'flex',
  flexDirection: 'column',
  paddingBottom: CONTROLS_HEIGHT,
});

const CenterBox = styled(Box)({
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

export function AudioPlayerPage() {
  const { audioId } = useParams<{ audioId: string }>();
  const [audioItem, setAudioItem] = useState<AudioItem | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { handleDailyLimitReached } = useTranslationContext();

  const {
    audioRef,
    isPlaying,
    currentTime,
    duration,
    activeSegmentIndex,
    playbackRate,
    pause,
    play,
    togglePlay,
    seek,
    setPlaybackRate,
  } = useTranscriptPlayer({
    audioUrl,
    transcript: audioItem?.transcript ?? [],
  });

  const handleSeekToSegment = useCallback(
    (time: number) => {
      seek(time);
      if (!isPlaying) play();
    },
    [seek, play, isPlaying]
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      togglePlay();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [togglePlay]);

  useEffect(() => {
    if (!audioId) return;

    const unsubscribe = subscribeToAudioItem(audioId, async (item) => {
      setAudioItem(item);

      if (item?.status === 'ready' && item.storagePath && !audioUrl) {
        try {
          const url = await getAudioDownloadUrl(item.storagePath);
          setAudioUrl(url);
        } catch (err) {
          console.error('Failed to get audio URL:', err);
          setError('Failed to load audio file.');
        }
      } else if (item?.status === 'error') {
        setError(item.error || 'Processing failed.');
      } else if (!item) {
        setError('Audio item not found.');
      }

      setLoading(false);
    });

    return unsubscribe;
  }, [audioId, audioUrl]);

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
      {audioUrl && (
        <audio ref={audioRef} src={audioUrl} preload="auto" />
      )}

      <TranscriptArea>
        <TranscriptView
          transcript={audioItem?.transcript ?? []}
          activeSegmentIndex={activeSegmentIndex}
          onDailyLimitReached={handleDailyLimitReached}
          onWordTap={pause}
          onSeekToSegment={handleSeekToSegment}
        />
      </TranscriptArea>

      <AudioControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        playbackRate={playbackRate}
        onTogglePlay={togglePlay}
        onSeek={seek}
        onSetPlaybackRate={setPlaybackRate}
      />
    </PlayerContainer>
  );
}
