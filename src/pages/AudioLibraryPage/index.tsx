import { useState, useEffect, useRef } from 'react';
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
import HeadphonesIcon from '@mui/icons-material/Headphones';
import { styled } from '../../lib/styled';
import {
  uploadAudio,
  getAudioItems,
  subscribeToAudioItemsUpdates,
  deleteAudioItem,
  updateAudioItem,
} from '../../lib/audio';
import type { AudioItem, AudioUploadProgress } from '../../types/audio';

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

const ItemsGrid = styled(Box)(({ theme }) => ({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
  gap: theme.spacing(2),
  [theme.breakpoints.up('sm')]: {
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
  },
}));

const AudioCard = styled(Card)({
  position: 'relative',
});

const AudioCover = styled(Box)(({ theme }) => ({
  height: 180,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1),
  background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
  color: '#fff',
  [theme.breakpoints.up('sm')]: {
    height: 220,
  },
}));

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

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioLibraryPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<AudioItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<AudioUploadProgress | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<AudioItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editDialog, setEditDialog] = useState<AudioItem | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [saving, setSaving] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; item: AudioItem } | null>(null);

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const data = await getAudioItems();
        setItems(data);
      } catch (error) {
        console.error('Failed to load audio items:', error);
      } finally {
        setLoading(false);
      }
    };

    loadInitialData();

    const unsubscribe = subscribeToAudioItemsUpdates((updatedItems) => {
      setItems(updatedItems);
    });

    return unsubscribe;
  }, []);

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

  const processingItems = items.filter((i) => i.status === 'processing');
  const readyItems = items.filter((i) => i.status === 'ready');

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
          Audio
        </Typography>
      </Header>

      <ItemsGrid>
        <UploadCard onClick={() => fileInputRef.current?.click()}>
          <UploadContent>
            <AddIcon sx={{ fontSize: 40 }} />
            <Typography variant="body2">Upload Audio</Typography>
            <Typography variant="caption" color="text.disabled">
              MP3, WAV, OGG, FLAC, M4A
            </Typography>
          </UploadContent>
        </UploadCard>

        {processingItems.map((item) => (
          <AudioCard key={item.id}>
            <AudioCover>
              <CircularProgress size={32} sx={{ color: 'inherit' }} />
            </AudioCover>
            <CardContent sx={{ py: 1.5 }}>
              <Typography variant="body2" noWrap>
                Transcribing...
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {item.fileName}
              </Typography>
            </CardContent>
          </AudioCard>
        ))}

        {readyItems.map((item) => (
          <AudioCard key={item.id}>
            <MenuButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setMenuAnchor({ el: e.currentTarget, item });
              }}
            >
              <MoreVertIcon fontSize="small" />
            </MenuButton>
            <CardActionArea onClick={() => navigate(`/audio/${item.id}`)}>
              <AudioCover>
                <HeadphonesIcon sx={{ fontSize: 48 }} />
                <Typography variant="caption" sx={{ opacity: 0.8 }}>
                  {formatDuration(item.duration)}
                </Typography>
              </AudioCover>
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
                  {item.title}
                </Typography>
              </CardContent>
            </CardActionArea>
          </AudioCard>
        ))}
      </ItemsGrid>

      {items.length === 0 && (
        <EmptyState>
          <HeadphonesIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
          <Typography variant="h6" gutterBottom>
            No audio yet
          </Typography>
          <Typography variant="body2">
            Upload a Polish audio file to get an auto-generated transcript
          </Typography>
        </EmptyState>
      )}

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
            Are you sure you want to delete &quot;{deleteConfirm?.title}&quot;? This will remove
            the audio file and its transcript.
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
