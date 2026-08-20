import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Typography,
} from '@mui/material';
import { updateBook } from '../../../lib/reader';
import type { Book, BookColor } from '../../../types/reader';
import { BOOK_COLORS } from '../../../types/reader';

interface EditBookDialogProps {
  book: Book | null;
  onClose: () => void;
}

export function EditBookDialog({ book, onClose }: EditBookDialogProps) {
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [color, setColor] = useState<BookColor>('red');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (book) {
      setTitle(book.title);
      setAuthor(book.author || '');
      setColor(book.color || 'red');
    }
  }, [book]);

  const handleClose = () => {
    if (saving) return;
    onClose();
  };

  const handleSave = async () => {
    if (!book || !title.trim()) return;

    setSaving(true);
    try {
      await updateBook(book.id, {
        title: title.trim(),
        author: author.trim(),
        color,
      });
      onClose();
    } catch (error) {
      console.error('Update failed:', error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!book} onClose={handleClose} maxWidth="xs" fullWidth>
      <DialogTitle>Edit Book</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField
            autoFocus
            fullWidth
            label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <TextField
            fullWidth
            label="Author"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
          <Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              Color
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {(Object.keys(BOOK_COLORS) as BookColor[]).map((colorKey) => (
                <Box
                  key={colorKey}
                  onClick={() => setColor(colorKey)}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: 1,
                    cursor: 'pointer',
                    background: `linear-gradient(135deg, ${BOOK_COLORS[colorKey].light} 0%, ${BOOK_COLORS[colorKey].main} 100%)`,
                    border: color === colorKey ? '2px solid' : '2px solid transparent',
                    borderColor: color === colorKey ? 'text.primary' : 'transparent',
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
        <Button onClick={handleClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !title.trim()}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
