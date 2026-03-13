import { useState, useMemo, useCallback, useRef, memo } from 'react';
import { TextField, Box, Typography, Chip, Stack, IconButton } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import StopIcon from '@mui/icons-material/Stop';
import DeleteIcon from '@mui/icons-material/Delete';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useVocabulary } from '../../hooks/useReviewData';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import {
  updateSystemVocabularyWord,
  deleteSystemVocabularyWord,
} from '../../lib/storage/systemVocabulary';
import { AddVocabularyModal } from '../../components/AddVocabularyModal';
import type {
  VocabularyWord,
  VocabularyWordId,
  CustomVocabularyWord,
} from '../../types/vocabulary';

export const VocabularyTab = memo(function VocabularyTab() {
  const { systemWords, setSystemWords } = useVocabulary();
  const { showSnackbar } = useSnackbar();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [editingWord, setEditingWord] = useState<VocabularyWord | null>(null);
  const [playingId, setPlayingId] = useState<VocabularyWordId | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return systemWords;
    const s = debouncedSearch.toLowerCase();
    return systemWords.filter(
      (w) => w.polish.toLowerCase().includes(s) || w.english.toLowerCase().includes(s)
    );
  }, [systemWords, debouncedSearch]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
    overscan: 10,
    measureElement: (element) => element.getBoundingClientRect().height,
  });

  const handlePlayAudio = useCallback(
    (e: React.MouseEvent, url: string, id: VocabularyWordId) => {
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
    async (e: React.MouseEvent, word: VocabularyWord) => {
      e.stopPropagation();
      if (!window.confirm(`Delete "${word.polish}"?`)) return;
      try {
        await deleteSystemVocabularyWord(word.id as number);
        setSystemWords(systemWords.filter((w) => w.id !== word.id));
        showSnackbar('Word deleted', 'success');
      } catch {
        showSnackbar('Failed to delete word', 'error');
      }
    },
    [systemWords, setSystemWords, showSnackbar]
  );

  const handleSave = useCallback(
    async (data: Omit<CustomVocabularyWord, 'id' | 'isCustom' | 'createdAt'>) => {
      if (!editingWord) return;
      try {
        await updateSystemVocabularyWord(editingWord.id as number, data);
        setSystemWords(systemWords.map((w) => (w.id === editingWord.id ? { ...w, ...data } : w)));
        showSnackbar('Word updated', 'success');
      } catch {
        showSnackbar('Failed to update word', 'error');
      }
    },
    [editingWord, systemWords, setSystemWords, showSnackbar]
  );

  const handleAudioUpdated = useCallback(
    async (audioUrl: string) => {
      if (!editingWord) return;
      try {
        await updateSystemVocabularyWord(editingWord.id as number, { audioUrl });
        setSystemWords(systemWords.map((w) => (w.id === editingWord.id ? { ...w, audioUrl } : w)));
      } catch {
        showSnackbar('Failed to update audio', 'error');
      }
    },
    [editingWord, systemWords, setSystemWords, showSnackbar]
  );

  return (
    <Stack spacing={2}>
      <TextField
        size="small"
        placeholder="Search vocabulary..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
      />

      <Typography variant="body2" color="text.secondary">
        Showing {filtered.length} of {systemWords.length} words
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
            const word = filtered[virtualRow.index];
            return (
              <Box
                key={word.id}
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
                  onClick={() => setEditingWord(word)}
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
                      {word.polish}
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        — {word.english}
                      </Typography>
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      {word.partOfSpeech && (
                        <Chip label={word.partOfSpeech} size="small" variant="outlined" />
                      )}
                      {word.gender && <Chip label={word.gender} size="small" variant="outlined" />}
                    </Box>
                  </Box>
                  {word.audioUrl && (
                    <IconButton
                      size="small"
                      onClick={(e) => handlePlayAudio(e, word.audioUrl!, word.id)}
                      color={playingId === word.id ? 'error' : 'default'}
                    >
                      {playingId === word.id ? (
                        <StopIcon fontSize="small" />
                      ) : (
                        <VolumeUpIcon fontSize="small" />
                      )}
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    onClick={(e) => handleDelete(e, word)}
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
            No words match your search
          </Typography>
        )}
      </Box>

      <AddVocabularyModal
        open={!!editingWord}
        onClose={() => setEditingWord(null)}
        onSave={handleSave}
        editWord={editingWord}
        onAudioUpdated={handleAudioUpdated}
      />
    </Stack>
  );
});
