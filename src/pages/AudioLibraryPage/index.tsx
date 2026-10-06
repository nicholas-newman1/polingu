import { useState, useRef, useMemo } from 'react';
import { Box, Typography, Card, IconButton, CircularProgress } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import HeadphonesIcon from '@mui/icons-material/Headphones';
import { styled } from '../../lib/styled';
import { uploadAudio } from '../../lib/audio';
import { useAudioPlayerContext } from '../../contexts/AudioPlayerContext';
import { useAuthContext } from '../../hooks/useAuthContext';
import type { AudioUploadProgress } from '../../types/audio';
import { MiniPlayerBar, MINI_PLAYER_HEIGHT } from '../../components/MiniPlayerBar';
import { UploadProgressOverlay } from '../../components/UploadProgressOverlay';
import { tagSystemItems, tagUserItems, type MergedItem } from './types';
import { ErrorTrackRow, ProcessingSection, ReadyTrackRow, SectionHeader } from './AudioRows';
import { CreateAudioDialog, DeleteAudioDialog, RenameAudioDialog } from './AudioDialogs';
import { AddAudioMenu, ItemActionsMenu } from './AudioMenus';

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

const EmptyState = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(5, 2),
  color: theme.palette.text.secondary,
}));

export function AudioLibraryPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    items,
    systemItems,
    libraryLoading,
    activeAudioId,
    audioItem: activeItem,
    togglePlay,
    playFromLibrary,
  } = useAudioPlayerContext();
  const { isAdmin } = useAuthContext();
  const [uploadProgress, setUploadProgress] = useState<AudioUploadProgress | null>(null);
  const [menuAnchor, setMenuAnchor] = useState<{ el: HTMLElement; item: MergedItem } | null>(null);
  const [renaming, setRenaming] = useState<MergedItem | null>(null);
  const [deleting, setDeleting] = useState<MergedItem | null>(null);
  const [addMenuAnchor, setAddMenuAnchor] = useState<HTMLElement | null>(null);
  const [createMode, setCreateMode] = useState<'system' | 'user'>('user');
  const [createDialogKey, setCreateDialogKey] = useState<number | null>(null);

  const { readyItems, processingItems, errorItems } = useMemo(() => {
    const byStatus = (status: MergedItem['status']) => (i: { status: string }) =>
      i.status === status;
    return {
      readyItems: [
        ...tagSystemItems(systemItems.filter(byStatus('ready'))),
        ...tagUserItems(items.filter(byStatus('ready'))),
      ].sort((a, b) => b.createdAt - a.createdAt),
      processingItems: [
        ...tagUserItems(items.filter(byStatus('processing'))),
        ...tagSystemItems(systemItems.filter(byStatus('processing'))),
      ],
      errorItems: [
        ...tagUserItems(items.filter(byStatus('error'))),
        ...(isAdmin ? tagSystemItems(systemItems.filter(byStatus('error'))) : []),
      ],
    };
  }, [items, systemItems, isAdmin]);

  const handleTrackClick = (item: MergedItem) => {
    if (item.id === activeAudioId) {
      togglePlay();
    } else {
      playFromLibrary(item.id, readyItems);
    }
  };

  const openMenu = (el: HTMLElement, item: MergedItem) => setMenuAnchor({ el, item });

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

  const openCreateDialog = (mode: 'system' | 'user') => {
    setCreateMode(mode);
    setCreateDialogKey(Date.now());
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
      {processingItems.length > 0 && <ProcessingSection items={processingItems} />}

      <PlaylistCard>
        <SectionHeader>
          <Typography variant="subtitle1" fontWeight={700}>
            Audios
          </Typography>
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="caption" color="text.secondary">
              {readyItems.length} audios
            </Typography>
            <IconButton size="small" onClick={(e) => setAddMenuAnchor(e.currentTarget)}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
        </SectionHeader>

        {readyItems.map((item) => (
          <ReadyTrackRow
            key={item.id}
            item={item}
            isActive={item.id === activeAudioId}
            onClick={() => handleTrackClick(item)}
            onOpenMenu={openMenu}
          />
        ))}

        {errorItems.map((item) => (
          <ErrorTrackRow key={item.id} item={item} onOpenMenu={openMenu} />
        ))}

        {readyItems.length === 0 && processingItems.length === 0 && (
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
        <UploadProgressOverlay progress={uploadProgress} processingLabel="Transcribing audio..." />
      )}

      <AddAudioMenu
        anchor={addMenuAnchor}
        isAdmin={isAdmin}
        onClose={() => setAddMenuAnchor(null)}
        onUpload={() => fileInputRef.current?.click()}
        onCreate={openCreateDialog}
      />

      <ItemActionsMenu
        anchor={menuAnchor}
        canManage={menuAnchor?.item.source === 'user' || isAdmin}
        onClose={() => setMenuAnchor(null)}
        onRename={setRenaming}
        onDelete={setDeleting}
      />

      <RenameAudioDialog key={renaming?.id} item={renaming} onClose={() => setRenaming(null)} />
      <DeleteAudioDialog item={deleting} onClose={() => setDeleting(null)} />
      <CreateAudioDialog
        key={createDialogKey ?? undefined}
        mode={createMode}
        open={createDialogKey !== null}
        onClose={() => setCreateDialogKey(null)}
      />

      {showMiniPlayer && <MiniPlayerBar />}
    </PageContainer>
  );
}
