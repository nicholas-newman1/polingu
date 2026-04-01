import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Card,
  CardContent,
  CardActionArea,
  IconButton,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  CircularProgress,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  TextField,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import { styled } from '../../lib/styled';
import {
  uploadBook,
  getCachedBooks,
  subscribeToBooksUpdates,
  deleteBook,
  updateBook,
  getStorageUsage,
  getReadingProgress,
} from '../../lib/reader';
import type { Book, BookColor, ReadingProgress, UploadProgress } from '../../types/reader';
import { BOOK_COLORS } from '../../types/reader';

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

const BookCard = styled(Card)({
  position: 'relative',
});

const BookCover = styled(Box)<{ $colorMain?: string; $colorLight?: string }>(
  ({ theme, $colorMain, $colorLight }) => ({
    height: 180,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `linear-gradient(135deg, ${$colorLight || theme.palette.primary.light} 0%, ${$colorMain || theme.palette.primary.main} 100%)`,
    color: '#fff',
    [theme.breakpoints.up('sm')]: {
      height: 220,
    },
  })
);

const MenuButton = styled(IconButton)(({ theme }) => ({
  position: 'absolute',
  top: 8,
  right: 8,
  zIndex: 1,
  backgroundColor: theme.palette.background.paper,
  boxShadow: theme.shadows[1],
  '&:hover': {
    backgroundColor: theme.palette.grey[100],
  },
}));

const UploadCard = styled(Card)(({ theme }) => ({
  border: `2px dashed ${theme.palette.divider}`,
  backgroundColor: 'transparent',
  cursor: 'pointer',
  '&:hover': {
    borderColor: theme.palette.primary.main,
    backgroundColor: theme.palette.action.hover,
  },
}));

const UploadContent = styled(Box)(({ theme }) => ({
  height: 180,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  color: theme.palette.text.secondary,
  [theme.breakpoints.up('sm')]: {
    height: 220,
  },
}));

const EmptyState = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(6),
  color: theme.palette.text.secondary,
}));

const UploadProgressOverlay = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: theme.spacing(2),
  left: '50%',
  transform: 'translateX(-50%)',
  backgroundColor: theme.palette.background.paper,
  borderRadius: theme.shape.borderRadius,
  padding: theme.spacing(2, 3),
  boxShadow: theme.shadows[8],
  minWidth: 300,
  zIndex: theme.zIndex.snackbar,
}));

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function LibraryPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Book | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editDialog, setEditDialog] = useState<Book | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editAuthor, setEditAuthor] = useState('');
  const [editColor, setEditColor] = useState<BookColor>('red');
  const [saving, setSaving] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; book: Book } | null>(null);
  const [storageUsage, setStorageUsage] = useState<{ usedBytes: number; maxBytes: number } | null>(
    null
  );
  const [progressMap, setProgressMap] = useState<Record<string, ReadingProgress>>({});

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

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = '';

    try {
      await uploadBook(file, setUploadProgress);
      const usage = await getStorageUsage();
      setStorageUsage(usage);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploadProgress(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setDeleting(true);
    try {
      await deleteBook(deleteConfirm.id);
      const usage = await getStorageUsage();
      setStorageUsage(usage);
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const handleSaveEdit = async () => {
    if (!editDialog || !editTitle.trim()) return;

    setSaving(true);
    try {
      await updateBook(editDialog.id, {
        title: editTitle.trim(),
        author: editAuthor.trim(),
        color: editColor,
      });
    } catch (error) {
      console.error('Update failed:', error);
    } finally {
      setSaving(false);
      closeEditDialog();
    }
  };

  const openEditDialog = (book: Book) => {
    setEditTitle(book.title);
    setEditAuthor(book.author || '');
    setEditColor(book.color || 'red');
    setEditDialog(book);
    setMenuAnchor(null);
  };

  const closeEditDialog = () => {
    setEditDialog(null);
    setEditTitle('');
    setEditAuthor('');
    setEditColor('red');
  };

  const openDeleteConfirm = (book: Book) => {
    setDeleteConfirm(book);
    setMenuAnchor(null);
  };

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
        <UploadCard onClick={() => fileInputRef.current?.click()}>
          <UploadContent>
            <AddIcon sx={{ fontSize: 40 }} />
            <Typography variant="body2">Add Book</Typography>
            <Typography variant="caption" color="text.disabled">
              PDF or EPUB
            </Typography>
          </UploadContent>
        </UploadCard>

        {processingBooks.map((book) => (
          <BookCard key={book.id}>
            <BookCover>
              <CircularProgress size={32} sx={{ color: 'inherit' }} />
            </BookCover>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="body2" noWrap>
                Processing...
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {book.fileName}
              </Typography>
            </CardContent>
          </BookCard>
        ))}

        {sortedReadyBooks.map((book) => {
          const progress = progressMap[book.id];
          const percentage =
            progress && book.pageCount
              ? Math.round((progress.currentPage / book.pageCount) * 100)
              : 0;

          return (
            <BookCard key={book.id}>
              <MenuButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuAnchor({ el: e.currentTarget, book });
                }}
              >
                <MoreVertIcon fontSize="small" />
              </MenuButton>
              <CardActionArea onClick={() => navigate(`/reader/${book.id}`)}>
                <BookCover
                  $colorMain={book.color ? BOOK_COLORS[book.color].main : undefined}
                  $colorLight={book.color ? BOOK_COLORS[book.color].light : undefined}
                >
                  <MenuBookIcon sx={{ fontSize: 48 }} />
                </BookCover>
                <CardContent sx={{ py: 1.5 }}>
                  <Typography
                    variant="subtitle1"
                    fontWeight={600}
                    sx={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {book.title}
                  </Typography>
                  {book.author && (
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {book.author}
                    </Typography>
                  )}
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                    <LinearProgress
                      variant="determinate"
                      value={percentage}
                      sx={{ flex: 1, height: 4, borderRadius: 2 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 32 }}>
                      {percentage}%
                    </Typography>
                  </Box>
                </CardContent>
              </CardActionArea>
            </BookCard>
          );
        })}
      </BooksGrid>

      {books.length === 0 && (
        <EmptyState>
          <MenuBookIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
          <Typography variant="h6" gutterBottom>
            Your library is empty
          </Typography>
          <Typography variant="body2">Upload a PDF or EPUB to start reading</Typography>
        </EmptyState>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {uploadProgress && (
        <UploadProgressOverlay>
          <Typography variant="body2" gutterBottom>
            {uploadProgress.status === 'uploading' && 'Uploading...'}
            {uploadProgress.status === 'processing' && 'Processing book...'}
            {uploadProgress.status === 'error' && `Error: ${uploadProgress.error}`}
          </Typography>
          {uploadProgress.status === 'uploading' && uploadProgress.uploadPercent !== undefined && (
            <LinearProgress variant="determinate" value={uploadProgress.uploadPercent} />
          )}
          {uploadProgress.status === 'processing' && <LinearProgress />}
        </UploadProgressOverlay>
      )}

      <Menu anchorEl={menuAnchor?.el} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => menuAnchor && openEditDialog(menuAnchor.book)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => menuAnchor && openDeleteConfirm(menuAnchor.book)}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
        </MenuItem>
      </Menu>

      <Dialog open={!!editDialog} onClose={closeEditDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Edit Book</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              autoFocus
              fullWidth
              label="Title"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />
            <TextField
              fullWidth
              label="Author"
              value={editAuthor}
              onChange={(e) => setEditAuthor(e.target.value)}
            />
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Color
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {(Object.keys(BOOK_COLORS) as BookColor[]).map((colorKey) => (
                  <Box
                    key={colorKey}
                    onClick={() => setEditColor(colorKey)}
                    sx={{
                      width: 32,
                      height: 32,
                      borderRadius: 1,
                      cursor: 'pointer',
                      background: `linear-gradient(135deg, ${BOOK_COLORS[colorKey].light} 0%, ${BOOK_COLORS[colorKey].main} 100%)`,
                      border: editColor === colorKey ? '2px solid' : '2px solid transparent',
                      borderColor: editColor === colorKey ? 'text.primary' : 'transparent',
                      '&:hover': {
                        opacity: 0.8,
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={closeEditDialog} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSaveEdit} disabled={saving || !editTitle.trim()}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)}>
        <DialogTitle>Delete Book</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{deleteConfirm?.title}"? This will remove the book and
            all your reading progress.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirm(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" disabled={deleting}>
            {deleting ? 'Deleting...' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </PageContainer>
  );
}
