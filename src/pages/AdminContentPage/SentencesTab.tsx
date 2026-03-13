import { useState, useMemo, useCallback, useRef, memo } from 'react';
import { TextField, Box, Typography, Chip, Stack, IconButton } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import StopIcon from '@mui/icons-material/Stop';
import DeleteIcon from '@mui/icons-material/Delete';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useSentences } from '../../hooks/useReviewData';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { updateSentence, deleteSentence } from '../../lib/storage/systemSentences';
import { EditSentenceModal } from '../../components/EditSentenceModal';
import type { Sentence } from '../../types/sentences';

export const SentencesTab = memo(function SentencesTab() {
  const { systemSentences, setSystemSentences } = useSentences();
  const { showSnackbar } = useSnackbar();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [editingSentence, setEditingSentence] = useState<Sentence | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return systemSentences;
    const s = debouncedSearch.toLowerCase();
    return systemSentences.filter(
      (sent) => sent.polish.toLowerCase().includes(s) || sent.english.toLowerCase().includes(s)
    );
  }, [systemSentences, debouncedSearch]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 96,
    overscan: 10,
    measureElement: (element) => element.getBoundingClientRect().height,
  });

  const handlePlayAudio = useCallback(
    (e: React.MouseEvent, url: string, id: string) => {
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
    async (e: React.MouseEvent, sentence: Sentence) => {
      e.stopPropagation();
      if (!window.confirm('Delete this sentence?')) return;
      try {
        await deleteSentence(sentence.id);
        setSystemSentences(systemSentences.filter((s) => s.id !== sentence.id));
        showSnackbar('Sentence deleted', 'success');
      } catch {
        showSnackbar('Failed to delete sentence', 'error');
      }
    },
    [systemSentences, setSystemSentences, showSnackbar]
  );

  const handleSave = useCallback(
    async (data: Omit<Sentence, 'id'>) => {
      if (!editingSentence) return;
      try {
        await updateSentence(editingSentence.id, data);
        setSystemSentences(
          systemSentences.map((s) => (s.id === editingSentence.id ? { ...s, ...data } : s))
        );
        showSnackbar('Sentence updated', 'success');
      } catch {
        showSnackbar('Failed to update sentence', 'error');
      }
    },
    [editingSentence, systemSentences, setSystemSentences, showSnackbar]
  );

  const handleAudioUpdated = useCallback(
    async (audioUrl: string) => {
      if (!editingSentence) return;
      try {
        await updateSentence(editingSentence.id, { audioUrl });
        setSystemSentences(
          systemSentences.map((s) => (s.id === editingSentence.id ? { ...s, audioUrl } : s))
        );
      } catch {
        showSnackbar('Failed to update audio', 'error');
      }
    },
    [editingSentence, systemSentences, setSystemSentences, showSnackbar]
  );

  return (
    <Stack spacing={2}>
      <TextField
        size="small"
        placeholder="Search sentences..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
      />

      <Typography variant="body2" color="text.secondary">
        Showing {filtered.length} of {systemSentences.length} sentences
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
            const sentence = filtered[virtualRow.index];
            return (
              <Box
                key={sentence.id}
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
                  onClick={() => setEditingSentence(sentence)}
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
                    <Typography variant="body2" fontWeight={500}>
                      {sentence.polish}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {sentence.english}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      <Chip
                        label={sentence.level}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                      {sentence.tags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" />
                      ))}
                    </Box>
                  </Box>
                  {sentence.audioUrl && (
                    <IconButton
                      size="small"
                      onClick={(e) => handlePlayAudio(e, sentence.audioUrl!, sentence.id)}
                      color={playingId === sentence.id ? 'error' : 'default'}
                    >
                      {playingId === sentence.id ? (
                        <StopIcon fontSize="small" />
                      ) : (
                        <VolumeUpIcon fontSize="small" />
                      )}
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    onClick={(e) => handleDelete(e, sentence)}
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
            No sentences match your search
          </Typography>
        )}
      </Box>

      <EditSentenceModal
        open={!!editingSentence}
        onClose={() => setEditingSentence(null)}
        onSave={handleSave}
        sentence={editingSentence}
        onAudioUpdated={handleAudioUpdated}
      />
    </Stack>
  );
});
