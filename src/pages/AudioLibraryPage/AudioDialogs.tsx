import { useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from '@mui/material';
import {
  createSystemAudio,
  createUserAudio,
  deleteSystemAudio,
  deleteUserAudio,
  updateSystemAudio,
  updateUserAudio,
} from '../../lib/audio';
import { useSnackbar } from '../../hooks/useSnackbar';
import type { MergedItem } from './types';

const MAX_USER_TEXT_CHARS = 2000;

/** Mount with `key={item?.id}` so the title resets for each item. */
export function RenameAudioDialog({
  item,
  onClose,
}: {
  item: MergedItem | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!item || !title.trim()) return;
    setSaving(true);
    try {
      const update = item.source === 'system' ? updateSystemAudio : updateUserAudio;
      await update(item.id, { title: title.trim() });
    } catch (error) {
      console.error('Update failed:', error);
    } finally {
      setSaving(false);
      onClose();
    }
  };

  return (
    <Dialog open={!!item} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Rename Audio</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving || !title.trim()}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function DeleteAudioDialog({
  item,
  onClose,
}: {
  item: MergedItem | null;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!item) return;
    setDeleting(true);
    try {
      await (item.source === 'system' ? deleteSystemAudio(item.id) : deleteUserAudio(item.id));
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeleting(false);
      onClose();
    }
  };

  return (
    <Dialog open={!!item} onClose={onClose}>
      <DialogTitle>Delete Audio</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete &quot;{item?.title}&quot;?
          {item?.source === 'system'
            ? ' This will remove the audio for all users.'
            : ' This will remove the audio file and its transcript.'}
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={deleting}>
          Cancel
        </Button>
        <Button onClick={handleDelete} color="error" disabled={deleting}>
          {deleting ? 'Deleting...' : 'Delete'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const CREATE_COPY = {
  system: {
    title: 'Create System Audio',
    success: 'System audio queued for processing',
    failure: 'Failed to create system audio',
    create: createSystemAudio,
  },
  user: {
    title: 'Generate Audio from Text',
    success: 'Audio queued for processing',
    failure: 'Failed to generate audio',
    create: createUserAudio,
  },
};

/** Mount with a `key` that changes per opening so the form starts empty. */
export function CreateAudioDialog({
  mode,
  open,
  onClose,
}: {
  mode: 'system' | 'user';
  open: boolean;
  onClose: () => void;
}) {
  const { showSnackbar } = useSnackbar();
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const [creating, setCreating] = useState(false);
  const copy = CREATE_COPY[mode];
  const isUser = mode === 'user';

  const handleCreate = async () => {
    if (!title.trim() || !text.trim()) return;
    setCreating(true);
    try {
      await copy.create({ title: title.trim(), text: text.trim() });
      showSnackbar(copy.success, 'success');
      onClose();
    } catch (error: unknown) {
      console.error('Create failed:', error);
      showSnackbar(error instanceof Error ? error.message : copy.failure, 'error');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    if (!creating) onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{copy.title}</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          disabled={creating}
          sx={{ mt: 1 }}
        />
        <TextField
          fullWidth
          label="Polish text"
          value={text}
          onChange={(e) => {
            if (isUser && e.target.value.length > MAX_USER_TEXT_CHARS) return;
            setText(e.target.value);
          }}
          disabled={creating}
          multiline
          minRows={4}
          sx={{ mt: 2 }}
          helperText={isUser ? `${text.length}/${MAX_USER_TEXT_CHARS}` : undefined}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={creating}>
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={creating || !title.trim() || !text.trim()}>
          {creating ? 'Creating...' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
