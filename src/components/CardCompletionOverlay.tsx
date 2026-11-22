import type { CSSProperties } from 'react';
import { Box, useTheme, type Theme } from '@mui/material';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ReplayRoundedIcon from '@mui/icons-material/ReplayRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';
import { getRatingPalette } from '../lib/ratingColors';
import type { CardCompletionOutcome } from '../hooks/useCardCompletion';

interface SparkSpec {
  x: number;
  y: number;
  size: number;
  pill?: boolean;
  rot: number;
  delay: number;
  colorIndex: number;
}

const GOOD_SPARKS: SparkSpec[] = [
  { x: -78, y: -66, size: 8, pill: true, rot: -35, delay: 0, colorIndex: 0 },
  { x: 20, y: -92, size: 7, rot: 12, delay: 10, colorIndex: 2 },
  { x: 88, y: -58, size: 8, pill: true, rot: 40, delay: 5, colorIndex: 1 },
  { x: 104, y: 8, size: 6, rot: 80, delay: 15, colorIndex: 0 },
  { x: 76, y: 70, size: 8, pill: true, rot: 130, delay: 10, colorIndex: 2 },
  { x: -14, y: 88, size: 6, rot: 170, delay: 15, colorIndex: 1 },
  { x: -86, y: 56, size: 7, pill: true, rot: -135, delay: 5, colorIndex: 0 },
  { x: -98, y: -10, size: 6, rot: -85, delay: 15, colorIndex: 2 },
  { x: 52, y: -88, size: 5, rot: 25, delay: 20, colorIndex: 1 },
  { x: -52, y: -84, size: 5, rot: -20, delay: 15, colorIndex: 1 },
];

const EASY_SPARKS: SparkSpec[] = [
  ...GOOD_SPARKS.map((s) => ({ ...s, x: Math.round(s.x * 1.18), y: Math.round(s.y * 1.18) })),
  { x: 112, y: -38, size: 7, pill: true, rot: 55, delay: 10, colorIndex: 2 },
  { x: -110, y: 28, size: 7, pill: true, rot: -115, delay: 10, colorIndex: 2 },
];

const HARD_SPARKS: SparkSpec[] = [
  { x: -64, y: -54, size: 6, pill: true, rot: -35, delay: 0, colorIndex: 0 },
  { x: 68, y: -52, size: 6, pill: true, rot: 35, delay: 10, colorIndex: 1 },
  { x: 78, y: 32, size: 5, rot: 110, delay: 15, colorIndex: 2 },
  { x: -70, y: 36, size: 5, rot: -120, delay: 10, colorIndex: 1 },
  { x: 10, y: -74, size: 5, rot: 5, delay: 10, colorIndex: 2 },
  { x: -8, y: 70, size: 5, rot: 175, delay: 15, colorIndex: 0 },
];

const SPARKS_BY_OUTCOME: Record<CardCompletionOutcome, SparkSpec[]> = {
  good: GOOD_SPARKS,
  easy: EASY_SPARKS,
  hard: HARD_SPARKS,
  again: [],
  next: [],
};

function getOutcomeColors(theme: Theme, outcome: CardCompletionOutcome): [string, string, string] {
  if (outcome === 'next') {
    return [theme.palette.text.primary, theme.palette.text.secondary, theme.palette.secondary.main];
  }

  const palette = getRatingPalette(theme, outcome);
  return [
    palette.main,
    palette.light,
    outcome === 'again' ? palette.dark : theme.palette.secondary.main,
  ];
}

const OverlayRoot = styled(Box)({
  position: 'absolute',
  inset: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  pointerEvents: 'none',
  zIndex: 3,
});

const RingPulse = styled(Box)<{ $color: string }>(({ $color }) => ({
  position: 'absolute',
  width: 68,
  height: 68,
  borderRadius: '50%',
  border: `2px solid ${$color}`,
  boxShadow: `0 0 24px ${alpha($color, 0.35)}`,
  animation: 'completionRingPulse 420ms cubic-bezier(0.16, 1, 0.3, 1) forwards',
}));

const BadgeSeal = styled(Box)<{ $color: string; $accent: string; $ringColor?: string }>(
  ({ theme, $color, $accent, $ringColor }) => ({
    position: 'relative',
    width: 58,
    height: 58,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: `linear-gradient(135deg, ${$color}, ${$accent})`,
    color: theme.palette.common.white,
    boxShadow: $ringColor
      ? `0 0 0 2.5px ${alpha($ringColor, 0.85)}, 0 8px 24px ${alpha($color, 0.45)}`
      : `0 8px 24px ${alpha($color, 0.45)}`,
    animation: 'completionBadgePop 420ms cubic-bezier(0.22, 1, 0.36, 1) forwards',
    '& .MuiSvgIcon-root': {
      fontSize: 30,
    },
  })
);

const Spark = styled('span')<{ $color: string; $size: number; $pill?: boolean }>(
  ({ $color, $size, $pill }) => ({
    position: 'absolute',
    width: $pill ? $size * 1.8 : $size,
    height: $size * 0.85,
    borderRadius: 999,
    backgroundColor: $color,
    boxShadow: `0 0 8px ${alpha($color, 0.55)}`,
    animation:
      'completionSpark 410ms cubic-bezier(0.16, 1, 0.3, 1) var(--spark-delay, 0ms) forwards',
  })
);

function OutcomeIcon({ outcome }: { outcome: CardCompletionOutcome }) {
  switch (outcome) {
    case 'easy':
      return <AutoAwesomeRoundedIcon />;
    case 'again':
      return <ReplayRoundedIcon />;
    case 'next':
      return <ArrowForwardRoundedIcon />;
    case 'good':
    case 'hard':
      return <CheckRoundedIcon />;
  }
}

interface CardCompletionOverlayProps {
  outcome: CardCompletionOutcome | null;
}

export function CardCompletionOverlay({ outcome }: CardCompletionOverlayProps) {
  const theme = useTheme();

  if (!outcome) return null;

  const colors = getOutcomeColors(theme, outcome);
  const sparks = SPARKS_BY_OUTCOME[outcome];
  const primaryColor = colors[0];
  const sealAccent = colors[1];
  const sealRing = outcome === 'easy' ? colors[2] : undefined;

  return (
    <OverlayRoot aria-hidden="true">
      <RingPulse $color={sealRing ?? primaryColor} />
      {sparks.map((spark, index) => (
        <Spark
          key={index}
          $color={colors[spark.colorIndex]}
          $size={spark.size}
          $pill={spark.pill}
          style={
            {
              '--spark-x': `${spark.x}px`,
              '--spark-y': `${spark.y}px`,
              '--spark-rot': `${spark.rot}deg`,
              '--spark-delay': `${spark.delay}ms`,
            } as CSSProperties
          }
        />
      ))}
      <BadgeSeal $color={primaryColor} $accent={sealAccent} $ringColor={sealRing}>
        <OutcomeIcon outcome={outcome} />
      </BadgeSeal>
    </OverlayRoot>
  );
}
