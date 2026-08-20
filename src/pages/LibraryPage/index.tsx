import { useState, useEffect, useMemo, useCallback } from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { styled } from '../../lib/styled';
import { useSnackbar } from '../../hooks/useSnackbar';
import {
  getCachedBooks,
  subscribeToBooksUpdates,
  getStorageUsage,
  getReadingProgress,
} from '../../lib/reader';
import type { Book, ReadingProgress, UploadProgress } from '../../types/reader';
import { AddBookDialog } from './components/AddBookDialog';
import { EditBookDialog } from './components/EditBookDialog';
import { DeleteBookDialog } from './components/DeleteBookDialog';
import { ProcessingBookCards, ReadyBookCards } from './components/BookCards';
import { AddBookCard } from './components/AddBookCard';
import { UploadProgressOverlay } from './components/UploadProgressOverlay';
import { BookMenu } from './components/BookMenu';

const PageContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  padding: theme.spacing(2),
  maxWidth: 960,
  margin: '0 auto',
  width: '100%',
}));

const Header = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: theme.spacing(3),
}));

const StorageInfo = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  color: theme.palette.text.secondary,
  fontSize: '0.875rem',
}));

const BooksGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
  gap: theme.spacing(2),
  [theme.breakpoints.up('sm')]: {
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  },
}));

const EmptyState = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(6),
  color: theme.palette.text.secondary,
}));

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function LibraryPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [bookToEdit, setBookToEdit] = useState<Book | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; book: Book } | null>(null);
  const [storageUsage, setStorageUsage] = useState<{ usedBytes: number; maxBytes: number } | null>(
    null
  );
  const [progressMap, setProgressMap] = useState<Record<string, ReadingProgress>>({});
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const { showSnackbar } = useSnackbar();

  const handleUploadError = useCallback(
    (message: string) => showSnackbar(message, 'error'),
    [showSnackbar]
  );

  const refreshStorageUsage = useCallback(async () => {
    try {
      const usage = await getStorageUsage();
      setStorageUsage(usage);
    } catch (err) {
      console.error('Failed to load storage usage:', err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    getCachedBooks().then((cached) => {
      if (!cancelled) {
        setBooks(cached);
        setLoading(false);
      }
    });

    const unsubscribe = subscribeToBooksUpdates((updatedBooks: Book[]) => {
      if (!cancelled) {
        setBooks(updatedBooks);
        setLoading(false);
      }
    });

    getStorageUsage()
      .then((usage) => {
        if (!cancelled) setStorageUsage(usage);
      })
      .catch((err) => console.error('Failed to load storage usage:', err));

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const loadProgress = async () => {
      const readyBooks = books.filter((b) => b.status === 'ready');
      const progressResults = await Promise.all(
        readyBooks.map(async (book) => {
          const progress = await getReadingProgress(book.id);
          return { bookId: book.id, progress };
        })
      );

      const newProgressMap: Record<string, ReadingProgress> = {};
      progressResults.forEach(({ bookId, progress }) => {
        if (progress) {
          newProgressMap[bookId] = progress;
        }
      });
      setProgressMap(newProgressMap);
    };

    if (books.length > 0) {
      loadProgress();
    }
  }, [books]);

  const handleBookMenuClick = useCallback((book: Book, anchorEl: HTMLElement) => {
    setMenuAnchor({ el: anchorEl, book });
  }, []);

  const handleEditBook = useCallback((book: Book) => {
    setBookToEdit(book);
    setMenuAnchor(null);
  }, []);

  const handleDeleteBook = useCallback((book: Book) => {
    setBookToDelete(book);
    setMenuAnchor(null);
  }, []);

  const processingBooks = books.filter((b) => b.status === 'processing');
  const sortedReadyBooks = useMemo(() => {
    const ready = books.filter((b) => b.status === 'ready');
    return [...ready].sort((a, b) => {
      const aLastRead = progressMap[a.id]?.lastReadAt ?? 0;
      const bLastRead = progressMap[b.id]?.lastReadAt ?? 0;
      return bLastRead - aLastRead;
    });
  }, [books, progressMap]);

  if (loading) {
    return (
      <PageContainer>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <Header>
        <Typography variant="h5" fontWeight={500}>
          My Library
        </Typography>
        {storageUsage && (
          <StorageInfo>
            {formatBytes(storageUsage.usedBytes)} / {formatBytes(storageUsage.maxBytes)}
          </StorageInfo>
        )}
      </Header>

      <BooksGrid>
        <AddBookCard onClick={() => setAddDialogOpen(true)} />

        <ProcessingBookCards books={processingBooks} />

        <ReadyBookCards
          books={sortedReadyBooks}
          progressMap={progressMap}
          onMenuClick={handleBookMenuClick}
        />
      </BooksGrid>

      {books.length === 0 && (
        <EmptyState>
          <MenuBookIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
          <Typography variant="h6" gutterBottom>
            Your library is empty
          </Typography>
          <Typography variant="body2">Upload a PDF or paste text to start reading</Typography>
        </EmptyState>
      )}

      <AddBookDialog
        open={addDialogOpen}
        onClose={() => setAddDialogOpen(false)}
        onUploadProgress={setUploadProgress}
        onComplete={refreshStorageUsage}
        onError={handleUploadError}
      />

      {uploadProgress && <UploadProgressOverlay progress={uploadProgress} />}

      <BookMenu
        anchorEl={menuAnchor?.el ?? null}
        book={menuAnchor?.book ?? null}
        onClose={() => setMenuAnchor(null)}
        onEdit={handleEditBook}
        onDelete={handleDeleteBook}
      />

      <EditBookDialog book={bookToEdit} onClose={() => setBookToEdit(null)} />

      <DeleteBookDialog
        book={bookToDelete}
        onClose={() => setBookToDelete(null)}
        onComplete={refreshStorageUsage}
      />
    </PageContainer>
  );
}
