import { useState, useRef } from 'react';
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
  Chip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import QueueMusicIcon from '@mui/icons-material/QueueMusic';
import PlaylistPlayIcon from '@mui/icons-material/PlaylistPlay';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import { styled } from '../../lib/styled';
import { uploadAudio, deleteAudioItem, updateAudioItem } from '../../lib/audio';
import { useAudioPlayerContext } from '../../contexts/AudioPlayerContext';
import { useSnackbar } from '../../hooks/useSnackbar';
import type { AudioItem, AudioUploadProgress } from '../../types/audio';
import { MiniPlayerBar, MINI_PLAYER_HEIGHT } from '../../components/MiniPlayerBar';

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

const HeroCard = styled(Card)(({ theme }) => ({
  borderRadius: theme.spacing(2),
  padding: theme.spacing(2),
  background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
  color: theme.palette.primary.contrastText,
  [theme.breakpoints.up('sm')]: {
    padding: theme.spacing(2.5, 3),
  },
}));

const HeroRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: theme.spacing(1.5),
  [theme.breakpoints.up('sm')]: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: theme.spacing(2),
  },
}));

const UploadButton = styled(Button)(({ theme }) => ({
  borderRadius: 999,
  minWidth: 0,
  whiteSpace: 'nowrap',
  alignSelf: 'flex-start',
  backgroundColor: theme.palette.background.paper,
  color: theme.palette.text.primary,
  '&:hover': {
    backgroundColor: theme.palette.grey[100],
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
  const { showSnackbar } = useSnackbar();
  const [uploadProgress, setUploadProgress] = useState<AudioUploadProgress | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AudioItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editDialog, setEditDialog] = useState<AudioItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; item: AudioItem } | null>(null);

  const readyItems = items.filter((i) => i.status === 'ready');
  const processingItems = items.filter((i) => i.status === 'processing');

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

  const handleDelete = async () => {
    if (!deleteConfirm) return;

    setDeleting(true);
    try {
      await deleteAudioItem(deleteConfirm.id);
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
      await updateAudioItem(editDialog.id, { title: editTitle.trim() });
    } catch (error) {
      console.error('Update failed:', error);
    } finally {
      setSaving(false);
      closeEditDialog();
    }
  };

  const openEditDialog = (item: AudioItem) => {
    setEditTitle(item.title);
    setEditDialog(item);
    setMenuAnchor(null);
  };

  const closeEditDialog = () => {
    setEditDialog(null);
    setEditTitle('');
  };

  const openDeleteConfirm = (item: AudioItem) => {
    setDeleteConfirm(item);
    setMenuAnchor(null);
  };

  const handleTrackClick = (item: AudioItem) => {
    if (item.id === activeAudioId) {
      togglePlay();
    } else {
      playFromLibrary(item.id, readyItems);
    }
  };

  const handleAddToQueue = (item: AudioItem) => {
    addToQueue(item.id);
    showSnackbar('Added to queue', 'success');
    setMenuAnchor(null);
  };

  const handlePlayNext = (item: AudioItem) => {
    insertNext(item.id);
    showSnackbar('Playing next', 'success');
    setMenuAnchor(null);
  };

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
      <HeroCard>
        <HeroRow>
          <Box>
            <Typography variant="overline" sx={{ opacity: 0.8, letterSpacing: 1.2 }}>
              Your Listening Queue
            </Typography>
            <Typography variant="h5" fontWeight={700}>
              Audio Library
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9, mt: 0.5 }}>
              Upload files, then tap an audio to open player + transcript.
            </Typography>
          </Box>
          <UploadButton
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => fileInputRef.current?.click()}
          >
            Add Audio
          </UploadButton>
        </HeroRow>
        <Stack direction="row" spacing={1} sx={{ mt: 2, flexWrap: 'wrap', rowGap: 1 }}>
          <Chip
            icon={<GraphicEqRoundedIcon />}
            label={`${readyItems.length} ready`}
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.22)', color: 'inherit' }}
          />
          <Chip
            icon={<AccessTimeIcon />}
            label={`${processingItems.length} processing`}
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.22)', color: 'inherit' }}
          />
        </Stack>
      </HeroCard>

      {processingItems.length > 0 && (
        <ProcessingList>
          <SectionHeader>
            <Typography variant="subtitle2" fontWeight={700}>
              Processing Queue
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Transcribing
            </Typography>
          </SectionHeader>
          {processingItems.map((item) => (
            <ProcessingRow key={item.id}>
              <CircularProgress size={20} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {item.title || item.fileName}
                </Typography>
                <MetaText noWrap>{item.fileName}</MetaText>
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
          <Typography variant="caption" color="text.secondary">
            {readyItems.length} audios
          </Typography>
        </SectionHeader>

        {readyItems.map((item) => {
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

        {readyItems.length === 0 && processingItems.length === 0 && (
          <EmptyState>
            <HeadphonesIcon sx={{ fontSize: 48, mb: 1.5, opacity: 0.35 }} />
            <Typography variant="subtitle1" gutterBottom fontWeight={700}>
              No audios yet
            </Typography>
            <Typography variant="body2">
              Upload a Polish audio file to build your audio library and transcript queue.
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
        <MenuItem onClick={() => menuAnchor && openEditDialog(menuAnchor.item)}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Rename</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => menuAnchor && openDeleteConfirm(menuAnchor.item)}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>Delete</ListItemText>
        </MenuItem>
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
            Are you sure you want to delete &quot;{deleteConfirm?.title}&quot;? This will remove the
            audio file and its transcript.
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

      {showMiniPlayer && <MiniPlayerBar />}
    </PageContainer>
  );
}
