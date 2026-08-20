import { useState, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { uploadBook, uploadText } from '../../../lib/reader';
import type { UploadProgress } from '../../../types/reader';

interface AddBookDialogProps {
  open: boolean;
  onClose: () => void;
  onUploadProgress: (progress: UploadProgress | null) => void;
  onComplete: () => void;
  onError: (message: string) => void;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Upload failed. Please try again.';
}

export function AddBookDialog({
  open,
  onClose,
  onUploadProgress,
  onComplete,
  onError,
}: AddBookDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setTitle('');
    setAuthor('');
    setContent('');
  };

  const handleClose = () => {
    if (submitting) return;
    resetForm();
    onClose();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    event.target.value = '';
    setSubmitting(true);
    onClose();
    resetForm();

    try {
      await uploadBook(file, onUploadProgress);
      onComplete();
    } catch (error) {
      console.error('Upload failed:', error);
      onError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
      onUploadProgress(null);
    }
  };

  const handlePasteText = async () => {
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      await uploadText(
        {
          content,
          title: title.trim() || undefined,
          author: author.trim() || undefined,
        },
        onUploadProgress
      );
      onComplete();
      resetForm();
      onClose();
    } catch (error) {
      console.error('Upload failed:', error);
      onError(toErrorMessage(error));
    } finally {
      setSubmitting(false);
      onUploadProgress(null);
    }
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
        <DialogTitle>Add Book</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              autoFocus
              fullWidth
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Optional — first line used if blank"
            />
            <TextField
              fullWidth
              label="Author"
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
            />
            <TextField
              fullWidth
              label="Text"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              multiline
              minRows={8}
              maxRows={16}
              placeholder="Paste your Polish text here..."
              required
            />
            <Button
              variant="outlined"
              startIcon={<UploadFileIcon />}
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting}
            >
              Upload PDF instead
            </Button>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handlePasteText} disabled={submitting || !content.trim()}>
            {submitting ? 'Adding...' : 'Add Text'}
          </Button>
        </DialogActions>
      </Dialog>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />
    </>
  );
}
