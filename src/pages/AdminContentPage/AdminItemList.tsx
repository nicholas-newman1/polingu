import { useState, useMemo, useCallback, useRef, type ReactNode } from 'react';
import { TextField, Box, Typography, Stack, IconButton } from '@mui/material';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import StopIcon from '@mui/icons-material/Stop';
import DeleteIcon from '@mui/icons-material/Delete';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';

type ItemId = string | number;

function useAudioPreview() {
  const [playingId, setPlayingId] = useState<ItemId | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = useCallback(
    (url: string, id: ItemId) => {
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

  return { playingId, toggle };
}

const rowSx = {
  p: 1.5,
  backgroundColor: 'action.hover',
  borderRadius: 1,
  display: 'flex',
  gap: 1,
  mb: 1,
  alignItems: 'center',
  cursor: 'pointer',
  '&:hover': { backgroundColor: 'action.selected' },
};

interface AdminItemListProps<T> {
  items: T[];
  /** Plural noun used in the count and empty-state text, e.g. "sentences". */
  noun: string;
  searchPlaceholder: string;
  estimateSize: number;
  getId: (item: T) => ItemId;
  getSearchFields: (item: T) => string[];
  getAudioUrl: (item: T) => string | undefined;
  renderContent: (item: T) => ReactNode;
  onSelect: (item: T) => void;
  onDelete: (item: T) => void;
}

export function AdminItemList<T>({
  items,
  noun,
  searchPlaceholder,
  estimateSize,
  getId,
  getSearchFields,
  getAudioUrl,
  renderContent,
  onSelect,
  onDelete,
}: AdminItemListProps<T>) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 300);
  const parentRef = useRef<HTMLDivElement>(null);
  const audio = useAudioPreview();

  const filtered = useMemo(() => {
    if (!debouncedSearch.trim()) return items;
    const s = debouncedSearch.toLowerCase();
    return items.filter((item) =>
      getSearchFields(item).some((field) => field.toLowerCase().includes(s))
    );
  }, [items, debouncedSearch, getSearchFields]);

  const virtualizer = useVirtualizer({
    count: filtered.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimateSize,
    overscan: 10,
    measureElement: (element) => element.getBoundingClientRect().height,
  });

  return (
    <Stack spacing={2}>
      <TextField
        size="small"
        placeholder={searchPlaceholder}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        fullWidth
      />

      <Typography variant="body2" color="text.secondary">
        Showing {filtered.length} of {items.length} {noun}
      </Typography>

      <Box ref={parentRef} sx={{ height: 500, overflow: 'auto' }}>
        <Box sx={{ height: virtualizer.getTotalSize(), width: '100%', position: 'relative' }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const item = filtered[virtualRow.index];
            const id = getId(item);
            const audioUrl = getAudioUrl(item);
            const isPlaying = audio.playingId === id;
            return (
              <Box
                key={id}
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
                <Box onClick={() => onSelect(item)} sx={rowSx}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>{renderContent(item)}</Box>
                  {audioUrl && (
                    <IconButton
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation();
                        audio.toggle(audioUrl, id);
                      }}
                      color={isPlaying ? 'error' : 'default'}
                    >
                      {isPlaying ? (
                        <StopIcon fontSize="small" />
                      ) : (
                        <VolumeUpIcon fontSize="small" />
                      )}
                    </IconButton>
                  )}
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(item);
                    }}
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
            No {noun} match your search
          </Typography>
        )}
      </Box>
    </Stack>
  );
}
