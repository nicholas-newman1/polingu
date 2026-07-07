import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { styled } from '../../lib/styled';
import { useAudioPlayerContext } from '../../contexts/AudioPlayerContext';
import { useAuthContext } from '../../hooks/useAuthContext';
import { useTranslationContext } from '../../hooks/useTranslationContext';
import { useTranscriptFontSize } from '../../hooks/useTranscriptFontSize';
import { usePageTitle } from '../../hooks/usePageTitle';
import { updateSystemAudio } from '../../lib/audio/systemAudioItems';
import type { TranscriptSegment, TranscriptWord } from '../../types/audio';
import { TranscriptView } from './TranscriptView';
import { AudioControls, CONTROLS_HEIGHT } from './AudioControls';
import { EditTranscriptSegmentDialog } from './EditTranscriptSegmentDialog';

function rebuildSegmentWords(text: string, startTime: number, endTime: number): TranscriptWord[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return [];
  const span = Math.max(0, endTime - startTime);
  const per = span / tokens.length;
  return tokens.map((word, i) => ({
    word,
    startTime: startTime + per * i,
    endTime: startTime + per * (i + 1),
    confidence: 1,
  }));
}

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
    systemItems,
    isPlaying,
    currentTime,
    duration,
    activeSegmentIndex,
    playbackRate,
    loading,
    error,
    hasNext,
    hasPrevious,
    play,
    pause,
    togglePlay,
    seek,
    setPlaybackRate,
    nextTrack,
    previousTrack,
  } = useAudioPlayerContext();
  const { isAdmin } = useAuthContext();
  const [controlsHeight, setControlsHeight] = useState(CONTROLS_HEIGHT);
  const wasPlayingBeforeSeekRef = useRef(false);
  const { handleDailyLimitReached } = useTranslationContext();
  const [transcriptFontSize, setTranscriptFontSize] = useTranscriptFontSize();
  const [editMode, setEditMode] = useState(false);
  const [editingSegment, setEditingSegment] = useState<number | null>(null);
  const [trackedAudioId, setTrackedAudioId] = useState(activeAudioId);
  usePageTitle(audioItem?.title || 'Audio');

  const canEditTranscript = useMemo(
    () => isAdmin && !!activeAudioId && systemItems.some((i) => i.id === activeAudioId),
    [isAdmin, activeAudioId, systemItems]
  );

  if (activeAudioId !== trackedAudioId) {
    setTrackedAudioId(activeAudioId);
    setEditMode(false);
    setEditingSegment(null);
  } else if (!canEditTranscript && (editMode || editingSegment !== null)) {
    setEditMode(false);
    setEditingSegment(null);
  }

  const handleToggleEditMode = useCallback(() => {
    setEditMode((prev) => {
      const next = !prev;
      if (next && isPlaying) pause();
      return next;
    });
  }, [isPlaying, pause]);

  const handleEditSegment = useCallback((segIdx: number) => {
    setEditingSegment(segIdx);
  }, []);

  const closeEditor = useCallback(() => {
    setEditingSegment(null);
  }, []);

  const handleSaveSegment = useCallback(
    async (text: string) => {
      if (editingSegment === null || !activeAudioId || !audioItem) return;
      const original = audioItem.transcript?.[editingSegment];
      if (!original) return;
      if (text === original.text.trim()) {
        closeEditor();
        return;
      }
      const nextTranscript: TranscriptSegment[] = audioItem.transcript.map((segment, idx) =>
        idx === editingSegment
          ? {
              ...segment,
              text,
              words: rebuildSegmentWords(text, segment.startTime, segment.endTime),
            }
          : segment
      );
      await updateSystemAudio(activeAudioId, { transcript: nextTranscript });
      closeEditor();
    },
    [editingSegment, activeAudioId, audioItem, closeEditor]
  );

  const handleSeekToSegment = useCallback(
    (time: number) => {
      seek(Math.max(0, time - 0.2));
      if (!isPlaying) play();
    },
    [seek, play, isPlaying]
  );

  const handleTogglePlay = useCallback(() => {
    togglePlay();
  }, [togglePlay]);

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
          fontSize={transcriptFontSize}
          onDailyLimitReached={handleDailyLimitReached}
          onWordTap={pause}
          onSeekToSegment={handleSeekToSegment}
          editMode={editMode}
          onEditSegment={handleEditSegment}
        />
      </TranscriptArea>

      <AudioControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        playbackRate={playbackRate}
        hasNext={hasNext}
        hasPrevious={hasPrevious}
        fontSize={transcriptFontSize}
        onTogglePlay={handleTogglePlay}
        onSeek={seek}
        onSeekStart={handleSeekStart}
        onSeekEnd={handleSeekEnd}
        onSetPlaybackRate={setPlaybackRate}
        onNextTrack={nextTrack}
        onPreviousTrack={previousTrack}
        onFontSizeChange={setTranscriptFontSize}
        onHeightChange={setControlsHeight}
        editModeAvailable={canEditTranscript}
        editMode={editMode}
        onToggleEditMode={handleToggleEditMode}
      />

      <EditTranscriptSegmentDialog
        open={editingSegment !== null}
        initialText={
          editingSegment !== null ? (audioItem?.transcript?.[editingSegment]?.text ?? '') : ''
        }
        onClose={closeEditor}
        onSave={handleSaveSegment}
      />
    </PlayerContainer>
  );
}
