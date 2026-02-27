import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, IconButton, Typography, CircularProgress } from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import * as pdfjsLib from 'pdfjs-dist';
import { styled } from '../../../lib/styled';
import { TranslatableWord } from '../../../components/TranslatableWord';
import { TranslatableText } from '../../../components/TranslatableText';
import { useTranslatableText } from '../../../hooks/useTranslatableText';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.0.379/pdf.worker.min.mjs`;

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
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
  gap: theme.spacing(2),
  padding: theme.spacing(1),
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
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
  initialPage?: number;
  onPageChange?: (page: number, totalPages: number) => void;
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

export function PdfViewer({ pdfUrl, initialPage = 1, onPageChange }: PdfViewerProps) {
  const [pdf, setPdf] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [words, setWords] = useState<WordPosition[]>([]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const initialPageRef = useRef(initialPage);

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
      const newScale = Math.min(scaleX, scaleY, 2);
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
    } catch (err) {
      console.error('Failed to render page:', err);
    }
  }, [pdf, currentPage]);

  useEffect(() => {
    renderPage();
  }, [renderPage]);

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

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
    }
  };

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
      <PageContainer ref={containerRef}>
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
        <IconButton onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>
          <ChevronLeftIcon />
        </IconButton>
        <Typography variant="body2">
          {currentPage} / {totalPages}
        </Typography>
        <IconButton onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= totalPages}>
          <ChevronRightIcon />
        </IconButton>
      </NavigationBar>
    </ViewerContainer>
  );
}
