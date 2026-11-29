import { useRef, useEffect, useLayoutEffect, useCallback, useState, useMemo, memo } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { styled } from '../../lib/styled';
import { TranslatableWords } from '../../components/lazyText/TranslatableWords';
import { useLazyVisibility } from '../../components/lazyText/useLazyVisibility';
import { useTextBlocks } from '../../components/lazyText/useTextBlocks';
import {
  TEXT_LINE_HEIGHT,
  FONT_SIZE_MAP,
  estimatePlaceholderHeight,
} from '../../components/lazyText/textSizing';
import { TranslatableText } from '../../components/TranslatableText';
import type { TranscriptSegment } from '../../types/audio';
import type { TranscriptFontSize } from '../../types/appSettings';

const INITIAL_VISIBLE_BUFFER = 5;
const LAZY_ROOT_MARGIN = '800px 0px';

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

const SegmentRow = styled(Box)<{
  $isActive: boolean;
  $fontSize: TranscriptFontSize;
  $editMode: boolean;
}>(({ theme, $isActive, $fontSize, $editMode }) => ({
  display: 'flex',
  alignItems: 'flex-start',
  gap: theme.spacing(1),
  minWidth: 0,
  transition: 'opacity 0.3s ease, font-size 0.2s ease',
  opacity: $editMode || $isActive ? 1 : 0.4,
  lineHeight: TEXT_LINE_HEIGHT,
  fontWeight: 900,
  fontSize: FONT_SIZE_MAP[$fontSize].base,
  overflowWrap: 'normal',
  wordBreak: 'normal',
  ...($editMode && {
    cursor: 'pointer',
    borderRadius: theme.shape.borderRadius,
    padding: theme.spacing(0.5, 1),
    margin: theme.spacing(-0.5, -1),
    outline: `1px dashed ${theme.palette.divider}`,
    '&:hover': {
      backgroundColor: theme.palette.action.hover,
      outlineColor: theme.palette.primary.main,
    },
  }),
  [theme.breakpoints.up('sm')]: {
    fontSize: FONT_SIZE_MAP[$fontSize].sm,
  },
}));

const SegmentText = styled(Box)({
  flex: 1,
  minWidth: 0,
});

const SeekButtonSlot = styled(Box)({
  flexShrink: 0,
  display: 'flex',
  alignItems: 'center',
  height: `${TEXT_LINE_HEIGHT}em`,
});

const EditModeBanner = styled(Box)(({ theme }) => ({
  position: 'sticky',
  top: 0,
  zIndex: 2,
  alignSelf: 'stretch',
  textAlign: 'center',
  padding: theme.spacing(0.75, 2),
  marginBottom: theme.spacing(1),
  borderRadius: theme.shape.borderRadius,
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  fontSize: '0.8rem',
  fontWeight: 700,
}));

const SegmentPlaceholder = styled(Box)({
  flexShrink: 0,
  minWidth: 0,
});

interface TranscriptViewProps {
  transcript: TranscriptSegment[];
  activeSegmentIndex: number;
  fontSize: TranscriptFontSize;
  onWordTap?: () => void;
  onSeekToSegment?: (time: number) => void;
  editMode?: boolean;
  onEditSegment?: (segIdx: number) => void;
}

export function TranscriptView({
  transcript,
  activeSegmentIndex,
  fontSize,
  onWordTap,
  onSeekToSegment,
  editMode = false,
  onEditSegment,
}: TranscriptViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const segmentRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollAnchorRef = useRef<{ segIdx: number; offset: number } | null>(null);
  const prevEditModeRef = useRef(editMode);
  const [initialActiveSegmentIndex] = useState(activeSegmentIndex);
  const segmentTexts = useMemo(() => transcript.map((segment) => segment.text), [transcript]);
  const {
    wordCounts: segmentWordCounts,
    wordOffsets: segmentWordOffsets,
    initiallyVisible,
    getSentenceContext,
    translations,
    updateTranslation,
  } = useTextBlocks(segmentTexts, {
    initialBlock: initialActiveSegmentIndex,
    initialBuffer: INITIAL_VISIBLE_BUFFER,
  });

  const measureAnchor = useCallback((): { segIdx: number; offset: number } | null => {
    const container = containerRef.current;
    if (!container) return null;
    const containerRect = container.getBoundingClientRect();
    const centerY = containerRect.top + containerRect.height / 2;
    let bestIdx = -1;
    let bestOffset = 0;
    let bestDistance = Infinity;
    segmentRefs.current.forEach((el, idx) => {
      const elRect = el.getBoundingClientRect();
      const elCenter = elRect.top + elRect.height / 2;
      const distance = Math.abs(elCenter - centerY);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIdx = idx;
        bestOffset = elRect.top - containerRect.top;
      }
    });
    return bestIdx >= 0 ? { segIdx: bestIdx, offset: bestOffset } : null;
  }, []);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    if (prevEditModeRef.current === editMode) {
      const anchor = measureAnchor();
      if (anchor) scrollAnchorRef.current = anchor;
      return;
    }

    prevEditModeRef.current = editMode;
    const anchor = scrollAnchorRef.current;
    if (!anchor) return;
    const el = segmentRefs.current.get(anchor.segIdx);
    if (!el) return;
    const containerTop = container.getBoundingClientRect().top;
    const newOffset = el.getBoundingClientRect().top - containerTop;
    container.scrollTop += newOffset - anchor.offset;
    scrollAnchorRef.current = measureAnchor();
  });

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
    }
  }, []);

  useEffect(() => {
    const refs = segmentRefs.current;
    return () => {
      refs.clear();
    };
  }, [transcript]);

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

  const seekEnabled = Boolean(onSeekToSegment) && !editMode;

  return (
    <TranscriptContainer ref={containerRef}>
      {editMode && (
        <EditModeBanner data-qa="transcript-edit-banner">
          Editing transcript — tap a line to correct it
        </EditModeBanner>
      )}
      <TranslatableText
        getSentenceContext={getSentenceContext}
        translations={translations}
        onUpdateTranslation={updateTranslation}
        onWordTap={onWordTap}
      >
        {transcript.map((segment, segIdx) => (
          <LazyTranscriptRow
            key={segIdx}
            initiallyVisible={initiallyVisible.has(segIdx)}
            wordCount={segmentWordCounts[segIdx]}
            segment={segment}
            segIdx={segIdx}
            isActive={segIdx === activeSegmentIndex}
            fontSize={fontSize}
            wordOffset={segmentWordOffsets[segIdx]}
            onSeekClick={seekEnabled ? handleSeekToSegmentClick : undefined}
            editMode={editMode}
            onEditSegment={onEditSegment}
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
  onSeekClick?: (segIdx: number, time: number) => void;
  editMode?: boolean;
  onEditSegment?: (segIdx: number) => void;
  registerRef: (segIdx: number, el: HTMLDivElement | null) => void;
}

interface LazyTranscriptRowProps extends TranscriptRowProps {
  initiallyVisible: boolean;
  wordCount: number;
}

const LazyTranscriptRow = memo(function LazyTranscriptRow({
  initiallyVisible,
  wordCount,
  ...rowProps
}: LazyTranscriptRowProps) {
  const { isActive, fontSize, segIdx, registerRef } = rowProps;
  const { hasBeenVisible, setHasBeenVisible, setPlaceholder } = useLazyVisibility({
    initiallyVisible: initiallyVisible || isActive,
    rootMargin: LAZY_ROOT_MARGIN,
    index: segIdx,
    registerRef,
  });

  if (!hasBeenVisible && isActive) {
    setHasBeenVisible(true);
  }

  if (hasBeenVisible) {
    return <TranscriptRow {...rowProps} />;
  }

  return (
    <SegmentPlaceholder
      ref={setPlaceholder}
      data-qa={`segment-placeholder-${segIdx}`}
      sx={{ minHeight: estimatePlaceholderHeight(wordCount, fontSize) }}
    />
  );
});

const TranscriptRow = memo(function TranscriptRow({
  segment,
  segIdx,
  isActive,
  fontSize,
  wordOffset,
  onSeekClick,
  editMode = false,
  onEditSegment,
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

  const handleEdit = useCallback(() => {
    onEditSegment?.(segIdx);
  }, [onEditSegment, segIdx]);

  if (editMode) {
    return (
      <SegmentRow
        ref={refCb}
        $isActive={isActive}
        $fontSize={fontSize}
        $editMode
        role="button"
        tabIndex={0}
        onClick={handleEdit}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleEdit();
          }
        }}
        data-qa={`segment-edit-${segIdx}`}
        aria-label="Edit this line"
      >
        <SegmentText>{segment.text}</SegmentText>
      </SegmentRow>
    );
  }

  return (
    <SegmentRow ref={refCb} $isActive={isActive} $fontSize={fontSize} $editMode={false}>
      {onSeekClick && (
        <SeekButtonSlot>
          <IconButton
            size="medium"
            onClick={handleSeek}
            data-qa={`segment-seek-${segIdx}`}
            aria-label="Jump to this line"
          >
            <PlayArrowIcon fontSize="medium" />
          </IconButton>
        </SeekButtonSlot>
      )}
      <SegmentText>
        <TranslatableWords text={segment.text} wordOffset={wordOffset} />
      </SegmentText>
    </SegmentRow>
  );
});
