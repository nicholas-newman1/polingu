import { useState, useMemo, useCallback, useRef, memo } from 'react';
import { TextField, Box, Typography, Chip, Stack, IconButton } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import StopIcon from '@mui/icons-material/Stop';
import DeleteIcon from '@mui/icons-material/Delete';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDeclension } from '../../hooks/useReviewData';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { updateDeclensionCard, deleteDeclensionCard } from '../../lib/storage/systemDeclension';
import { EditDeclensionModal } from '../../components/EditDeclensionModal';
import type { DeclensionCard, DeclensionCardId } from '../../types';

export const DeclensionsTab = memo(function DeclensionsTab() {
  const { systemDeclensionCards, setSystemDeclensionCards } = useDeclension();
  const { showSnackbar } = useSnackbar();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [editingCard, setEditingCard] = useState<DeclensionCard | null>(null);
  const [playingId, setPlayingId] = useState<DeclensionCardId | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return systemDeclensionCards;
    const s = debouncedSearch.toLowerCase();
    return systemDeclensionCards.filter(
      (c) =>
        c.front.toLowerCase().includes(s) ||
        c.back.toLowerCase().includes(s) ||
        c.declined.toLowerCase().includes(s)
    );
  }, [systemDeclensionCards, debouncedSearch]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 10,
    measureElement: (element) => element.getBoundingClientRect().height,
  });

  const handlePlayAudio = useCallback(
    (e: React.MouseEvent, url: string, id: DeclensionCardId) => {
      e.stopPropagation();
      if (playingId === id) {
        audioRef.current?.pause();
        audioRef.current = null;
        setPlayingId(null);
        return;
      }
      if (audioRef.current) audioRef.current.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingId(id);
      const cleanup = () => {
        setPlayingId(null);
        audioRef.current = null;
      };
      audio.onended = cleanup;
      audio.onerror = cleanup;
      audio.play().catch(cleanup);
    },
    [playingId]
  );

  const handleDelete = useCallback(
    async (e: React.MouseEvent, card: DeclensionCard) => {
      e.stopPropagation();
      if (!window.confirm(`Delete card "${card.declined}"?`)) return;
      try {
        await deleteDeclensionCard(card.id as number);
        setSystemDeclensionCards(systemDeclensionCards.filter((c) => c.id !== card.id));
        showSnackbar('Card deleted', 'success');
      } catch {
        showSnackbar('Failed to delete card', 'error');
      }
    },
    [systemDeclensionCards, setSystemDeclensionCards, showSnackbar]
  );

  const handleSave = useCallback(
    async (data: Omit<DeclensionCard, 'id' | 'isCustom'>) => {
      if (!editingCard) return;
      try {
        await updateDeclensionCard(editingCard.id as number, data);
        setSystemDeclensionCards(
          systemDeclensionCards.map((c) => (c.id === editingCard.id ? { ...c, ...data } : c))
        );
        showSnackbar('Card updated', 'success');
      } catch {
        showSnackbar('Failed to update card', 'error');
      }
    },
    [editingCard, systemDeclensionCards, setSystemDeclensionCards, showSnackbar]
  );

  const handleAudioUpdated = useCallback(
    async (audioUrl: string) => {
      if (!editingCard) return;
      try {
        await updateDeclensionCard(editingCard.id as number, { audioUrl });
        setSystemDeclensionCards(
          systemDeclensionCards.map((c) => (c.id === editingCard.id ? { ...c, audioUrl } : c))
        );
      } catch {
        showSnackbar('Failed to update audio', 'error');
      }
    },
    [editingCard, systemDeclensionCards, setSystemDeclensionCards, showSnackbar]
  );

  return (
    <Stack spacing={2}>
      <TextField
        size="small"
        placeholder="Search declensions..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
      />

      <Typography variant="body2" color="text.secondary">
        Showing {filtered.length} of {systemDeclensionCards.length} cards
      </Typography>

      <Box ref={parentRef} sx={{ height: 500, overflow: 'auto' }}>
        <Box
          sx={{
            height: virtualizer.getTotalSize(),
            width: '100%',
            position: 'relative',
          }}
        >
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const card = filtered[virtualRow.index];
            return (
              <Box
                key={card.id}
                data-index={virtualRow.index}
                ref={virtualizer.measureElement}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <Box
                  onClick={() => setEditingCard(card)}
                  sx={{
                    p: 1.5,
                    backgroundColor: 'action.hover',
                    borderRadius: 1,
                    display: 'flex',
                    gap: 1,
                    mb: 1,
                    alignItems: 'center',
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: 'action.selected' },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="body2" fontWeight={500} noWrap>
                      {card.declined}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {card.front}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      <Chip label={card.case} size="small" variant="outlined" />
                      <Chip label={card.gender} size="small" variant="outlined" />
                      <Chip label={card.number} size="small" variant="outlined" />
                    </Box>
                  </Box>
                  {card.audioUrl && (
                    <IconButton
                      size="small"
                      onClick={(e) => handlePlayAudio(e, card.audioUrl!, card.id)}
                      color={playingId === card.id ? 'error' : 'default'}
                    >
                      {playingId === card.id ? (
                        <StopIcon fontSize="small" />
                      ) : (
                        <VolumeUpIcon fontSize="small" />
                      )}
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    onClick={(e) => handleDelete(e, card)}
                    sx={{ color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            );
          })}
        </Box>
        {filtered.length === 0 && (
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ pt: 4 }}>
            No cards match your search
          </Typography>
        )}
      </Box>

      <EditDeclensionModal
        open={!!editingCard}
        onClose={() => setEditingCard(null)}
        onSave={handleSave}
        card={editingCard}
        onAudioUpdated={handleAudioUpdated}
      />
    </Stack>
  );
});
