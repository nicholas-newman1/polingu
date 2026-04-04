import { useMemo } from 'react';
import { Box, Drawer, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DragHandleIcon from '@mui/icons-material/DragHandle';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import GraphicEqRoundedIcon from '@mui/icons-material/GraphicEqRounded';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { styled } from '../lib/styled';
import { useAudioPlayerContext } from '../contexts/AudioPlayerContext';
import type { AudioItem, SystemAudioItem } from '../types/audio';

type AnyAudioItem = AudioItem | SystemAudioItem;
import type { QueueSection } from '../hooks/useQueueManager';

const DrawerContent = styled(Box)({
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
});

const DrawerHeader = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: theme.spacing(2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  flexShrink: 0,
}));

const NowPlayingRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1.5),
  padding: theme.spacing(1.5, 2),
  backgroundColor: theme.palette.action.selected,
  borderBottom: `1px solid ${theme.palette.divider}`,
  flexShrink: 0,
}));

const QueueList = styled(Box)({
  flex: 1,
  overflowY: 'auto',
  minHeight: 0,
});

const TrackRow = styled(Box)(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(1),
  padding: theme.spacing(1, 2),
  borderBottom: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  '&:last-child': {
    borderBottom: 0,
  },
}));

const TrackIconWrap = styled(Box)(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: 999,
  backgroundColor: theme.palette.primary.main,
  color: theme.palette.primary.contrastText,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
}));

const SectionLabel = styled(Typography)(({ theme }) => ({
  padding: theme.spacing(1.5, 2, 0.5),
  letterSpacing: 1,
  flexShrink: 0,
}));

const EmptyQueue = styled(Box)(({ theme }) => ({
  textAlign: 'center',
  padding: theme.spacing(4, 2),
  color: theme.palette.text.secondary,
}));

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface SortableTrackRowProps {
  id: string;
  item: AnyAudioItem | null;
  section: QueueSection;
  sectionIndex: number;
  onRemove: (section: QueueSection, index: number) => void;
  onSkipTo: (section: QueueSection, index: number) => void;
}

function SortableTrackRow({
  id,
  item,
  section,
  sectionIndex,
  onRemove,
  onSkipTo,
}: SortableTrackRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : undefined,
    position: 'relative' as const,
  };

  if (!item) return null;

  return (
    <TrackRow ref={setNodeRef} style={style}>
      <IconButton
        size="small"
        sx={{ cursor: 'grab', touchAction: 'none', color: 'text.disabled' }}
        {...attributes}
        {...listeners}
      >
        <DragHandleIcon fontSize="small" />
      </IconButton>
      <Box
        sx={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
        onClick={() => onSkipTo(section, sectionIndex)}
      >
        <Typography variant="body2" fontWeight={600} noWrap>
          {item.title}
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {formatDuration(item.duration)}
        </Typography>
      </Box>
      <IconButton
        size="small"
        onClick={() => onRemove(section, sectionIndex)}
        sx={{ color: 'text.secondary' }}
      >
        <RemoveCircleOutlineIcon fontSize="small" />
      </IconButton>
    </TrackRow>
  );
}

interface SectionProps {
  section: QueueSection;
  trackIds: string[];
  itemMap: Map<string, AnyAudioItem>;
  onRemove: (section: QueueSection, index: number) => void;
  onReorder: (section: QueueSection, fromIndex: number, toIndex: number) => void;
  onSkipTo: (section: QueueSection, index: number) => void;
}

function SortableSection({
  section,
  trackIds,
  itemMap,
  onRemove,
  onReorder,
  onSkipTo,
}: SectionProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } })
  );

  const sortIds = useMemo(
    () => trackIds.map((id, i) => `${section}-${i}-${id}`),
    [trackIds, section]
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = sortIds.indexOf(active.id as string);
    const newIndex = sortIds.indexOf(over.id as string);
    if (oldIndex === -1 || newIndex === -1) return;

    onReorder(section, oldIndex, newIndex);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={sortIds} strategy={verticalListSortingStrategy}>
        {trackIds.map((trackId, i) => (
          <SortableTrackRow
            key={sortIds[i]}
            id={sortIds[i]}
            item={itemMap.get(trackId) ?? null}
            section={section}
            sectionIndex={i}
            onRemove={onRemove}
            onSkipTo={onSkipTo}
          />
        ))}
      </SortableContext>
    </DndContext>
  );
}

interface QueueDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function QueueDrawer({ open, onClose }: QueueDrawerProps) {
  const {
    userQueue,
    autoQueue,
    items,
    systemItems,
    audioItem: nowPlayingItem,
    isPlaying,
    togglePlay,
    removeFromQueue,
    reorderQueue,
    skipToQueueItem,
  } = useAudioPlayerContext();

  const itemMap = useMemo(() => {
    const map = new Map<string, AnyAudioItem>();
    for (const item of items) map.set(item.id, item);
    for (const item of systemItems) map.set(item.id, item);
    return map;
  }, [items, systemItems]);

  const handleSkipTo = (section: QueueSection, index: number) => {
    const trackId = skipToQueueItem(section, index);
    if (trackId) onClose();
  };

  const hasAnything = !!nowPlayingItem || userQueue.length > 0 || autoQueue.length > 0;

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      slotProps={{
        paper: {
          sx: {
            height: '100%',
            maxHeight: '100%',
          },
        },
      }}
    >
      <DrawerContent>
        <DrawerHeader>
          <Typography variant="subtitle1" fontWeight={700}>
            Queue
          </Typography>
          <IconButton size="small" onClick={onClose}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DrawerHeader>

        {nowPlayingItem && (
          <>
            <SectionLabel variant="overline" color="text.secondary">
              Now Playing
            </SectionLabel>
            <NowPlayingRow>
              <TrackIconWrap sx={{ width: 40, height: 40 }}>
                {isPlaying ? (
                  <GraphicEqRoundedIcon sx={{ fontSize: 20 }} />
                ) : (
                  <PlayArrowIcon sx={{ fontSize: 20 }} />
                )}
              </TrackIconWrap>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontWeight={700} noWrap>
                  {nowPlayingItem.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatDuration(nowPlayingItem.duration)}
                </Typography>
              </Box>
              <IconButton size="small" onClick={togglePlay} sx={{ color: 'text.primary' }}>
                {isPlaying ? <PauseIcon /> : <PlayArrowIcon />}
              </IconButton>
            </NowPlayingRow>
          </>
        )}

        <QueueList>
          {userQueue.length > 0 && (
            <>
              <SectionLabel variant="overline" color="text.secondary">
                Next in Queue &middot; {userQueue.length}
              </SectionLabel>
              <SortableSection
                section="user"
                trackIds={userQueue}
                itemMap={itemMap}
                onRemove={removeFromQueue}
                onReorder={reorderQueue}
                onSkipTo={handleSkipTo}
              />
            </>
          )}

          {autoQueue.length > 0 && (
            <>
              <SectionLabel variant="overline" color="text.secondary">
                Next Up &middot; {autoQueue.length}
              </SectionLabel>
              <SortableSection
                section="auto"
                trackIds={autoQueue}
                itemMap={itemMap}
                onRemove={removeFromQueue}
                onReorder={reorderQueue}
                onSkipTo={handleSkipTo}
              />
            </>
          )}

          {!hasAnything && (
            <EmptyQueue>
              <Typography variant="body2">No tracks in queue</Typography>
            </EmptyQueue>
          )}

          {hasAnything && userQueue.length === 0 && autoQueue.length === 0 && (
            <EmptyQueue>
              <Typography variant="body2">No upcoming tracks</Typography>
            </EmptyQueue>
          )}
        </QueueList>
      </DrawerContent>
    </Drawer>
  );
}
