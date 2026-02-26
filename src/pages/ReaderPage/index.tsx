import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, CircularProgress, Typography, IconButton } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { styled } from '../../lib/styled';
import {
  getBook,
  getBookDownloadUrl,
  getReadingProgress,
  saveReadingProgress,
} from '../../lib/reader';
import type { Book, ReadingProgress } from '../../types/reader';
import { PdfViewer } from './components/PdfViewer';

const PageContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  height: '100vh',
  overflow: 'hidden',
});

const LoadingContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  height: '100vh',
  gap: 16,
});

export function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const navigate = useNavigate();

  const [book, setBook] = useState<Book | null>(null);
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!bookId) {
      setError('No book ID provided');
      setLoading(false);
      return;
    }

    const loadBook = async () => {
      try {
        const bookData = await getBook(bookId);

        if (!bookData) {
          setError('Book not found');
          setLoading(false);
          return;
        }

        if (bookData.fileType !== 'pdf') {
          setError('Only PDF files are supported');
          setLoading(false);
          return;
        }

        setBook(bookData);

        const [url, progressData] = await Promise.all([
          getBookDownloadUrl(bookData.storagePath),
          getReadingProgress(bookId),
        ]);

        setPdfUrl(url);
        setProgress(
          progressData || {
            bookId,
            currentPage: 1,
            scrollPercent: 0,
            lastReadAt: Date.now(),
          }
        );
      } catch (err) {
        console.error('Failed to load book:', err);
        setError('Failed to load book');
      } finally {
        setLoading(false);
      }
    };

    loadBook();
  }, [bookId]);

  const handlePdfPageChange = useCallback(
    (page: number, totalPages: number) => {
      if (!progress || !bookId) return;

      const newProgress: ReadingProgress = {
        ...progress,
        currentPage: page,
        scrollPercent: page / totalPages,
        lastReadAt: Date.now(),
      };

      setProgress(newProgress);

      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => {
        saveReadingProgress(newProgress);
      }, 2000);
    },
    [progress, bookId]
  );

  if (loading) {
    return (
      <LoadingContainer>
        <CircularProgress />
        <Typography color="text.secondary">Loading book...</Typography>
      </LoadingContainer>
    );
  }

  if (error || !book || !progress || !pdfUrl) {
    return (
      <LoadingContainer>
        <Typography color="error">{error || 'Failed to load book'}</Typography>
      </LoadingContainer>
    );
  }

  return (
    <PageContainer>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
        }}
      >
        <IconButton onClick={() => navigate('/library')} size="small">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="subtitle1" noWrap sx={{ flex: 1 }}>
          {book.title}
        </Typography>
      </Box>
      <PdfViewer
        pdfUrl={pdfUrl}
        initialPage={progress.currentPage || 1}
        onPageChange={handlePdfPageChange}
      />
    </PageContainer>
  );
}
