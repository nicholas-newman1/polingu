import { Box, CircularProgress, IconButton, Stack, Typography } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { styled } from '../../lib/styled';
import { useAudioPlayerContext } from '../../contexts/AudioPlayerContext';
import { TrackIcon } from '../../components/audioStyles';
import { formatDuration } from '../../lib/utils/formatDuration';
import type { MergedItem } from './types';

export const SectionHeader = styled(Box)(({ theme }) => ({
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

const LARGE_ICON = { width: 40, height: 40 } as const;

function Bullet() {
  return (
    <Typography variant="caption" color="text.disabled">
      &bull;
    </Typography>
  );
}

function SystemTag({ item }: { item: MergedItem }) {
  if (item.source !== 'system') return null;
  return (
    <>
      <Bullet />
      <MetaText noWrap>System</MetaText>
    </>
  );
}

function ItemMenuButton({ onOpen }: { onOpen: (el: HTMLElement) => void }) {
  return (
    <MenuButton
      size="small"
      onClick={(e) => {
        e.stopPropagation();
        onOpen(e.currentTarget);
      }}
    >
      <MoreVertIcon fontSize="small" />
    </MenuButton>
  );
}

function formatCreatedDate(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(timestamp);
}

function processingDescription(item: MergedItem): string {
  const isGenerated = item.source === 'system' || ('fileSize' in item && item.fileSize === 0);
  if (isGenerated) return 'Generating audio & transcript...';
  return 'fileName' in item ? item.fileName : '';
}

export function ProcessingSection({ items }: { items: MergedItem[] }) {
  return (
    <ProcessingList>
      <SectionHeader>
        <Typography variant="subtitle2" fontWeight={700}>
          Processing
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Transcribing
        </Typography>
      </SectionHeader>
      {items.map((item) => (
        <ProcessingRow key={item.id}>
          <CircularProgress size={20} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" fontWeight={600} noWrap>
              {item.title || ('fileName' in item ? item.fileName : '')}
            </Typography>
            <Stack direction="row" spacing={1} alignItems="center">
              <MetaText noWrap>{processingDescription(item)}</MetaText>
              <SystemTag item={item} />
            </Stack>
          </Box>
        </ProcessingRow>
      ))}
    </ProcessingList>
  );
}

interface RowProps {
  item: MergedItem;
  onOpenMenu: (el: HTMLElement, item: MergedItem) => void;
}

function TrackStateIcon({ isActive }: { isActive: boolean }) {
  const { isPlaying, loading } = useAudioPlayerContext();
  if (isActive && loading) {
    return <CircularProgress size={20} sx={{ color: 'primary.contrastText' }} />;
  }
  return isActive && isPlaying ? <PauseIcon /> : <PlayArrowIcon />;
}

export function ReadyTrackRow({
  item,
  isActive,
  onClick,
  onOpenMenu,
}: RowProps & { isActive: boolean; onClick: () => void }) {
  return (
    <TrackRow onClick={onClick}>
      <TrackIcon sx={LARGE_ICON}>
        <TrackStateIcon isActive={isActive} />
      </TrackIcon>
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
          <Bullet />
          <MetaText noWrap>{formatCreatedDate(item.createdAt)}</MetaText>
          <SystemTag item={item} />
        </Stack>
      </Box>
      <ItemMenuButton onOpen={(el) => onOpenMenu(el, item)} />
    </TrackRow>
  );
}

export function ErrorTrackRow({ item, onOpenMenu }: RowProps) {
  return (
    <TrackRow sx={{ cursor: 'default' }}>
      <TrackIcon sx={{ ...LARGE_ICON, bgcolor: 'error.main' }}>
        <ErrorOutlineIcon />
      </TrackIcon>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="body2" fontWeight={700} noWrap>
          {item.title}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <MetaText noWrap color="error.main">
            {('error' in item && item.error) || 'Processing failed'}
          </MetaText>
          <SystemTag item={item} />
        </Stack>
      </Box>
      <ItemMenuButton onOpen={(el) => onOpenMenu(el, item)} />
    </TrackRow>
  );
}
