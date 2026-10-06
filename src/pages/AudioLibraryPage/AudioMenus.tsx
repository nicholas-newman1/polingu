import type { ReactNode } from 'react';
import { ListItemIcon, ListItemText, Menu, MenuItem } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { useAudioPlayerContext } from '../../contexts/AudioPlayerContext';
import { useSnackbar } from '../../hooks/useSnackbar';
import type { MergedItem } from './types';

function MenuOption({
  icon,
  primary,
  secondary,
  danger = false,
  onClick,
}: {
  icon: ReactNode;
  primary: string;
  secondary?: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <MenuItem onClick={onClick}>
      <ListItemIcon>{icon}</ListItemIcon>
      <ListItemText
        primary={primary}
        secondary={secondary}
        sx={danger ? { color: 'error.main' } : undefined}
      />
    </MenuItem>
  );
}

interface AddAudioMenuProps {
  anchor: HTMLElement | null;
  isAdmin: boolean;
  onClose: () => void;
  onUpload: () => void;
  onCreate: (mode: 'system' | 'user') => void;
}

export function AddAudioMenu({ anchor, isAdmin, onClose, onUpload, onCreate }: AddAudioMenuProps) {
  const pick = (action: () => void) => () => {
    onClose();
    action();
  };

  return (
    <Menu anchorEl={anchor} open={!!anchor} onClose={onClose}>
      <MenuOption
        icon={<FileUploadIcon fontSize="small" />}
        primary="Upload Audio"
        secondary="Upload an MP3, WAV, or other audio file"
        onClick={pick(onUpload)}
      />
      <MenuOption
        icon={<TextFieldsIcon fontSize="small" />}
        primary="Generate from Text"
        secondary="Enter Polish text to generate audio with transcript"
        onClick={pick(() => onCreate('user'))}
      />
      {isAdmin && (
        <MenuOption
          icon={<AddIcon fontSize="small" />}
          primary="Create System Audio"
          secondary="Create audio visible to all users"
          onClick={pick(() => onCreate('system'))}
        />
      )}
    </Menu>
  );
}

interface ItemActionsMenuProps {
  anchor: { el: HTMLElement; item: MergedItem } | null;
  canManage: boolean;
  onClose: () => void;
  onRename: (item: MergedItem) => void;
  onDelete: (item: MergedItem) => void;
}

export function ItemActionsMenu({
  anchor,
  canManage,
  onClose,
  onRename,
  onDelete,
}: ItemActionsMenuProps) {
  const { addToQueue, insertNext } = useAudioPlayerContext();
  const { showSnackbar } = useSnackbar();

  const run = (action: (item: MergedItem) => void) => () => {
    if (!anchor) return;
    onClose();
    action(anchor.item);
  };

  const copyTranscript = async (item: MergedItem) => {
    const text = item.transcript.map((s) => s.text).join(' ');
    if (!text) {
      showSnackbar('No transcript available', 'warning');
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      showSnackbar('Transcript copied to clipboard', 'success');
    } catch {
      showSnackbar('Failed to copy transcript', 'error');
    }
  };

  return (
    <Menu anchorEl={anchor?.el} open={!!anchor} onClose={onClose}>
      <MenuOption
        icon={<PlaylistPlayIcon fontSize="small" />}
        primary="Play Next"
        onClick={run((item) => {
          insertNext(item.id);
          showSnackbar('Playing next', 'success');
        })}
      />
      <MenuOption
        icon={<QueueMusicIcon fontSize="small" />}
        primary="Add to Queue"
        onClick={run((item) => {
          addToQueue(item.id);
          showSnackbar('Added to queue', 'success');
        })}
      />
      <MenuOption
        icon={<ContentCopyIcon fontSize="small" />}
        primary="Copy Transcript"
        onClick={run(copyTranscript)}
      />
      {canManage && (
        <MenuOption icon={<EditIcon fontSize="small" />} primary="Rename" onClick={run(onRename)} />
      )}
      {canManage && (
        <MenuOption
          icon={<DeleteIcon fontSize="small" color="error" />}
          primary="Delete"
          danger
          onClick={run(onDelete)}
        />
      )}
    </Menu>
  );
}
