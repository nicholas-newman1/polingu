import { useEffect, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import { showSaveError } from '../../lib/storage/errorHandler';

interface EditTranscriptSegmentDialogProps {
  open: boolean;
  initialText: string;
  onClose: () => void;
  onSave: (text: string) => Promise<void>;
}

export function EditTranscriptSegmentDialog({
  open,
  initialText,
  onClose,
  onSave,
}: EditTranscriptSegmentDialogProps) {
  const [draftText, setDraftText] = useState(initialText);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setDraftText(initialText);
  }, [open, initialText]);

  const handleSave = async () => {
    const trimmed = draftText.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      await onSave(trimmed);
    } catch (e) {
      showSaveError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit Transcript Line</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          multiline
          minRows={2}
          label="Line text"
          value={draftText}
          onChange={(e) => setDraftText(e.target.value)}
          sx={{ mt: 1 }}
          data-qa="edit-transcript-line-input"
        />
        <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
          Editing recalculates word timings evenly across this line.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving} data-qa="edit-transcript-cancel">
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={saving || !draftText.trim()}
          data-qa="edit-transcript-save"
        >
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
