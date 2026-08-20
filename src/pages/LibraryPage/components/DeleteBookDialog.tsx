import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Typography,
} from '@mui/material';
import { deleteBook } from '../../../lib/reader';
import type { Book } from '../../../types/reader';

interface DeleteBookDialogProps {
  book: Book | null;
  onClose: () => void;
  onComplete: () => void;
}

export function DeleteBookDialog({ book, onClose, onComplete }: DeleteBookDialogProps) {
  const [deleting, setDeleting] = useState(false);

  const handleClose = () => {
    if (deleting) return;
    onClose();
  };

  const handleDelete = async () => {
    if (!book) return;

    setDeleting(true);
    try {
      await deleteBook(book.id);
      onComplete();
      onClose();
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={!!book} onClose={handleClose}>
      <DialogTitle>Delete Book</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete "{book?.title}"? This will remove the book and all your
          reading progress.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={deleting}>
          Cancel
        </Button>
        <Button onClick={handleDelete} color="error" disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
