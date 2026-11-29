import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Box, IconButton, Typography, Tooltip, Menu, MenuItem, ListItemText } from '@mui/material';
import TextDecreaseIcon from '@mui/icons-material/TextDecrease';
import TextIncreaseIcon from '@mui/icons-material/TextIncrease';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import { styled } from '../../../lib/styled';
import { TranslatableWords } from '../../../components/lazyText/TranslatableWords';
import { useLazyVisibility } from '../../../components/lazyText/useLazyVisibility';
import { useTextBlocks } from '../../../components/lazyText/useTextBlocks';
import { FONT_SIZE_MAP, estimatePlaceholderHeight } from '../../../components/lazyText/textSizing';
import { TranslatableText } from '../../../components/TranslatableText';
import { useTranscriptFontSize } from '../../../hooks/useTranscriptFontSize';
import { parseTextParagraphs } from '../../../lib/reader';
import type { TranscriptFontSize } from '../../../types/appSettings';
import { ReaderNavigationBar } from './ReaderNavigationBar';

const BOTTOM_MENU_HEIGHT = 70;
const NAV_BAR_HEIGHT = 48;
const HEADER_HEIGHT = 64;
const SCROLL_ANCHOR_OFFSET = HEADER_HEIGHT + 8;

const INITIAL_VISIBLE_BUFFER = 6;
const LAZY_ROOT_MARGIN = '1200px 0px';

const ViewerContainer = styled(Box)({
  maxWidth: 720,
  margin: '0 auto',
  width: '100%',
  paddingBottom: BOTTOM_MENU_HEIGHT + NAV_BAR_HEIGHT + 16,
});

const Paragraph = styled('p')<{ $fontSize: TranscriptFontSize }>(({ theme, $fontSize }) => ({
  lineHeight: 1.8,
  fontWeight: 500,
  fontSize: FONT_SIZE_MAP[$fontSize].base,
  marginTop: 0,
  marginBottom: theme.spacing(2.5),
  overflowWrap: 'normal',
  wordBreak: 'normal',
  color: theme.palette.text.primary,
  [theme.breakpoints.up('sm')]: {
    fontSize: FONT_SIZE_MAP[$fontSize].sm,
  },
}));

const ParagraphPlaceholder = styled(Box)({
  flexShrink: 0,
});

export interface TextReadingPosition {
  scrollPercent: number;
  paragraphIndex: number;
}

interface TextViewerProps {
  text: string;
  initialScrollPercent?: number;
  initialParagraphIndex?: number;
  bookmarks?: number[];
  onPositionChange?: (position: TextReadingPosition) => void;
  onBookmarkToggle?: (paragraphIndex: number) => void;
}

export const TextViewer = memo(function TextViewer({
  text,
  initialScrollPercent = 0,
  initialParagraphIndex,
  bookmarks = [],
  onPositionChange,
  onBookmarkToggle,
}: TextViewerProps) {
  const [fontSize, setFontSize] = useTranscriptFontSize();
  const [scrollPercent, setScrollPercent] = useState(initialScrollPercent);
  const [currentParagraph, setCurrentParagraph] = useState(initialParagraphIndex ?? 0);
  const [bookmarkMenuAnchor, setBookmarkMenuAnchor] = useState<HTMLElement | null>(null);

  const paragraphEls = useRef<Map<number, HTMLElement>>(new Map());
  const visibleIndices = useRef<Set<number>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const restoreDone = useRef(false);

  const paragraphs = useMemo(() => parseTextParagraphs(text), [text]);
  const {
    wordCounts: paragraphWordCounts,
    wordOffsets: paragraphWordOffsets,
    initiallyVisible,
    getSentenceContext,
    translations,
    updateTranslation,
  } = useTextBlocks(paragraphs, {
    initialBlock:
      initialParagraphIndex ??
      Math.floor(initialScrollPercent * Math.max(0, paragraphs.length - 1)),
    initialBuffer: INITIAL_VISIBLE_BUFFER,
  });

  const getObserver = useCallback(() => {
    if (!observerRef.current) {
      observerRef.current = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            const raw = entry.target.getAttribute('data-paragraph-index');
            if (raw === null) continue;
            const index = Number(raw);
            if (entry.isIntersecting) {
              visibleIndices.current.add(index);
            } else {
              visibleIndices.current.delete(index);
            }
          }

          let topmost = -1;
          for (const index of visibleIndices.current) {
            if (topmost === -1 || index < topmost) topmost = index;
          }
          if (topmost !== -1) setCurrentParagraph(topmost);
        },
        { rootMargin: `-${SCROLL_ANCHOR_OFFSET}px 0px -70% 0px` }
      );
    }
    return observerRef.current;
  }, []);

  useEffect(() => {
    return () => {
      observerRef.current?.disconnect();
      observerRef.current = null;
    };
  }, []);

  const registerParagraphRef = useCallback(
    (index: number, el: HTMLElement | null) => {
      const observer = getObserver();
      const previous = paragraphEls.current.get(index);

      if (previous && previous !== el) {
        observer.unobserve(previous);
        visibleIndices.current.delete(index);
      }

      if (el) {
        el.setAttribute('data-paragraph-index', String(index));
        paragraphEls.current.set(index, el);
        observer.observe(el);
      } else {
        paragraphEls.current.delete(index);
      }
    },
    [getObserver]
  );

  const scrollToParagraph = useCallback((index: number) => {
    const el = paragraphEls.current.get(index);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - SCROLL_ANCHOR_OFFSET;
    window.scrollTo({ top: Math.max(0, top) });
  }, []);

  useEffect(() => {
    restoreDone.current = false;
  }, [text]);

  useEffect(() => {
    if (restoreDone.current || paragraphs.length === 0) return;
    restoreDone.current = true;

    const restore = () => {
      if (initialParagraphIndex !== undefined && initialParagraphIndex > 0) {
        scrollToParagraph(initialParagraphIndex);
        return;
      }
      const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (maxScroll > 0 && initialScrollPercent > 0) {
        window.scrollTo({ top: initialScrollPercent * maxScroll });
      }
    };

    restore();
    const timers = [50, 250, 600].map((delay) => window.setTimeout(restore, delay));
    return () => timers.forEach(window.clearTimeout);
  }, [initialParagraphIndex, initialScrollPercent, paragraphs.length, scrollToParagraph]);

  useEffect(() => {
    let frame = 0;

    const handleScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
        const percent = maxScroll > 0 ? Math.min(1, Math.max(0, window.scrollY / maxScroll)) : 0;
        setScrollPercent(percent);
      });
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [paragraphs.length]);

  useEffect(() => {
    if (!restoreDone.current) return;
    onPositionChange?.({ scrollPercent, paragraphIndex: currentParagraph });
  }, [scrollPercent, currentParagraph, onPositionChange]);

  const cycleFontSize = useCallback(
    (direction: 'up' | 'down') => {
      const sizes: TranscriptFontSize[] = ['small', 'medium', 'large'];
      const idx = sizes.indexOf(fontSize);
      const nextIdx =
        direction === 'up' ? Math.min(sizes.length - 1, idx + 1) : Math.max(0, idx - 1);
      setFontSize(sizes[nextIdx]);
    },
    [fontSize, setFontSize]
  );

  const isCurrentBookmarked = bookmarks.includes(currentParagraph);

  const handleBookmarkJump = useCallback(
    (index: number) => {
      setBookmarkMenuAnchor(null);
      scrollToParagraph(index);
    },
    [scrollToParagraph]
  );

  if (paragraphs.length === 0) {
    return (
      <ViewerContainer>
        <Typography color="text.secondary">No text content</Typography>
      </ViewerContainer>
    );
  }

  return (
    <>
      <ViewerContainer>
        <TranslatableText
          getSentenceContext={getSentenceContext}
          translations={translations}
          onUpdateTranslation={updateTranslation}
        >
          {paragraphs.map((paragraph, paraIdx) => (
            <LazyParagraph
              key={paraIdx}
              initiallyVisible={initiallyVisible.has(paraIdx)}
              wordCount={paragraphWordCounts[paraIdx]}
              paragraph={paragraph}
              paraIdx={paraIdx}
              fontSize={fontSize}
              wordOffset={paragraphWordOffsets[paraIdx]}
              registerRef={registerParagraphRef}
            />
          ))}
        </TranslatableText>
      </ViewerContainer>

      <ReaderNavigationBar $bottom={BOTTOM_MENU_HEIGHT} $gap={0.5}>
        <Tooltip title="Smaller text" describeChild>
          <span>
            <IconButton
              onClick={() => cycleFontSize('down')}
              disabled={fontSize === 'small'}
              aria-label="Smaller text"
            >
              <TextDecreaseIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title={isCurrentBookmarked ? 'Remove bookmark' : 'Add bookmark'}>
          <IconButton onClick={() => onBookmarkToggle?.(currentParagraph)}>
            {isCurrentBookmarked ? <BookmarkIcon color="warning" /> : <BookmarkBorderIcon />}
          </IconButton>
        </Tooltip>

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ minWidth: 48, textAlign: 'center' }}
        >
          {Math.round(scrollPercent * 100)}%
        </Typography>

        <Tooltip title="Bookmarks" describeChild>
          <span>
            <IconButton
              onClick={(e) => setBookmarkMenuAnchor(e.currentTarget)}
              disabled={bookmarks.length === 0}
              aria-label="Bookmarks"
            >
              <BookmarksIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Larger text" describeChild>
          <span>
            <IconButton
              onClick={() => cycleFontSize('up')}
              disabled={fontSize === 'large'}
              aria-label="Larger text"
            >
              <TextIncreaseIcon />
            </IconButton>
          </span>
        </Tooltip>
      </ReaderNavigationBar>

      <Menu
        anchorEl={bookmarkMenuAnchor}
        open={!!bookmarkMenuAnchor}
        onClose={() => setBookmarkMenuAnchor(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        slotProps={{ paper: { sx: { maxWidth: 320, maxHeight: 360 } } }}
      >
        {bookmarks.map((index) => (
          <MenuItem key={index} onClick={() => handleBookmarkJump(index)}>
            <ListItemText
              primary={paragraphs[index]?.slice(0, 60) ?? `Paragraph ${index + 1}`}
              secondary={`Paragraph ${index + 1}`}
              slotProps={{ primary: { noWrap: true, variant: 'body2' } }}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
});

interface ParagraphRowProps {
  paragraph: string;
  paraIdx: number;
  fontSize: TranscriptFontSize;
  wordOffset: number;
  registerRef: (index: number, el: HTMLElement | null) => void;
}

interface LazyParagraphProps extends ParagraphRowProps {
  initiallyVisible: boolean;
  wordCount: number;
}

const LazyParagraph = memo(function LazyParagraph({
  initiallyVisible,
  wordCount,
  ...rowProps
}: LazyParagraphProps) {
  const { paraIdx, fontSize, registerRef } = rowProps;
  const { hasBeenVisible, setPlaceholder } = useLazyVisibility({
    initiallyVisible,
    rootMargin: LAZY_ROOT_MARGIN,
    index: paraIdx,
    registerRef,
  });

  if (hasBeenVisible) {
    return <ParagraphRow {...rowProps} />;
  }

  return (
    <ParagraphPlaceholder
      ref={setPlaceholder}
      sx={{ minHeight: estimatePlaceholderHeight(wordCount, fontSize) }}
    />
  );
});

const ParagraphRow = memo(function ParagraphRow({
  paragraph,
  paraIdx,
  fontSize,
  wordOffset,
  registerRef,
}: ParagraphRowProps) {
  const refCb = useCallback(
    (el: HTMLParagraphElement | null) => {
      registerRef(paraIdx, el);
    },
    [registerRef, paraIdx]
  );

  return (
    <Paragraph ref={refCb} $fontSize={fontSize}>
      <TranslatableWords text={paragraph} wordOffset={wordOffset} />
    </Paragraph>
  );
});
