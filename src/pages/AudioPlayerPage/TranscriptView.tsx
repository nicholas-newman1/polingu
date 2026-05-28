import { useRef, useEffect, useCallback, useState, useMemo, memo } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { styled } from '../../lib/styled';
import { TranslatableWord } from '../../components/TranslatableWord';
import { TranslatableText } from '../../components/TranslatableText';
import type { TranscriptSegment } from '../../types/audio';
import type { TranscriptFontSize } from '../../types/appSettings';

function countWords(text: string): number {
  return text.split(/(\s+)/).filter((t) => t.length > 0 && !/^\s+$/.test(t)).length;
}

const FONT_SIZE_MAP: Record<TranscriptFontSize, { base: string; sm: string }> = {
  small: { base: '1rem', sm: '1.2rem' },
  medium: { base: '1.3rem', sm: '1.5rem' },
  large: { base: '1.9rem', sm: '2.1rem' },
};

const TranscriptContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  minWidth: 0,
  overflow: 'auto',
  padding: theme.spacing(3, 0),
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2.5),
  WebkitOverflowScrolling: 'touch',
  maxWidth: 720,
  margin: '0 auto',
  width: '100%',
  textAlign: 'left',
  position: 'relative',
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(3, 2),
  },
}));

const SegmentRow = styled(Box)<{ $isActive: boolean; $fontSize: TranscriptFontSize }>(
  ({ theme, $isActive, $fontSize }) => ({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1),
    minWidth: 0,
    transition: 'opacity 0.3s ease, font-size 0.2s ease',
    opacity: $isActive ? 1 : 0.4,
    lineHeight: 1.8,
    fontWeight: 900,
    fontSize: FONT_SIZE_MAP[$fontSize].base,
    overflowWrap: 'normal',
    wordBreak: 'normal',
    [theme.breakpoints.up('sm')]: {
      fontSize: FONT_SIZE_MAP[$fontSize].sm,
    },
  })
);

const SegmentText = styled(Box)({
  flex: 1,
  minWidth: 0,
});

interface TranscriptViewProps {
  transcript: TranscriptSegment[];
  activeSegmentIndex: number;
  fontSize: TranscriptFontSize;
  onDailyLimitReached?: (resetTime: string) => void;
  onWordTap?: () => void;
  onSeekToSegment?: (time: number) => void;
}

export function TranscriptView({
  transcript,
  activeSegmentIndex,
  fontSize,
  onDailyLimitReached,
  onWordTap,
  onSeekToSegment,
}: TranscriptViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const [translations, setTranslations] = useState<Record<string, string>>({});

  const handleUpdateTranslation = useCallback((word: string, translation: string) => {
    setTranslations((prev) => ({ ...prev, [word]: translation }));
  }, []);

  const segmentWordOffsets = useMemo(() => {
    const offsets: number[] = [];
    let total = 0;
    for (const segment of transcript) {
      offsets.push(total);
      total += countWords(segment.text);
    }
    return offsets;
  }, [transcript]);

  const getSentenceContext = useCallback(
    (selectedIndices: number[]) => {
      if (selectedIndices.length === 0 || transcript.length === 0) return undefined;
      let min = Infinity;
      let max = -Infinity;
      for (const idx of selectedIndices) {
        if (idx < min) min = idx;
        if (idx > max) max = idx;
      }
      let firstSeg = 0;
      let lastSeg = 0;
      for (let i = 0; i < segmentWordOffsets.length; i++) {
        if (segmentWordOffsets[i] <= min) firstSeg = i;
        if (segmentWordOffsets[i] <= max) lastSeg = i;
      }
      return transcript
        .slice(firstSeg, lastSeg + 1)
        .map((s) => s.text)
        .join(' ');
    },
    [segmentWordOffsets, transcript]
  );

  const handleSeekToSegmentClick = useCallback(
    (segIdx: number, time: number) => {
      const el = segmentRefs.current.get(segIdx);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      onSeekToSegment?.(time);
    },
    [onSeekToSegment]
  );

  useEffect(() => {
    if (activeSegmentIndex < 0) return;
    const el = segmentRefs.current.get(activeSegmentIndex);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeSegmentIndex]);

  const registerSegmentRef = useCallback((segIdx: number, el: HTMLDivElement | null) => {
    if (el) {
      segmentRefs.current.set(segIdx, el);
    } else {
      segmentRefs.current.delete(segIdx);
    }
  }, []);

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

  const seekEnabled = Boolean(onSeekToSegment);

  return (
    <TranscriptContainer ref={containerRef}>
      <TranslatableText
        getSentenceContext={getSentenceContext}
        translations={translations}
        onDailyLimitReached={onDailyLimitReached}
        onUpdateTranslation={handleUpdateTranslation}
      >
        {transcript.map((segment, segIdx) => (
          <TranscriptRow
            key={segIdx}
            segment={segment}
            segIdx={segIdx}
            isActive={segIdx === activeSegmentIndex}
            fontSize={fontSize}
            wordOffset={segmentWordOffsets[segIdx]}
            translations={translations}
            onDailyLimitReached={onDailyLimitReached}
            onWordTap={onWordTap}
            onSeekClick={seekEnabled ? handleSeekToSegmentClick : undefined}
            registerRef={registerSegmentRef}
          />
        ))}
      </TranslatableText>
    </TranscriptContainer>
  );
}

interface TranscriptRowProps {
  segment: TranscriptSegment;
  segIdx: number;
  isActive: boolean;
  fontSize: TranscriptFontSize;
  wordOffset: number;
  translations: Record<string, string>;
  onDailyLimitReached?: (resetTime: string) => void;
  onWordTap?: () => void;
  onSeekClick?: (segIdx: number, time: number) => void;
  registerRef: (segIdx: number, el: HTMLDivElement | null) => void;
}

const TranscriptRow = memo(function TranscriptRow({
  segment,
  segIdx,
  isActive,
  fontSize,
  wordOffset,
  translations,
  onDailyLimitReached,
  onWordTap,
  onSeekClick,
  registerRef,
}: TranscriptRowProps) {
  const refCb = useCallback(
    (el: HTMLDivElement | null) => {
      registerRef(segIdx, el);
    },
    [registerRef, segIdx]
  );

  const handleSeek = useCallback(() => {
    onSeekClick?.(segIdx, segment.startTime);
  }, [onSeekClick, segIdx, segment.startTime]);

  return (
    <SegmentRow ref={refCb} $isActive={isActive} $fontSize={fontSize}>
      {onSeekClick && (
        <IconButton
          size="medium"
          onClick={handleSeek}
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
          wordOffset={wordOffset}
          translations={translations}
          onDailyLimitReached={onDailyLimitReached}
          onWordTap={onWordTap}
        />
      </SegmentText>
    </SegmentRow>
  );
});

interface SegmentContentProps {
  segment: TranscriptSegment;
  wordOffset: number;
  translations: Record<string, string>;
  onDailyLimitReached?: (resetTime: string) => void;
  onWordTap?: () => void;
}

const SegmentContent = memo(function SegmentContent({
  segment,
  wordOffset,
  translations,
  onDailyLimitReached,
  onWordTap,
}: SegmentContentProps) {
  const tokens = useMemo(() => segment.text.split(/(\s+)/), [segment.text]);

  const elements = useMemo(() => {
    let wordIndex = 0;
    return tokens.map((token, index) => {
      if (/^\s+$/.test(token)) return token;
      const currentWordIndex = wordIndex;
      wordIndex++;

      return (
        <TranslatableWord
          key={index}
          word={token}
          wordIndex={wordOffset + currentWordIndex}
          sentenceContext={segment.text}
          translations={translations}
          onDailyLimitReached={onDailyLimitReached}
          disableHoverTranslate
          onTranslateRequest={onWordTap}
        />
      );
    });
  }, [tokens, wordOffset, segment.text, translations, onDailyLimitReached, onWordTap]);

  return <>{elements}</>;
});
