import { useEffect, useRef } from 'react';
import { Skeleton } from '@mui/material';
import Check from '@mui/icons-material/Check';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';

const Badge = styled('span')<{ $complete?: boolean }>(({ theme, $complete }) => ({
  minWidth: 24,
  height: 24,
  borderRadius: 12,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: '0.75rem',
  fontWeight: 600,
  padding: '0 8px',
  backgroundColor: $complete
    ? alpha(theme.palette.success.main, 0.15)
    : alpha(theme.palette.error.main, 0.15),
  color: $complete ? theme.palette.success.main : theme.palette.error.main,
}));

interface ReviewCountBadgeProps {
  count?: number;
  loading?: boolean;
}

export function ReviewCountBadge({ count, loading }: ReviewCountBadgeProps) {
  const prevCountRef = useRef<number | undefined>(undefined);
  const badgeRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const prev = prevCountRef.current;
    prevCountRef.current = count;
    if (prev === undefined || count === undefined || count >= prev) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    badgeRef.current?.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(1.24)', offset: 0.35 },
        { transform: 'scale(0.95)', offset: 0.7 },
        { transform: 'scale(1)' },
      ],
      { duration: 340, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }
    );
  }, [count]);

  if (loading) {
    return <Skeleton variant="rounded" width={24} height={24} sx={{ borderRadius: 12 }} />;
  }

  if (count === undefined) {
    return null;
  }

  const isComplete = count === 0;

  return (
    <Badge ref={badgeRef} $complete={isComplete}>
      {isComplete ? <Check sx={{ fontSize: 16 }} /> : count}
    </Badge>
  );
}
