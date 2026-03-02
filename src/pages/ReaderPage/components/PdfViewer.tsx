import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, IconButton, Typography, CircularProgress, Tooltip } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import * as pdfjsLib from 'pdfjs-dist';
import { styled } from '../../../lib/styled';
import { alpha } from '../../../lib/theme';
import { TranslatableWord } from '../../../components/TranslatableWord';
import { TranslatableText } from '../../../components/TranslatableText';
import { useTranslatableText } from '../../../hooks/useTranslatableText';
import { DRAWER_WIDTH } from '../../../components/Layout';
import { PageProgressBar } from './PageProgressBar';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;

const BOTTOM_MENU_HEIGHT = 70;
const PROGRESS_BAR_HEIGHT = 24;
const NAV_BAR_HEIGHT = 48;

const ViewerContainer = styled(Box)({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  backgroundColor: '#525659',
});

const PageContainer = styled(Box)({
  flex: 1,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'flex-start',
  overflow: 'auto',
  padding: 16,
  paddingBottom: BOTTOM_MENU_HEIGHT + PROGRESS_BAR_HEIGHT + NAV_BAR_HEIGHT + 16,
});

const PageWrapper = styled(Box)({
  position: 'relative',
  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
  backgroundColor: '#fff',
});

const Canvas = styled('canvas')({
  display: 'block',
});

const TextLayer = styled(Box)({
  position: 'absolute',
  left: 0,
  top: 0,
  right: 0,
  bottom: 0,
  overflow: 'hidden',
  lineHeight: 1,
});

const NavigationBar = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: BOTTOM_MENU_HEIGHT + PROGRESS_BAR_HEIGHT,
  left: 0,
  right: 0,
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(1),
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  backdropFilter: 'blur(8px)',
  borderTop: `1px solid ${theme.palette.divider}`,
  zIndex: 10,
  [theme.breakpoints.up('md')]: {
    left: DRAWER_WIDTH,
  },
}));

interface TextItem {
  str: string;
  transform: number[];
  width: number;
  height: number;
}

interface WordPosition {
  word: string;
  displayWord: string;
  left: number;
  top: number;
  width: number;
  height: number;
  fontSize: number;
}

interface PdfViewerProps {
  pdfUrl: string;
  bookId: string;
  initialPage?: number;
  bookmarks?: number[];
  onPageChange?: (page: number, totalPages: number) => void;
  onBookmarkToggle?: (page: number) => void;
}

interface PdfWordBoxProps {
  item: WordPosition;
  index: number;
  pageKey: number;
}

function PdfWordBox({ item, index, pageKey }: PdfWordBoxProps) {
  const context = useTranslatableText();
  const isSelected = context?.selectedIndices.has(index) ?? false;

  return (
    <Box
      key={`${pageKey}-${index}`}
      sx={{
        position: 'absolute',
        left: item.left,
        top: item.top,
        fontSize: item.fontSize,
        width: item.width,
        height: item.height,
        lineHeight: 1,
        backgroundColor: isSelected ? 'rgba(25, 118, 210, 0.3)' : 'transparent',
        '& > span': {
          color: 'transparent !important',
          backgroundColor: 'transparent !important',
          '&:hover': {
            backgroundColor: 'rgba(0, 100, 255, 0.2) !important',
          },
        },
      }}
    >
      <TranslatableWord word={item.word} wordIndex={index} disableHoverTranslate />
    </Box>
  );
}

const ZOOM_STEP = 0.1;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;

function getStoredZoom(bookId: string): number {
  const stored = localStorage.getItem(`polingu_zoom_${bookId}`);
  if (!stored) return 1;
  const value = parseFloat(stored);
  if (isNaN(value) || value < MIN_ZOOM || value > MAX_ZOOM) return 1;
  return value;
}

export function PdfViewer({
  pdfUrl,
  bookId,
  initialPage = 1,
  bookmarks = [],
  onPageChange,
  onBookmarkToggle,
}: PdfViewerProps) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [words, setWords] = useState<WordPosition[]>([]);
  const [zoom, setZoom] = useState(1);
  const [initialRenderDone, setInitialRenderDone] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialPageRef = useRef(initialPage);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isWordDragRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    const loadPdf = async () => {
      try {
        setLoading(true);
        setError(null);

        const loadingTask = pdfjsLib.getDocument(pdfUrl);
        const pdfDoc = await loadingTask.promise;

        if (cancelled) return;

        setPdf(pdfDoc);
        setTotalPages(pdfDoc.numPages);
        setCurrentPage(Math.min(initialPageRef.current, pdfDoc.numPages));
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load PDF:', err);
          setError('Failed to load PDF');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadPdf();

    return () => {
      cancelled = true;
    };
  }, [pdfUrl]);

  const renderPage = useCallback(async () => {
    if (!pdf || !canvasRef.current || !containerRef.current) return;

    try {
      const page = await pdf.getPage(currentPage);

      const containerWidth = containerRef.current.clientWidth - 32;
      const containerHeight = containerRef.current.clientHeight - 32;

      const viewport = page.getViewport({ scale: 1 });
      const scaleX = containerWidth / viewport.width;
      const scaleY = containerHeight / viewport.height;
      const baseScale = Math.min(scaleX, scaleY, 2);
      const newScale = baseScale * zoom;
      const scaledViewport = page.getViewport({ scale: newScale });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      const pixelRatio = window.devicePixelRatio || 1;

      canvas.width = scaledViewport.width * pixelRatio;
      canvas.height = scaledViewport.height * pixelRatio;
      canvas.style.width = `${scaledViewport.width}px`;
      canvas.style.height = `${scaledViewport.height}px`;

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      await page.render({
        canvasContext: context,
        viewport: scaledViewport,
      }).promise;

      const textContent = await page.getTextContent();
      const items = textContent.items as TextItem[];

      const rawWords: {
        word: string;
        left: number;
        top: number;
        width: number;
        height: number;
        fontSize: number;
      }[] = [];

      for (const item of items) {
        if (!item.str.trim()) continue;

        const [, , , , tx, ty] = item.transform;

        const itemWords = item.str.split(/(\s+)/);
        let offsetX = 0;

        for (const w of itemWords) {
          if (!w.trim()) {
            offsetX += (item.width / item.str.length) * w.length * newScale;
            continue;
          }

          const wordWidth = (item.width / item.str.length) * w.length * newScale;
          const fontSize = Math.abs(item.transform[0]) * newScale;

          rawWords.push({
            word: w,
            left: (tx + offsetX / newScale) * newScale,
            top: scaledViewport.height - ty * newScale - fontSize,
            width: wordWidth,
            height: fontSize * 1.2,
            fontSize,
          });

          offsetX += wordWidth;
        }
      }

      const wordPositions: WordPosition[] = [];
      const hyphenatedPairs = new Map<number, string>();

      for (let i = 0; i < rawWords.length; i++) {
        const current = rawWords[i];
        if (current.word.endsWith('-') && i + 1 < rawWords.length) {
          const next = rawWords[i + 1];
          const isOnNextLine = Math.abs(next.top - current.top) > current.fontSize * 0.5;
          if (isOnNextLine && /^[a-ząćęłńóśźżA-ZĄĆĘŁŃÓŚŹŻ]/.test(next.word)) {
            const combined = current.word.slice(0, -1) + next.word;
            hyphenatedPairs.set(i, combined);
            hyphenatedPairs.set(i + 1, combined);
          }
        }
      }

      for (let i = 0; i < rawWords.length; i++) {
        const raw = rawWords[i];
        const combinedWord = hyphenatedPairs.get(i);
        wordPositions.push({
          word: combinedWord || raw.word,
          displayWord: raw.word,
          left: raw.left,
          top: raw.top,
          width: raw.width,
          height: raw.height,
          fontSize: raw.fontSize,
        });
      }

      setWords(wordPositions);
      if (!initialRenderDone) setInitialRenderDone(true);
    } catch (err) {
      console.error('Failed to render page:', err);
    }
  }, [pdf, currentPage, zoom, initialRenderDone]);

  const appliedStoredZoomRef = useRef(false);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

  useEffect(() => {
    if (!initialRenderDone || !appliedStoredZoomRef.current) return;
    appliedStoredZoomRef.current = true;
    const storedZoom = getStoredZoom(bookId);
    if (storedZoom !== 1) setZoom(storedZoom);
  }, [initialRenderDone, bookId]);

  useEffect(() => {
    if (initialRenderDone) localStorage.setItem(`polingu_zoom_${bookId}`, String(zoom));
  }, [zoom, bookId, initialRenderDone]);

  const onPageChangeRef = useRef(onPageChange);
  onPageChangeRef.current = onPageChange;

  useEffect(() => {
    if (onPageChangeRef.current && totalPages > 0) {
      onPageChangeRef.current(currentPage, totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    const handleResize = () => {
      renderPage();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderPage]);

  const goToPage = useCallback(
    (page: number) => {
      if (page >= 1 && page <= totalPages) {
        setCurrentPage(page);
        window.scrollTo({ top: 0 });
      }
    },
    [totalPages]
  );

  const zoomIn = () => setZoom((z) => Math.min(z + ZOOM_STEP, MAX_ZOOM));
  const zoomOut = () => setZoom((z) => Math.max(z - ZOOM_STEP, MIN_ZOOM));

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
    const target = e.target as HTMLElement;
    isWordDragRef.current =
      target.hasAttribute('data-word-index') || target.closest('[data-word-index]') !== null;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartRef.current || isWordDragRef.current) {
        touchStartRef.current = null;
        isWordDragRef.current = false;
        return;
      }

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - touchStartRef.current.x;
      const deltaY = touch.clientY - touchStartRef.current.y;

      const minSwipeDistance = 50;

      if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > minSwipeDistance) {
        if (deltaX < 0) {
          goToPage(currentPage + 1);
        } else {
          goToPage(currentPage - 1);
        }
      }

      touchStartRef.current = null;
      isWordDragRef.current = false;
    },
    [currentPage, goToPage]
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        goToPage(currentPage - 1);
      } else if (e.key === 'ArrowRight') {
        goToPage(currentPage + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentPage, goToPage]);

  if (loading) {
    return (
      <ViewerContainer>
        <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
          <CircularProgress />
        </Box>
      </ViewerContainer>
    );
  }

  if (error) {
    return (
      <ViewerContainer>
        <Box display="flex" justifyContent="center" alignItems="center" flex={1}>
          <Typography color="error">{error}</Typography>
        </Box>
      </ViewerContainer>
    );
  }

  return (
    <ViewerContainer>
      <PageContainer ref={containerRef} onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
        <PageWrapper>
          <Canvas ref={canvasRef} />
          <TextLayer
            sx={{
              width: canvasRef.current?.style.width || 'auto',
              height: canvasRef.current?.style.height || 'auto',
            }}
          >
            <TranslatableText>
              {words.map((item, index) => (
                <PdfWordBox
                  key={`${currentPage}-${index}`}
                  item={item}
                  index={index}
                  pageKey={currentPage}
                />
              ))}
            </TranslatableText>
          </TextLayer>
        </PageWrapper>
      </PageContainer>
      <NavigationBar>
        <Box sx={{ position: 'absolute', left: 8, display: 'flex', alignItems: 'center' }}>
          <Tooltip title={bookmarks.includes(currentPage) ? 'Remove bookmark' : 'Add bookmark'}>
            <IconButton onClick={() => onBookmarkToggle?.(currentPage)} size="small">
              {bookmarks.includes(currentPage) ? (
                <BookmarkIcon color="warning" />
              ) : (
                <BookmarkBorderIcon />
              )}
            </IconButton>
          </Tooltip>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton
            onClick={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
            size="small"
          >
            <ChevronLeftIcon />
          </IconButton>
          <Typography variant="body2">
            {currentPage} / {totalPages}
          </Typography>
          <IconButton
            onClick={() => goToPage(currentPage + 1)}
            disabled={currentPage >= totalPages}
            size="small"
          >
            <ChevronRightIcon />
          </IconButton>
        </Box>
        <Box
          sx={{ position: 'absolute', right: 8, display: 'flex', alignItems: 'center', gap: 0.5 }}
        >
          <IconButton onClick={zoomOut} disabled={zoom <= MIN_ZOOM} size="small">
            <RemoveIcon fontSize="small" />
          </IconButton>
          <Typography variant="body2" sx={{ minWidth: 45, textAlign: 'center' }}>
            {Math.round(zoom * 100)}%
          </Typography>
          <IconButton onClick={zoomIn} disabled={zoom >= MAX_ZOOM} size="small">
            <AddIcon fontSize="small" />
          </IconButton>
        </Box>
      </NavigationBar>
      <PageProgressBar
        currentPage={currentPage}
        totalPages={totalPages}
        bookmarks={bookmarks}
        onPageChange={goToPage}
      />
    </ViewerContainer>
  );
}
