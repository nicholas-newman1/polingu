import { useState, useMemo, useCallback, useRef, memo } from 'react';
import { TextField, Box, Typography, Chip, Stack, IconButton } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import StopIcon from '@mui/icons-material/Stop';
import DeleteIcon from '@mui/icons-material/Delete';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useConjugation } from '../../hooks/useReviewData';
import { useSnackbar } from '../../hooks/useSnackbar';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { updateVerb, deleteVerb } from '../../lib/storage/systemVerbs';
import { EditVerbModal } from '../../components/EditVerbModal';
import type { Verb } from '../../types/conjugation';

export const VerbsTab = memo(function VerbsTab() {
  const { verbs, setVerbs } = useConjugation();
  const { showSnackbar } = useSnackbar();

  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const [editingVerb, setEditingVerb] = useState<Verb | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const parentRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return verbs;
    const s = debouncedSearch.toLowerCase();
    return verbs.filter(
      (v) => v.infinitive.toLowerCase().includes(s) || v.infinitiveEn.toLowerCase().includes(s)
    );
  }, [verbs, debouncedSearch]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 72,
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
    async (e: React.MouseEvent, verb: Verb) => {
      e.stopPropagation();
      if (
        !window.confirm(
          `Delete "${verb.infinitive}" and all its conjugation forms? This affects all users.`
        )
      )
        return;
      try {
        await deleteVerb(verb.id);
        setVerbs(verbs.filter((v) => v.id !== verb.id));
        showSnackbar('Verb deleted', 'success');
      } catch {
        showSnackbar('Failed to delete verb', 'error');
      }
    },
    [verbs, setVerbs, showSnackbar]
  );

  const handleSave = useCallback(
    async (updates: Partial<Omit<Verb, 'id'>>) => {
      if (!editingVerb) return;
      try {
        await updateVerb(editingVerb.id, updates);
        setVerbs(verbs.map((v) => (v.id === editingVerb.id ? { ...v, ...updates } : v)));
        showSnackbar('Verb updated', 'success');
      } catch {
        showSnackbar('Failed to update verb', 'error');
      }
    },
    [editingVerb, verbs, setVerbs, showSnackbar]
  );

  const handleAudioUpdated = useCallback(
    async (audioUrl: string) => {
      if (!editingVerb) return;
      try {
        await updateVerb(editingVerb.id, { infinitiveAudioUrl: audioUrl });
        setVerbs(
          verbs.map((v) => (v.id === editingVerb.id ? { ...v, infinitiveAudioUrl: audioUrl } : v))
        );
      } catch {
        showSnackbar('Failed to update audio', 'error');
      }
    },
    [editingVerb, verbs, setVerbs, showSnackbar]
  );

  const handleModalDelete = useCallback(() => {
    if (!editingVerb) return;
    const verb = editingVerb;
    setEditingVerb(null);
    deleteVerb(verb.id)
      .then(() => {
        setVerbs(verbs.filter((v) => v.id !== verb.id));
        showSnackbar('Verb deleted', 'success');
      })
      .catch(() => showSnackbar('Failed to delete verb', 'error'));
  }, [editingVerb, verbs, setVerbs, showSnackbar]);

  const tenseCount = (verb: Verb) =>
    Object.keys(verb.conjugations).filter(
      (k) => verb.conjugations[k as keyof typeof verb.conjugations]
    ).length;

  return (
    <Stack spacing={2}>
      <TextField
        size="small"
        placeholder="Search verbs..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
      />

      <Typography variant="body2" color="text.secondary">
        Showing {filtered.length} of {verbs.length} verbs
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
            const verb = filtered[virtualRow.index];
            return (
              <Box
                key={verb.id}
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
                  onClick={() => setEditingVerb(verb)}
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
                      {verb.infinitive}
                      <Typography
                        component="span"
                        variant="body2"
                        color="text.secondary"
                        sx={{ ml: 1 }}
                      >
                        — {verb.infinitiveEn}
                      </Typography>
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                      <Chip label={verb.aspect} size="small" variant="outlined" />
                      <Chip label={verb.verbClass} size="small" variant="outlined" />
                      {verb.isIrregular && (
                        <Chip label="irregular" size="small" color="warning" variant="outlined" />
                      )}
                      {verb.isReflexive && <Chip label="się" size="small" variant="outlined" />}
                      <Chip
                        label={`${tenseCount(verb)} tenses`}
                        size="small"
                        color="default"
                        variant="outlined"
                      />
                    </Box>
                  </Box>
                  {verb.infinitiveAudioUrl && (
                    <IconButton
                      size="small"
                      onClick={(e) => handlePlayAudio(e, verb.infinitiveAudioUrl!, verb.id)}
                      color={playingId === verb.id ? 'error' : 'default'}
                    >
                      {playingId === verb.id ? (
                        <StopIcon fontSize="small" />
                      ) : (
                        <VolumeUpIcon fontSize="small" />
                      )}
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    onClick={(e) => handleDelete(e, verb)}
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
            No verbs match your search
          </Typography>
        )}
      </Box>

      <EditVerbModal
        open={!!editingVerb}
        onClose={() => setEditingVerb(null)}
        onSave={handleSave}
        onDelete={handleModalDelete}
        verb={editingVerb}
        onAudioUpdated={handleAudioUpdated}
      />
    </Stack>
  );
});
