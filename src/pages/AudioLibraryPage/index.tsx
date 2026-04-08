import { useState, useRef, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
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
  Stack,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import TextFieldsIcon from '@mui/icons-material/TextFields';
import FileUploadIcon from '@mui/icons-material/FileUpload';
import { styled } from '../../lib/styled';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import {
  uploadAudio,
  deleteUserAudio,
  updateUserAudio,
  createSystemAudio,
  createUserAudio,
  deleteSystemAudio,
  updateSystemAudio,
} from '../../lib/audio';
import { useAudioPlayerContext } from '../../contexts/AudioPlayerContext';
import { useAuthContext } from '../../hooks/useAuthContext';
import { useSnackbar } from '../../hooks/useSnackbar';
import type { AudioItem, AudioUploadProgress, SystemAudioItem } from '../../types/audio';
import { MiniPlayerBar, MINI_PLAYER_HEIGHT } from '../../components/MiniPlayerBar';

type MergedItem = (AudioItem & { source: 'user' }) | (SystemAudioItem & { source: 'system' });

const PageContainer = styled(Box)(({ theme }) => ({
  flex: 1,
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(2),
  padding: theme.spacing(2, 1),
  maxWidth: 980,
  margin: '0 auto',
  width: '100%',
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(3, 2),
  },
}));

const PlaylistCard = styled(Card)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  overflow: 'hidden',
}));

const SectionHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: theme.spacing(1.5, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
}));

const MenuButton = styled(IconButton)(({ theme }) => ({
  marginLeft: 'auto',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const TrackRow = styled(Box)(({ theme }) => ({
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'flex-start',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.25, 2),
  textAlign: 'left',
  borderBottom: `1px solid ${theme.palette.divider}`,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

const TrackIconWrap = styled(Box)(({ theme }) => ({
  width: 40,
  height: 40,
  borderRadius: 999,
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}));

const MetaText = styled(Typography)(({ theme }) => ({
  color: theme.palette.text.secondary,
  fontSize: '0.8rem',
}));

const ProcessingList = styled(Box)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  border: `1px solid ${theme.palette.divider}`,
  overflow: 'hidden',
}));

const ProcessingRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.25, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  '&:last-child': {
    borderBottom: 0,
  },
}));

const EmptyState = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(5, 2),
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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatCreatedDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp);
}

export function AudioLibraryPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    items,
    systemItems,
    libraryLoading,
    activeAudioId,
    audioItem: activeItem,
    isPlaying,
    loading: trackLoading,
    togglePlay,
    playFromLibrary,
    addToQueue,
    insertNext,
  } = useAudioPlayerContext();
  const { isAdmin } = useAuthContext();
  const { showSnackbar } = useSnackbar();
  const [uploadProgress, setUploadProgress] = useState<AudioUploadProgress | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; item: MergedItem } | null>(null);
  const [editDialog, setEditDialog] = useState<MergedItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<MergedItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createMode, setCreateMode] = useState<'system' | 'user'>('user');
  const [createTitle, setCreateTitle] = useState('');
  const [createText, setCreateText] = useState('');
  const [creating, setCreating] = useState(false);

  const MAX_USER_TEXT_CHARS = 2000;

  const resetCreateForm = () => {
    setCreateTitle('');
    setCreateText('');
  };

  const allReadyItems: MergedItem[] = useMemo(() => {
    const user: MergedItem[] = items
      .filter((i) => i.status === 'ready')
      .map((i) => ({ ...i, source: 'user' as const }));
    const system: MergedItem[] = systemItems
      .filter((i) => i.status === 'ready')
      .map((i) => ({ ...i, source: 'system' as const }));
    return [...system, ...user].sort((a, b) => b.createdAt - a.createdAt);
  }, [items, systemItems]);

  const allProcessingItems: MergedItem[] = useMemo(() => {
    const user: MergedItem[] = items
      .filter((i) => i.status === 'processing')
      .map((i) => ({ ...i, source: 'user' as const }));
    const system: MergedItem[] = systemItems
      .filter((i) => i.status === 'processing')
      .map((i) => ({ ...i, source: 'system' as const }));
    return [...user, ...system];
  }, [items, systemItems]);

  const errorItems: MergedItem[] = useMemo(() => {
    const userErrors: MergedItem[] = items
      .filter((i) => i.status === 'error')
      .map((i) => ({ ...i, source: 'user' as const }));
    const systemErrors: MergedItem[] = isAdmin
      ? systemItems
          .filter((i) => i.status === 'error')
          .map((i) => ({ ...i, source: 'system' as const }))
      : [];
    return [...userErrors, ...systemErrors];
  }, [items, systemItems, isAdmin]);

  const handleTrackClick = (item: MergedItem) => {
    if (item.id === activeAudioId) {
      togglePlay();
    } else {
      playFromLibrary(item.id, allReadyItems);
    }
  };

  const handlePlayNext = (item: MergedItem) => {
    insertNext(item.id);
    showSnackbar('Playing next', 'success');
    setMenuAnchor(null);
  };

  const handleAddToQueue = (item: MergedItem) => {
    addToQueue(item.id);
    showSnackbar('Added to queue', 'success');
    setMenuAnchor(null);
  };

  const handleCopyTranscript = async (item: MergedItem) => {
    setMenuAnchor(null);
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

  const openEditDialog = (item: MergedItem) => {
    setEditTitle(item.title);
    setEditDialog(item);
    setMenuAnchor(null);
  };

  const closeEditDialog = () => {
    setEditDialog(null);
    setEditTitle('');
  };

  const handleSaveEdit = async () => {
    if (!editDialog || !editTitle.trim()) return;
    setSaving(true);
    try {
      if (editDialog.source === 'system') {
        await updateSystemAudio(editDialog.id, { title: editTitle.trim() });
      } else {
        await updateUserAudio(editDialog.id, { title: editTitle.trim() });
      }
    } catch (error) {
      console.error('Update failed:', error);
    } finally {
      setSaving(false);
      closeEditDialog();
    }
  };

  const openDeleteConfirm = (item: MergedItem) => {
    setDeleteConfirm(item);
    setMenuAnchor(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      if (deleteConfirm.source === 'system') {
        await deleteSystemAudio(deleteConfirm.id);
      } else {
        await deleteUserAudio(deleteConfirm.id);
      }
    } catch (error) {
      console.error('Delete failed:', error);
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    event.target.value = '';
    try {
      await uploadAudio(file, setUploadProgress);
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setUploadProgress(null);
    }
  };

  const handleCreateAudio = async () => {
    if (!createTitle.trim() || !createText.trim()) return;
    setCreating(true);
    try {
      if (createMode === 'system') {
        await createSystemAudio({ title: createTitle.trim(), text: createText.trim() });
        showSnackbar('System audio queued for processing', 'success');
      } else {
        await createUserAudio({ title: createTitle.trim(), text: createText.trim() });
        showSnackbar('Audio queued for processing', 'success');
      }
      setCreateDialogOpen(false);
      resetCreateForm();
    } catch (error: unknown) {
      console.error('Create failed:', error);
      const message =
        error instanceof Error
          ? error.message
          : createMode === 'system'
            ? 'Failed to create system audio'
            : 'Failed to generate audio';
      showSnackbar(message, 'error');
    } finally {
      setCreating(false);
    }
  };

  const canEdit = (item: MergedItem) => item.source === 'user' || isAdmin;
  const canDelete = (item: MergedItem) => item.source === 'user' || isAdmin;

  const showMiniPlayer = !!activeAudioId && !!activeItem;

  if (libraryLoading) {
    return (
      <PageContainer>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
          <CircularProgress />
        </Box>
      </PageContainer>
    );
  }

  return (
    <PageContainer sx={showMiniPlayer ? { pb: `${MINI_PLAYER_HEIGHT + 8}px` } : undefined}>
      {allProcessingItems.length > 0 && (
        <ProcessingList>
          <SectionHeader>
            <Typography variant="subtitle2" fontWeight={700}>
              Processing
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Transcribing
            </Typography>
          </SectionHeader>
          {allProcessingItems.map((item) => (
            <ProcessingRow key={item.id}>
              <CircularProgress size={20} />
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {item.title || ('fileName' in item ? item.fileName : '')}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <MetaText noWrap>
                    {item.source === 'system' ||
                    ('fileSize' in item && item.fileSize === 0)
                      ? 'Generating audio & transcript...'
                      : 'fileName' in item
                        ? item.fileName
                        : ''}
                  </MetaText>
                  {item.source === 'system' && (
                    <>
                      <Typography variant="caption" color="text.disabled">
                        &bull;
                      </Typography>
                      <MetaText noWrap>System</MetaText>
                    </>
                  )}
                </Stack>
              </Box>
            </ProcessingRow>
          ))}
        </ProcessingList>
      )}

      <PlaylistCard>
        <SectionHeader>
          <Typography variant="subtitle1" fontWeight={700}>
            Audios
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="caption" color="text.secondary">
              {allReadyItems.length} audios
            </Typography>
            <IconButton size="small" onClick={(e) => setAddMenuAnchor(e.currentTarget)}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
        </SectionHeader>

        {allReadyItems.map((item) => {
          const isActive = item.id === activeAudioId;
          const isLoadingTrack = isActive && trackLoading;

          return (
            <TrackRow key={item.id} onClick={() => handleTrackClick(item)}>
              <TrackIconWrap>
                {isLoadingTrack ? (
                  <CircularProgress size={20} sx={{ color: 'primary.contrastText' }} />
                ) : isActive && isPlaying ? (
                  <PauseIcon />
                ) : (
                  <PlayArrowIcon />
                )}
              </TrackIconWrap>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="body2"
                  fontWeight={700}
                  noWrap
                  color={isActive ? 'primary.main' : undefined}
                >
                  {item.title}
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <MetaText noWrap>{formatDuration(item.duration)}</MetaText>
                  <Typography variant="caption" color="text.disabled">
                    &bull;
                  </Typography>
                  <MetaText noWrap>{formatCreatedDate(item.createdAt)}</MetaText>
                  {item.source === 'system' && (
                    <>
                      <Typography variant="caption" color="text.disabled">
                        &bull;
                      </Typography>
                      <MetaText noWrap>System</MetaText>
                    </>
                  )}
                </Stack>
              </Box>
              <MenuButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuAnchor({ el: e.currentTarget, item });
                }}
              >
                <MoreVertIcon fontSize="small" />
              </MenuButton>
            </TrackRow>
          );
        })}

        {errorItems.map((item) => (
          <TrackRow key={item.id} sx={{ cursor: 'default' }}>
            <TrackIconWrap sx={{ bgcolor: 'error.main' }}>
              <ErrorOutlineIcon />
            </TrackIconWrap>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="body2" fontWeight={700} noWrap>
                {item.title}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center">
                <MetaText noWrap color="error.main">
                  {'error' in item && item.error ? item.error : 'Processing failed'}
                </MetaText>
                {item.source === 'system' && (
                  <>
                    <Typography variant="caption" color="text.disabled">
                      &bull;
                    </Typography>
                    <MetaText noWrap>System</MetaText>
                  </>
                )}
              </Stack>
            </Box>
            <MenuButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setMenuAnchor({ el: e.currentTarget, item });
              }}
            >
              <MoreVertIcon fontSize="small" />
            </MenuButton>
          </TrackRow>
        ))}

        {allReadyItems.length === 0 && allProcessingItems.length === 0 && (
          <EmptyState>
            <HeadphonesIcon sx={{ fontSize: 48, mb: 1.5, opacity: 0.35 }} />
            <Typography variant="subtitle1" gutterBottom fontWeight={700}>
              No audios yet
            </Typography>
            <Typography variant="body2">
              Upload a Polish audio file or generate audio from text to build your library.
            </Typography>
          </EmptyState>
        )}
      </PlaylistCard>

      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.ogg,.flac,.m4a,audio/*"
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {uploadProgress && (
        <UploadProgressOverlay>
          <Typography variant="body2" gutterBottom>
            {uploadProgress.status === 'uploading' && 'Uploading...'}
            {uploadProgress.status === 'processing' && 'Transcribing audio...'}
            {uploadProgress.status === 'error' && `Error: ${uploadProgress.error}`}
          </Typography>
          {uploadProgress.status === 'uploading' && uploadProgress.uploadPercent !== undefined && (
            <LinearProgress variant="determinate" value={uploadProgress.uploadPercent} />
          )}
          {uploadProgress.status === 'processing' && <LinearProgress />}
        </UploadProgressOverlay>
      )}

      <Menu
        anchorEl={addMenuAnchor}
        open={!!addMenuAnchor}
        onClose={() => setAddMenuAnchor(null)}
      >
        <MenuItem
          onClick={() => {
            setAddMenuAnchor(null);
            fileInputRef.current?.click();
          }}
        >
          <ListItemIcon>
            <FileUploadIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Upload Audio"
            secondary="Upload an MP3, WAV, or other audio file"
          />
        </MenuItem>
        <MenuItem
          onClick={() => {
            setAddMenuAnchor(null);
            setCreateMode('user');
            setCreateDialogOpen(true);
          }}
        >
          <ListItemIcon>
            <TextFieldsIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText
            primary="Generate from Text"
            secondary="Enter Polish text to generate audio with transcript"
          />
        </MenuItem>
        {isAdmin && (
          <MenuItem
            onClick={() => {
              setAddMenuAnchor(null);
              setCreateMode('system');
              setCreateDialogOpen(true);
            }}
          >
            <ListItemIcon>
              <AddIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary="Create System Audio"
              secondary="Create audio visible to all users"
            />
          </MenuItem>
        )}
      </Menu>

      <Menu anchorEl={menuAnchor?.el} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => menuAnchor && handlePlayNext(menuAnchor.item)}>
          <ListItemIcon>
            <PlaylistPlayIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Play Next</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => menuAnchor && handleAddToQueue(menuAnchor.item)}>
          <ListItemIcon>
            <QueueMusicIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Add to Queue</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => menuAnchor && handleCopyTranscript(menuAnchor.item)}>
          <ListItemIcon>
            <ContentCopyIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy Transcript</ListItemText>
        </MenuItem>
        {menuAnchor && canEdit(menuAnchor.item) && (
          <MenuItem onClick={() => menuAnchor && openEditDialog(menuAnchor.item)}>
            <ListItemIcon>
              <EditIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Rename</ListItemText>
          </MenuItem>
        )}
        {menuAnchor && canDelete(menuAnchor.item) && (
          <MenuItem onClick={() => menuAnchor && openDeleteConfirm(menuAnchor.item)}>
            <ListItemIcon>
              <DeleteIcon fontSize="small" color="error" />
            </ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
          </MenuItem>
        )}
      </Menu>

      <Dialog open={!!editDialog} onClose={closeEditDialog} maxWidth="xs" fullWidth>
        <DialogTitle>Rename Audio</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Title"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            sx={{ mt: 1 }}
          />
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
        <DialogTitle>Delete Audio</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete &quot;{deleteConfirm?.title}&quot;?
            {deleteConfirm?.source === 'system'
              ? ' This will remove the audio for all users.'
              : ' This will remove the audio file and its transcript.'}
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

      <Dialog
        open={createDialogOpen}
        onClose={() => {
          if (!creating) {
            resetCreateForm();
            setCreateDialogOpen(false);
          }
        }}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {createMode === 'system' ? 'Create System Audio' : 'Generate Audio from Text'}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Title"
            value={createTitle}
            onChange={(e) => setCreateTitle(e.target.value)}
            disabled={creating}
            sx={{ mt: 1 }}
          />
          <TextField
            fullWidth
            label="Polish text"
            value={createText}
            onChange={(e) => {
              if (createMode === 'user' && e.target.value.length > MAX_USER_TEXT_CHARS) return;
              setCreateText(e.target.value);
            }}
            disabled={creating}
            multiline
            minRows={4}
            sx={{ mt: 2 }}
            helperText={
              createMode === 'user'
                ? `${createText.length}/${MAX_USER_TEXT_CHARS}`
                : undefined
            }
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              resetCreateForm();
              setCreateDialogOpen(false);
            }}
            disabled={creating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCreateAudio}
            disabled={creating || !createTitle.trim() || !createText.trim()}
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>

      {showMiniPlayer && <MiniPlayerBar />}
    </PageContainer>
  );
}
