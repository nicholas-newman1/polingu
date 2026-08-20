import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Box, CircularProgress, Typography } from '@mui/material';
import { styled } from '../../lib/styled';
import {
  getBook,
  getBookDownloadUrl,
  getBookTextContent,
  getReadingProgress,
  saveReadingProgress,
} from '../../lib/reader';
import type { Book, ReadingProgress } from '../../types/reader';
import { PdfViewer } from './components/PdfViewer';
import { TextViewer } from './components/TextViewer';
import type { TextReadingPosition } from './components/TextViewer';
import { usePageTitle } from '../../hooks/usePageTitle';

const PageContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  overflow: 'hidden',
  margin: -16,
  marginBottom: -128,
});

const PROGRESS_SAVE_DEBOUNCE = 2000;

const TextPageContainer = styled(Box)({
  display: 'flex',
  flexDirection: 'column',
  flex: 1,
  marginBottom: -128,
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

  const [book, setBook] = useState<Book | null>(null);

  usePageTitle(book?.title || null);
  const [progress, setProgress] = useState<ReadingProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pendingProgressRef = useRef<ReadingProgress | null>(null);

  useEffect(() => {
    return () => {
      if (!saveTimeoutRef.current) return;
      clearTimeout(saveTimeoutRef.current);
      if (pendingProgressRef.current) {
        saveReadingProgress(pendingProgressRef.current);
      }
    };
  }, []);

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

        if (bookData.fileType !== 'pdf' && bookData.fileType !== 'text') {
          setError('Unsupported book format');
          setLoading(false);
          return;
        }

        setBook(bookData);

        const progressData = await getReadingProgress(bookId);
        const initialProgress = progressData || {
          bookId,
          currentPage: 1,
          scrollPercent: 0,
          lastReadAt: Date.now(),
        };
        setProgress(initialProgress);
        if (!progressData) {
          saveReadingProgress(initialProgress);
        }

        if (bookData.fileType === 'pdf') {
          const url = await getBookDownloadUrl(bookData.storagePath);
          setPdfUrl(url);
        } else {
          const text = await getBookTextContent(bookId, bookData.storagePath);
          setTextContent(text);
        }
      } catch (err) {
        console.error('Failed to load book:', err);
        setError(err instanceof Error ? err.message : 'Failed to load book');
      } finally {
        setLoading(false);
      }
    };

    loadBook();
  }, [bookId]);

  const scheduleProgressSave = useCallback((newProgress: ReadingProgress) => {
    setProgress(newProgress);
    pendingProgressRef.current = newProgress;

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      saveTimeoutRef.current = undefined;
      pendingProgressRef.current = null;
      saveReadingProgress(newProgress);
    }, PROGRESS_SAVE_DEBOUNCE);
  }, []);

  const commitProgress = useCallback((newProgress: ReadingProgress) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = undefined;
    }
    pendingProgressRef.current = null;
    setProgress(newProgress);
    saveReadingProgress(newProgress);
  }, []);

  const handlePdfPageChange = useCallback(
    (page: number, totalPages: number) => {
      if (!progress || !bookId) return;

      scheduleProgressSave({
        ...progress,
        currentPage: page,
        scrollPercent: page / totalPages,
        lastReadAt: Date.now(),
      });
    },
    [progress, bookId, scheduleProgressSave]
  );

  const handleTextPositionChange = useCallback(
    ({ scrollPercent, paragraphIndex }: TextReadingPosition) => {
      if (!progress || !bookId) return;
      if (progress.scrollPercent === scrollPercent && progress.textAnchorIndex === paragraphIndex) {
        return;
      }

      scheduleProgressSave({
        ...progress,
        scrollPercent,
        textAnchorIndex: paragraphIndex,
        lastReadAt: Date.now(),
      });
    },
    [progress, bookId, scheduleProgressSave]
  );

  const handleTextBookmarkToggle = useCallback(
    (paragraphIndex: number) => {
      if (!progress || !bookId) return;

      const current = progress.textBookmarks || [];
      const textBookmarks = current.includes(paragraphIndex)
        ? current.filter((index) => index !== paragraphIndex)
        : [...current, paragraphIndex].sort((a, b) => a - b);

      commitProgress({ ...progress, textBookmarks, lastReadAt: Date.now() });
    },
    [progress, bookId, commitProgress]
  );

  const handleBookmarkToggle = useCallback(
    (page: number) => {
      if (!progress || !bookId) return;

      const currentBookmarks = progress.bookmarks || [];
      const bookmarks = currentBookmarks.includes(page)
        ? currentBookmarks.filter((p) => p !== page)
        : [...currentBookmarks, page].sort((a, b) => a - b);

      commitProgress({ ...progress, bookmarks, lastReadAt: Date.now() });
    },
    [progress, bookId, commitProgress]
  );

  if (loading) {
    return (
      <LoadingContainer>
        <CircularProgress />
        <Typography color="text.secondary">Loading book...</Typography>
      </LoadingContainer>
    );
  }

  if (error || !book || !progress) {
    return (
      <LoadingContainer>
        <Typography color="error">{error || 'Failed to load book'}</Typography>
      </LoadingContainer>
    );
  }

  if (book.fileType === 'text') {
    if (!textContent) {
      return (
        <LoadingContainer>
          <Typography color="error">Failed to load text content</Typography>
        </LoadingContainer>
      );
    }

    return (
      <TextPageContainer>
        <TextViewer
          text={textContent}
          initialScrollPercent={progress.scrollPercent}
          initialParagraphIndex={progress.textAnchorIndex}
          bookmarks={progress.textBookmarks || []}
          onPositionChange={handleTextPositionChange}
          onBookmarkToggle={handleTextBookmarkToggle}
        />
      </TextPageContainer>
    );
  }

  if (!pdfUrl) {
    return (
      <LoadingContainer>
        <Typography color="error">Failed to load PDF</Typography>
      </LoadingContainer>
    );
  }

  return (
    <PageContainer>
      <PdfViewer
        pdfUrl={pdfUrl}
        bookId={bookId!}
        initialPage={progress.currentPage || 1}
        bookmarks={progress.bookmarks || []}
        onPageChange={handlePdfPageChange}
        onBookmarkToggle={handleBookmarkToggle}
      />
    </PageContainer>
  );
}
