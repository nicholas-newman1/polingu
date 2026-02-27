import { useState, useEffect, useRef, useCallback } from 'react';
import { Box, Tooltip } from '@mui/material';
import { styled } from '../../../lib/styled';
import { DRAWER_WIDTH } from '../../../components/Layout';

const BOTTOM_MENU_HEIGHT = 70;
const PROGRESS_BAR_HEIGHT = 24;

const ProgressBarContainer = styled(Box)(({ theme }) => ({
  position: 'fixed',
  bottom: BOTTOM_MENU_HEIGHT,
  left: 0,
  right: 0,
  height: PROGRESS_BAR_HEIGHT,
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1.5),
  backgroundColor: theme.palette.background.paper,
  borderTop: `1px solid ${theme.palette.divider}`,
  borderBottom: `1px solid ${theme.palette.divider}`,
  cursor: 'pointer',
  zIndex: 10,
  userSelect: 'none',
  touchAction: 'none',
  [theme.breakpoints.up('md')]: {
    left: DRAWER_WIDTH,
  },
}));

const ProgressTrack = styled(Box)(({ theme }) => ({
  flex: 1,
  height: 6,
  backgroundColor: theme.palette.grey[200],
  borderRadius: 3,
  position: 'relative',
}));

const ProgressFill = styled(Box)<{ $isDragging?: boolean }>(({ theme, $isDragging }) => ({
  position: 'absolute',
  left: 0,
  top: 0,
  height: '100%',
  backgroundColor: theme.palette.primary.main,
  borderRadius: 3,
  transition: $isDragging ? 'none' : 'width 0.2s ease',
}));

const ProgressHandle = styled(Box)<{ $isDragging?: boolean }>(({ theme, $isDragging }) => ({
  position: 'absolute',
  top: '50%',
  width: 16,
  height: 16,
  borderRadius: '50%',
  backgroundColor: theme.palette.primary.main,
  border: `2px solid ${theme.palette.background.paper}`,
  boxShadow: theme.shadows[2],
  transform: 'translate(-50%, -50%)',
  transition: $isDragging ? 'none' : 'left 0.2s ease',
  cursor: 'grab',
  '&:active': {
    cursor: 'grabbing',
  },
}));

const PageTooltip = styled(Box)(({ theme }) => ({
  position: 'absolute',
  bottom: '100%',
  left: '50%',
  transform: 'translateX(-50%)',
  marginBottom: 8,
  padding: theme.spacing(0.5, 1),
  backgroundColor: theme.palette.grey[800],
  color: theme.palette.common.white,
  borderRadius: theme.shape.borderRadius,
  fontSize: '0.75rem',
  fontWeight: 500,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
}));

const BookmarkMarker = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: '50%',
  width: 4,
  height: 14,
  backgroundColor: theme.palette.warning.main,
  borderRadius: 2,
  transform: 'translate(-50%, -50%)',
  cursor: 'pointer',
  zIndex: 1,
  '&:hover': {
    backgroundColor: theme.palette.warning.dark,
    transform: 'translate(-50%, -50%) scale(1.2)',
  },
}));

interface PageProgressBarProps {
  currentPage: number;
  totalPages: number;
  bookmarks?: number[];
  onPageChange: (page: number) => void;
}

export function PageProgressBar({
  currentPage,
  totalPages,
  bookmarks = [],
  onPageChange,
}: PageProgressBarProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [dragPage, setDragPage] = useState<number | null>(null);
  const progressTrackRef = useRef<HTMLDivElement>(null);

  const getPageFromPosition = useCallback(
    (clientX: number) => {
      if (!progressTrackRef.current) return currentPage;
      const rect = progressTrackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const percentage = Math.max(0, Math.min(1, x / rect.width));
      return Math.max(1, Math.min(totalPages, Math.round(percentage * totalPages) || 1));
    },
    [totalPages, currentPage]
  );

  const handleProgressMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDragging(true);
      const page = getPageFromPosition(e.clientX);
      setDragPage(page);
    },
    [getPageFromPosition]
  );

  const handleProgressTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setIsDragging(true);
      const page = getPageFromPosition(e.touches[0].clientX);
      setDragPage(page);
    },
    [getPageFromPosition]
  );

  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (clientX: number) => {
      const page = getPageFromPosition(clientX);
      setDragPage(page);
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => handleMove(e.touches[0].clientX);

    const handleEnd = () => {
      if (dragPage !== null) {
        onPageChange(dragPage);
      }
      setIsDragging(false);
      setDragPage(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging, dragPage, getPageFromPosition, onPageChange]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isDragging) return;
      const page = getPageFromPosition(e.clientX);
      onPageChange(page);
    },
    [isDragging, getPageFromPosition, onPageChange]
  );

  const displayPage = isDragging && dragPage ? dragPage : currentPage;
  const percentage = (displayPage / totalPages) * 100;

  const handleBookmarkClick = useCallback(
    (e: React.MouseEvent, page: number) => {
      e.stopPropagation();
      onPageChange(page);
    },
    [onPageChange]
  );

  return (
    <ProgressBarContainer
      onClick={handleProgressClick}
      onMouseDown={handleProgressMouseDown}
      onTouchStart={handleProgressTouchStart}
    >
      <ProgressTrack ref={progressTrackRef}>
        <ProgressFill $isDragging={isDragging} sx={{ width: `${percentage}%` }} />
        {bookmarks.map((page) => (
          <Tooltip key={page} title={`Page ${page}`} arrow placement="top">
            <BookmarkMarker
              sx={{ left: `${(page / totalPages) * 100}%` }}
              onClick={(e) => handleBookmarkClick(e, page)}
              onMouseDown={(e) => e.stopPropagation()}
            />
          </Tooltip>
        ))}
        <ProgressHandle $isDragging={isDragging} sx={{ left: `${percentage}%` }}>
          {isDragging && dragPage && <PageTooltip>Page {dragPage}</PageTooltip>}
        </ProgressHandle>
      </ProgressTrack>
    </ProgressBarContainer>
  );
}
