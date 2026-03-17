import { useRef, useEffect, useCallback, useState } from 'react';
import { Box, Button, IconButton, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SyncIcon from '@mui/icons-material/Sync';
import { styled } from '../../lib/styled';
import { CONTROLS_HEIGHT } from './AudioControls';
import { TranslatableWord } from '../../components/TranslatableWord';
import { TranslatableText } from '../../components/TranslatableText';
import type { TranscriptSegment } from '../../types/audio';

const TranscriptContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  overflow: 'auto',
  padding: theme.spacing(3, 2),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
  WebkitOverflowScrolling: 'touch',
  maxWidth: 720,
  margin: '0 auto',
  width: '100%',
  textAlign: 'left',
  position: 'relative',
}));

const SyncButton = styled(Button)(({ theme }) => ({
  position: 'fixed',
  bottom: CONTROLS_HEIGHT + 16,
  right: theme.spacing(2),
  zIndex: 1000,
}));

const SegmentRow = styled(Box)<{ $isActive: boolean }>(({ theme, $isActive }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1),
  minWidth: 0,
  transition: 'opacity 0.3s ease',
  opacity: $isActive ? 1 : 0.4,
  lineHeight: 1.8,
  fontWeight: 900,
  fontSize: '1.9rem',
  overflowWrap: 'normal',
  wordBreak: 'normal',
  [theme.breakpoints.up('sm')]: {
    fontSize: '2.1rem',
  },
}));

const SegmentText = styled(Box)({
  flex: 1,
  minWidth: 0,
});

interface TranscriptViewProps {
  transcript: TranscriptSegment[];
  activeSegmentIndex: number;
  onDailyLimitReached?: (resetTime: string) => void;
  onWordTap?: () => void;
  onSeekToSegment?: (time: number) => void;
}

export function TranscriptView({
  transcript,
  activeSegmentIndex,
  onDailyLimitReached,
  onWordTap,
  onSeekToSegment,
}: TranscriptViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [showSyncButton, setShowSyncButton] = useState(false);
  const prevActiveSegmentRef = useRef(-1);

  const handleUserScroll = useCallback(() => {
    setShowSyncButton(true);
  }, []);

  const isElementInView = useCallback((el: HTMLElement, container: HTMLElement): boolean => {
    const elRect = el.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    return elRect.top < containerRect.bottom && elRect.bottom > containerRect.top;
  }, []);

  const handleSync = useCallback(() => {
    if (activeSegmentIndex < 0) return;
    const el = segmentRefs.current.get(activeSegmentIndex);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setShowSyncButton(false);
  }, [activeSegmentIndex]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('touchstart', handleUserScroll, { passive: true });
    container.addEventListener('wheel', handleUserScroll, { passive: true });
    container.addEventListener('scroll', handleUserScroll, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleUserScroll);
      container.removeEventListener('wheel', handleUserScroll);
      container.removeEventListener('scroll', handleUserScroll);
    };
  }, [handleUserScroll]);

  useEffect(() => {
    if (activeSegmentIndex < 0) return;

    const prevIndex = prevActiveSegmentRef.current;
    prevActiveSegmentRef.current = activeSegmentIndex;

    if (prevIndex >= 0 && prevIndex !== activeSegmentIndex) {
      const prevEl = segmentRefs.current.get(prevIndex);
      if (prevEl && containerRef.current && !isElementInView(prevEl, containerRef.current)) {
        queueMicrotask(() => setShowSyncButton(true));
      }
    }

    if (showSyncButton) return;

    const el = segmentRefs.current.get(activeSegmentIndex);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeSegmentIndex, isElementInView, showSyncButton]);

  const setSegmentRef = useCallback(
    (index: number) => (el: HTMLDivElement | null) => {
      if (el) {
        segmentRefs.current.set(index, el);
      } else {
        segmentRefs.current.delete(index);
      }
    },
    []
  );

  if (transcript.length === 0) {
    return (
      <TranscriptContainer
        ref={containerRef}
        display="flex"
        alignItems="center"
        justifyContent="center"
      >
        <Typography color="text.secondary">No transcript available</Typography>
      </TranscriptContainer>
    );
  }

  return (
    <TranscriptContainer ref={containerRef}>
      {transcript.map((segment, segIdx) => {
        const isActive = segIdx === activeSegmentIndex;

        return (
          <SegmentRow key={segIdx} ref={setSegmentRef(segIdx)} $isActive={isActive}>
            {onSeekToSegment && (
              <IconButton
                size="medium"
                onClick={() => onSeekToSegment(segment.startTime)}
                sx={{ mt: 1.5, flexShrink: 0 }}
                data-qa={`segment-seek-${segIdx}`}
                aria-label="Jump to this line"
              >
                <PlayArrowIcon fontSize="medium" />
              </IconButton>
            )}
            <SegmentText>
              <SegmentContent
                segment={segment}
                onDailyLimitReached={onDailyLimitReached}
                onWordTap={onWordTap}
              />
            </SegmentText>
          </SegmentRow>
        );
      })}
      {showSyncButton && (
        <SyncButton
          variant="contained"
          size="small"
          onClick={handleSync}
          startIcon={<SyncIcon />}
          data-qa="transcript-sync-button"
        >
          Sync
        </SyncButton>
      )}
    </TranscriptContainer>
  );
}

interface SegmentContentProps {
  segment: TranscriptSegment;
  onDailyLimitReached?: (resetTime: string) => void;
  onWordTap?: () => void;
}

function SegmentContent({ segment, onDailyLimitReached, onWordTap }: SegmentContentProps) {
  const [translations, setTranslations] = useState<Record<string, string>>({});

  const handleUpdateTranslation = useCallback((word: string, translation: string) => {
    setTranslations((prev) => ({ ...prev, [word]: translation }));
  }, []);

  const tokens = segment.text.split(/(\s+)/);
  let wordIndex = 0;
  const elements = tokens.map((token, index) => {
    if (/^\s+$/.test(token)) return token;
    const currentWordIndex = wordIndex;
    wordIndex++;

    return (
      <TranslatableWord
        key={index}
        word={token}
        wordIndex={currentWordIndex}
        sentenceContext={segment.text}
        translations={translations}
        onDailyLimitReached={onDailyLimitReached}
        onUpdateTranslation={handleUpdateTranslation}
        disableHoverTranslate
        onTranslateRequest={onWordTap}
      />
    );
  });

  return (
    <TranslatableText
      sentenceContext={segment.text}
      translations={translations}
      onDailyLimitReached={onDailyLimitReached}
      onUpdateTranslation={handleUpdateTranslation}
    >
      {elements}
    </TranslatableText>
  );
}
