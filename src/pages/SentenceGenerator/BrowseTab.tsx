import { useState, useMemo, useCallback, useRef, memo } from 'react';
import { TextField, Box, Button, Typography, Chip, Stack, IconButton } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { Timestamp } from 'firebase/firestore';
import type { CEFRLevel } from '../../types/sentences';
import { ALL_LEVELS } from '../../types/sentences';
import { deleteSentence } from '../../lib/storage/systemSentences';
import { ChipGroup } from './shared';
import { computeCoverageStats, useDebouncedValue, formatCreatedAt } from './utils';
import type { BrowseTabProps } from './types';

export const BrowseTab = memo(function BrowseTab({
  sentences,
  setSentences,
  sentenceTags,
  showSnackbar,
}: BrowseTabProps) {
  const [browseLevel, setBrowseLevel] = useState<CEFRLevel | ''>('');
  const [browseTag, setBrowseTag] = useState('');
  const [browseSearch, setBrowseSearch] = useState('');
  const [browseDateFrom, setBrowseDateFrom] = useState('');
  const [browseDateTo, setBrowseDateTo] = useState('');

  const debouncedSearch = useDebouncedValue(browseSearch, 300);
  const parentRef = useRef<HTMLDivElement>(null);

  const coverage = useMemo(() => computeCoverageStats(sentences), [sentences]);

  const levelFilteredSentences = useMemo(() => {
    if (!browseLevel) return sentences;
    return sentences.filter((s) => s.level === browseLevel);
  }, [sentences, browseLevel]);

  const browseCoverage = useMemo(
    () => computeCoverageStats(levelFilteredSentences),
    [levelFilteredSentences]
  );

  const filteredSentences = useMemo(() => {
    let result = levelFilteredSentences;
    if (browseTag) {
      result = result.filter((s) => s.tags.includes(browseTag));
    }
    if (debouncedSearch.trim()) {
      const search = debouncedSearch.toLowerCase();
      result = result.filter(
        (s) => s.polish.toLowerCase().includes(search) || s.english.toLowerCase().includes(search)
      );
    }
    if (browseDateFrom) {
      const fromTime = new Date(browseDateFrom).getTime();
      result = result.filter((s) => {
        if (!s.createdAt || typeof (s.createdAt as Timestamp).toMillis !== 'function') return false;
        return (s.createdAt as Timestamp).toMillis() >= fromTime;
      });
    }
    if (browseDateTo) {
      const toTime = new Date(browseDateTo).getTime();
      result = result.filter((s) => {
        if (!s.createdAt || typeof (s.createdAt as Timestamp).toMillis !== 'function') return false;
        return (s.createdAt as Timestamp).toMillis() <= toTime;
      });
    }
    return [...result].sort((a, b) => {
      const aTime =
        a.createdAt && typeof (a.createdAt as Timestamp).toMillis === 'function'
          ? (a.createdAt as Timestamp).toMillis()
          : 0;
      const bTime =
        b.createdAt && typeof (b.createdAt as Timestamp).toMillis === 'function'
          ? (b.createdAt as Timestamp).toMillis()
          : 0;
      return bTime - aTime;
    });
  }, [levelFilteredSentences, browseTag, debouncedSearch, browseDateFrom, browseDateTo]);

  const virtualizer = useVirtualizer({
    count: filteredSentences.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100,
    overscan: 5,
  });

  const handleDeleteSentence = useCallback(
    async (sentenceId: string) => {
      if (!window.confirm('Delete this sentence?')) return;
      try {
        await deleteSentence(sentenceId);
        setSentences(sentences.filter((s) => s.id !== sentenceId));
        showSnackbar('Sentence deleted', 'success');
      } catch (e) {
        console.error('Delete failed:', e);
        showSnackbar('Failed to delete sentence', 'error');
      }
    },
    [sentences, setSentences, showSnackbar]
  );

  const handleClearDates = useCallback(() => {
    setBrowseDateFrom('');
    setBrowseDateTo('');
  }, []);

  const allTags = useMemo(
    () => [...sentenceTags.topics, ...sentenceTags.grammar, ...sentenceTags.style],
    [sentenceTags]
  );

  return (
    <Stack spacing={3}>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
        <ChipGroup sx={{ flex: 1, minWidth: 200 }}>
          <Chip
            label="All Levels"
            size="small"
            variant={browseLevel === '' ? 'filled' : 'outlined'}
            color={browseLevel === '' ? 'primary' : 'default'}
            onClick={() => setBrowseLevel('')}
          />
          {ALL_LEVELS.map((level) => (
            <Chip
              key={level}
              label={`${level} (${coverage.byLevel[level]})`}
              size="small"
              variant={browseLevel === level ? 'filled' : 'outlined'}
              color={browseLevel === level ? 'primary' : 'default'}
              onClick={() => setBrowseLevel(level)}
            />
          ))}
        </ChipGroup>
        <TextField
          size="small"
          placeholder="Search sentences..."
          value={browseSearch}
          onChange={(e) => setBrowseSearch(e.target.value)}
          sx={{ width: 200 }}
        />
      </Stack>

      <Stack direction="row" spacing={1} alignItems="center">
        <TextField
          size="small"
          type="datetime-local"
          label="From"
          value={browseDateFrom}
          onChange={(e) => setBrowseDateFrom(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 200 }}
        />
        <TextField
          size="small"
          type="datetime-local"
          label="To"
          value={browseDateTo}
          onChange={(e) => setBrowseDateTo(e.target.value)}
          slotProps={{ inputLabel: { shrink: true } }}
          sx={{ width: 200 }}
        />
        {(browseDateFrom || browseDateTo) && (
          <Button size="small" onClick={handleClearDates}>
            Clear dates
          </Button>
        )}
      </Stack>

      <ChipGroup>
        <Chip
          label="All Tags"
          size="small"
          variant={browseTag === '' ? 'filled' : 'outlined'}
          color={browseTag === '' ? 'secondary' : 'default'}
          onClick={() => setBrowseTag('')}
        />
        {allTags.map((tag) => (
          <Chip
            key={tag}
            label={`${tag} (${browseCoverage.byTag[tag] || 0})`}
            size="small"
            variant={browseTag === tag ? 'filled' : 'outlined'}
            color={browseTag === tag ? 'secondary' : 'default'}
            onClick={() => setBrowseTag(tag)}
          />
        ))}
      </ChipGroup>

      <Typography variant="body2" color="text.secondary">
        Showing {filteredSentences.length} of {sentences.length} sentences
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
            const sentence = filteredSentences[virtualRow.index];
            const createdDate = formatCreatedAt(sentence.createdAt);
            return (
              <Box
                key={sentence.id}
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  transform: `translateY(${virtualRow.start}px)`,
                }}
              >
                <Box
                  sx={{
                    p: 1.5,
                    backgroundColor: 'action.hover',
                    borderRadius: 1,
                    display: 'flex',
                    gap: 1,
                    mb: 1,
                  }}
                >
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" fontWeight={500}>
                      {sentence.polish}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                      {sentence.english}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                      <Chip
                        label={sentence.level}
                        size="small"
                        color="primary"
                        variant="outlined"
                      />
                      {sentence.tags.map((tag) => (
                        <Chip key={tag} label={tag} size="small" variant="outlined" />
                      ))}
                      {createdDate && (
                        <Typography variant="caption" color="text.disabled" sx={{ ml: 1 }}>
                          {createdDate}
                        </Typography>
                      )}
                    </Box>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => handleDeleteSentence(sentence.id)}
                    sx={{ alignSelf: 'flex-start', color: 'error.main' }}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Box>
            );
          })}
        </Box>
        {filteredSentences.length === 0 && (
          <Typography variant="body2" color="text.secondary" textAlign="center">
            No sentences match your filters
          </Typography>
        )}
      </Box>
    </Stack>
  );
});
