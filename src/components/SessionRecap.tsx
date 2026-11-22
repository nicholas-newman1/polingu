import { useEffect, useRef, type CSSProperties } from 'react';
import { Avatar, Box, Stack, Typography, useTheme } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import type { SessionReviewStats } from '../lib/reviewSession/sessionQueue';
import { useAppSettings } from '../contexts/AppSettingsContext';
import { playSessionCompleteChime, triggerSessionCompleteHaptic } from '../lib/cardFeedback';

interface ConfettiPiece {
  x: number;
  y: number;
  size: number;
  pill?: boolean;
  rot: number;
  delay: number;
  colorIndex: 0 | 1 | 2 | 3;
}

const CONFETTI_PIECES: ConfettiPiece[] = [
  { x: -78, y: -42, size: 7, pill: true, rot: -40, delay: 40, colorIndex: 0 },
  { x: -56, y: -74, size: 6, rot: -20, delay: 80, colorIndex: 1 },
  { x: -18, y: -86, size: 7, pill: true, rot: -8, delay: 60, colorIndex: 2 },
  { x: 24, y: -84, size: 6, rot: 14, delay: 90, colorIndex: 3 },
  { x: 64, y: -68, size: 7, pill: true, rot: 36, delay: 50, colorIndex: 1 },
  { x: 86, y: -32, size: 6, rot: 62, delay: 110, colorIndex: 0 },
  { x: 92, y: 12, size: 7, pill: true, rot: 95, delay: 70, colorIndex: 2 },
  { x: 74, y: 52, size: 6, rot: 130, delay: 100, colorIndex: 1 },
  { x: -86, y: 8, size: 7, pill: true, rot: -92, delay: 65, colorIndex: 3 },
  { x: -72, y: 48, size: 6, rot: -135, delay: 95, colorIndex: 0 },
  { x: -40, y: -56, size: 5, rot: -28, delay: 120, colorIndex: 2 },
  { x: 44, y: -54, size: 5, rot: 26, delay: 130, colorIndex: 0 },
  { x: 108, y: -12, size: 5, pill: true, rot: 78, delay: 140, colorIndex: 1 },
  { x: -104, y: -16, size: 5, pill: true, rot: -75, delay: 135, colorIndex: 1 },
];

const AvatarStage = styled(Box)({
  position: 'relative',
  width: 64,
  height: 64,
  margin: '0 auto',
  marginBottom: 12,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
});

const CelebrationAvatar = styled(Avatar)<{ $animate: boolean }>(({ theme, $animate }) => ({
  width: 56,
  height: 56,
  background: `linear-gradient(135deg, ${theme.palette.success.main}, ${theme.palette.success.dark})`,
  fontSize: '1.75rem',
  boxShadow: theme.shadows[3],
  ...($animate
    ? {
        animation: 'celebrationPop 520ms cubic-bezier(0.22, 1.4, 0.36, 1) forwards',
        '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
      }
    : {}),
}));

const ConfettiBit = styled('span')<{ $color: string; $size: number; $pill?: boolean }>(
  ({ $color, $size, $pill }) => ({
    position: 'absolute',
    width: $pill ? $size * 1.9 : $size,
    height: $size * 0.85,
    borderRadius: 999,
    backgroundColor: $color,
    pointerEvents: 'none',
    opacity: 0,
    animation:
      'celebrationConfetti 760ms cubic-bezier(0.16, 1, 0.3, 1) var(--confetti-delay, 0ms) forwards',
    '@media (prefers-reduced-motion: reduce)': {
      display: 'none',
    },
  })
);

const RecapBox = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5, 2),
  marginBottom: theme.spacing(2.5),
  borderRadius: Number(theme.shape.borderRadius) * 1.5,
  backgroundColor: alpha(theme.palette.background.default, 0.65),
  border: `1px solid ${alpha(theme.palette.divider, 0.3)}`,
}));

const MonoValue = styled('span')({
  fontFamily: '"JetBrains Mono", monospace',
  fontWeight: 600,
});

const RatingDot = styled('span')<{ $color: string }>(({ $color }) => ({
  width: 7,
  height: 7,
  borderRadius: '50%',
  backgroundColor: $color,
  display: 'inline-block',
  flexShrink: 0,
}));

export function CelebrationHero({ celebrate }: { celebrate: boolean }) {
  const theme = useTheme();
  const { settings } = useAppSettings();
  const playedRef = useRef(false);

  useEffect(() => {
    if (!celebrate || playedRef.current) return;
    playedRef.current = true;
    triggerSessionCompleteHaptic();
    if (settings.autoPlayAudio) {
      playSessionCompleteChime();
    }
  }, [celebrate, settings.autoPlayAudio]);

  const colors = [
    theme.palette.success.main,
    theme.palette.secondary.main,
    theme.palette.info.main,
    theme.palette.primary.main,
  ];

  return (
    <AvatarStage>
      {celebrate &&
        CONFETTI_PIECES.map((piece, index) => (
          <ConfettiBit
            key={index}
            $color={colors[piece.colorIndex]}
            $size={piece.size}
            $pill={piece.pill}
            aria-hidden="true"
            style={
              {
                '--confetti-x': `${piece.x}px`,
                '--confetti-y': `${piece.y}px`,
                '--confetti-rot': `${piece.rot}deg`,
                '--confetti-delay': `${piece.delay}ms`,
              } as CSSProperties
            }
          />
        ))}
      <CelebrationAvatar $animate={celebrate}>🎉</CelebrationAvatar>
    </AvatarStage>
  );
}

export function SessionRecap({ stats }: { stats?: SessionReviewStats }) {
  const theme = useTheme();

  if (!stats || stats.reviewed <= 0) return null;

  const recalled = stats.hard + stats.good + stats.easy;
  const recallRate = Math.round((recalled / stats.reviewed) * 100);
  const recallColor =
    recallRate >= 80
      ? theme.palette.success.main
      : recallRate >= 50
        ? theme.palette.warning.main
        : theme.palette.primary.main;

  const breakdown = [
    { label: 'Easy', count: stats.easy, color: theme.palette.success.main },
    { label: 'Good', count: stats.good, color: theme.palette.info.main },
    { label: 'Hard', count: stats.hard, color: theme.palette.warning.main },
    { label: 'Again', count: stats.again, color: theme.palette.primary.main },
  ].filter((item) => item.count > 0);

  return (
    <RecapBox>
      <Stack direction="row" justifyContent="space-between" alignItems="baseline" sx={{ mb: 1 }}>
        <Typography variant="body2" color="text.secondary">
          <MonoValue>{stats.reviewed}</MonoValue> {stats.reviewed === 1 ? 'review' : 'reviews'}
        </Typography>
        <Typography variant="body2" sx={{ color: recallColor, fontWeight: 500 }}>
          <MonoValue>{recallRate}%</MonoValue> recall
        </Typography>
      </Stack>

      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap justifyContent="center">
        {breakdown.map((item) => (
          <Stack key={item.label} direction="row" spacing={0.5} alignItems="center">
            <RatingDot $color={item.color} />
            <Typography variant="caption" color="text.secondary">
              {item.label} <MonoValue>{item.count}</MonoValue>
            </Typography>
          </Stack>
        ))}
      </Stack>
    </RecapBox>
  );
}
