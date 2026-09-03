import { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Box, IconButton, Typography, Tooltip, Menu, MenuItem, ListItemText } from '@mui/material';
import TextDecreaseIcon from '@mui/icons-material/TextDecrease';
import TextIncreaseIcon from '@mui/icons-material/TextIncrease';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import BookmarksIcon from '@mui/icons-material/Bookmarks';
import { styled } from '../../../lib/styled';
import { alpha } from '../../../lib/theme';
import { TranslatableWord } from '../../../components/TranslatableWord';
import { TranslatableText } from '../../../components/TranslatableText';
import { DRAWER_WIDTH } from '../../../components/Layout';
import { useTranscriptFontSize } from '../../../hooks/useTranscriptFontSize';
import { parseTextParagraphs } from '../../../lib/reader';
import { countWords } from '../../../lib/utils/countWords';
import type { TranscriptFontSize } from '../../../types/appSettings';

const BOTTOM_MENU_HEIGHT = 70;
const NAV_BAR_HEIGHT = 48;
const HEADER_HEIGHT = 64;
const SCROLL_ANCHOR_OFFSET = HEADER_HEIGHT + 8;

const FONT_SIZE_MAP: Record<TranscriptFontSize, { base: string; sm: string }> = {
  small: { base: '1rem', sm: '1.2rem' },
  medium: { base: '1.3rem', sm: '1.5rem' },
  large: { base: '1.9rem', sm: '2.1rem' },
};

const PLACEHOLDER_FONT_PX: Record<TranscriptFontSize, number> = {
  small: 19,
  medium: 24,
  large: 34,
};

const PLACEHOLDER_WORDS_PER_LINE: Record<TranscriptFontSize, number> = {
  small: 12,
  medium: 10,
  large: 7,
};

function estimatePlaceholderHeight(wordCount: number, fontSize: TranscriptFontSize): number {
  const fontPx = PLACEHOLDER_FONT_PX[fontSize];
  const lineHeightPx = fontPx * 1.8;
  const wordsPerLine = PLACEHOLDER_WORDS_PER_LINE[fontSize];
  const lines = Math.max(1, Math.ceil(wordCount / wordsPerLine));
  return Math.ceil(lines * lineHeightPx);
}

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

const NavigationBar = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: BOTTOM_MENU_HEIGHT,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: theme.spacing(0.5),
  padding: theme.spacing(1),
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  backdropFilter: 'blur(8px)',
  borderTop: `1px solid ${theme.palette.divider}`,
  zIndex: 10,
  [theme.breakpoints.up('md')]: {
    left: DRAWER_WIDTH,
  },
}));

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
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [bookmarkMenuAnchor, setBookmarkMenuAnchor] = useState<HTMLElement | null>(null);

  const paragraphEls = useRef<Map<number, HTMLElement>>(new Map());
  const visibleIndices = useRef<Set<number>>(new Set());
  const observerRef = useRef<IntersectionObserver | null>(null);
  const restoreDone = useRef(false);

  const paragraphs = useMemo(() => parseTextParagraphs(text), [text]);

  const paragraphWordCounts = useMemo(
    () => paragraphs.map((paragraph) => countWords(paragraph)),
    [paragraphs]
  );

  const paragraphWordOffsets = useMemo(() => {
    const offsets: number[] = [];
    let total = 0;
    for (const count of paragraphWordCounts) {
      offsets.push(total);
      total += count;
    }
    return offsets;
  }, [paragraphWordCounts]);

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

  const getSentenceContext = useCallback(
    (selectedIndices: number[]) => {
      if (selectedIndices.length === 0 || paragraphs.length === 0) return undefined;
      let min = Infinity;
      let max = -Infinity;
      for (const idx of selectedIndices) {
        if (idx < min) min = idx;
        if (idx > max) max = idx;
      }
      let firstPara = 0;
      let lastPara = 0;
      for (let i = 0; i < paragraphWordOffsets.length; i++) {
        if (paragraphWordOffsets[i] <= min) firstPara = i;
        if (paragraphWordOffsets[i] <= max) lastPara = i;
      }
      return paragraphs.slice(firstPara, lastPara + 1).join(' ');
    },
    [paragraphWordOffsets, paragraphs]
  );

  const handleUpdateTranslation = useCallback((word: string, translation: string) => {
    setTranslations((prev) => ({ ...prev, [word]: translation }));
  }, []);

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

  const initialVisibleSet = useMemo(() => {
    const anchor =
      initialParagraphIndex ??
      Math.floor(initialScrollPercent * Math.max(0, paragraphs.length - 1));
    const set = new Set<number>();
    const start = Math.max(0, anchor - INITIAL_VISIBLE_BUFFER);
    const end = Math.min(paragraphs.length - 1, anchor + INITIAL_VISIBLE_BUFFER);
    for (let i = start; i <= end; i++) set.add(i);
    return set;
  }, [initialParagraphIndex, initialScrollPercent, paragraphs.length]);

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
          onUpdateTranslation={handleUpdateTranslation}
        >
          {paragraphs.map((paragraph, paraIdx) => (
            <LazyParagraph
              key={paraIdx}
              initiallyVisible={initialVisibleSet.has(paraIdx)}
              wordCount={paragraphWordCounts[paraIdx]}
              paragraph={paragraph}
              paraIdx={paraIdx}
              fontSize={fontSize}
              wordOffset={paragraphWordOffsets[paraIdx]}
              translations={translations}
              registerRef={registerParagraphRef}
            />
          ))}
        </TranslatableText>
      </ViewerContainer>

      <NavigationBar>
        <Tooltip title="Smaller text">
          <span>
            <IconButton onClick={() => cycleFontSize('down')} disabled={fontSize === 'small'}>
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

        <Tooltip title="Bookmarks">
          <span>
            <IconButton
              onClick={(e) => setBookmarkMenuAnchor(e.currentTarget)}
              disabled={bookmarks.length === 0}
            >
              <BookmarksIcon />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Larger text">
          <span>
            <IconButton onClick={() => cycleFontSize('up')} disabled={fontSize === 'large'}>
              <TextIncreaseIcon />
            </IconButton>
          </span>
        </Tooltip>
      </NavigationBar>

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
  translations: Record<string, string>;
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
  const [hasBeenVisible, setHasBeenVisible] = useState(initiallyVisible);
  const placeholderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (hasBeenVisible) return;
    const el = placeholderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setHasBeenVisible(true);
      },
      { rootMargin: LAZY_ROOT_MARGIN }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasBeenVisible]);

  const handlePlaceholderRef = useCallback(
    (el: HTMLDivElement | null) => {
      placeholderRef.current = el;
      registerRef(paraIdx, el);
    },
    [registerRef, paraIdx]
  );

  if (hasBeenVisible) {
    return <ParagraphRow {...rowProps} />;
  }

  return (
    <ParagraphPlaceholder
      ref={handlePlaceholderRef}
      sx={{ minHeight: estimatePlaceholderHeight(wordCount, fontSize) }}
    />
  );
});

const ParagraphRow = memo(function ParagraphRow({
  paragraph,
  paraIdx,
  fontSize,
  wordOffset,
  translations,
  registerRef,
}: ParagraphRowProps) {
  const tokens = useMemo(() => paragraph.split(/(\s+)/), [paragraph]);

  const refCb = useCallback(
    (el: HTMLParagraphElement | null) => {
      registerRef(paraIdx, el);
    },
    [registerRef, paraIdx]
  );

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
          sentenceContext={paragraph}
          translations={translations}
          disableHoverTranslate
        />
      );
    });
  }, [tokens, wordOffset, paragraph, translations]);

  return (
    <Paragraph ref={refCb} $fontSize={fontSize}>
      {elements}
    </Paragraph>
  );
});
