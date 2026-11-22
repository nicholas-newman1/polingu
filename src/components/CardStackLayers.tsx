import { Box } from '@mui/material';
import { styled } from '../lib/styled';
import { alpha } from '../lib/theme';

interface LayerStyleConfig {
  bg: { light: string; dark: string };
  shadow: { light: string; dark: string };
  borderAlpha: { light: number; dark: number };
  transform: string;
  promoteAnimation: string;
  zIndex: number;
}

const LAYER_CONFIG: Record<1 | 2, LayerStyleConfig> = {
  1: {
    bg: { light: '#f7f4f0', dark: '#15120f' },
    shadow: {
      light: '0 6px 14px rgba(26, 22, 18, 0.09)',
      dark: '0 8px 18px rgba(0, 0, 0, 0.5)',
    },
    borderAlpha: { light: 0.11, dark: 0.11 },
    transform: 'translate3d(0, 11px, 0) scale(0.955)',
    promoteAnimation: 'cardPromoteLayer1 390ms cubic-bezier(0.22, 1, 0.36, 1) 25ms both',
    zIndex: 1,
  },
  2: {
    bg: { light: '#efeae3', dark: '#110e0c' },
    shadow: {
      light: '0 8px 16px rgba(26, 22, 18, 0.06)',
      dark: '0 10px 20px rgba(0, 0, 0, 0.4)',
    },
    borderAlpha: { light: 0.09, dark: 0.08 },
    transform: 'translate3d(0, 21px, 0) scale(0.91)',
    promoteAnimation: 'cardPromoteLayer2 390ms cubic-bezier(0.22, 1, 0.36, 1) 25ms both',
    zIndex: 0,
  },
};

const StackLayer = styled(Box)<{ $layer: 1 | 2; $promoted: boolean }>(({
  theme,
  $layer,
  $promoted,
}) => {
  const mode = theme.palette.mode;
  const cfg = LAYER_CONFIG[$layer];

  return {
    position: 'absolute',
    inset: 0,
    borderRadius: 16,
    backgroundColor: cfg.bg[mode],
    border: `1px solid ${alpha(theme.palette.text.primary, cfg.borderAlpha[mode])}`,
    boxShadow: cfg.shadow[mode],
    transformOrigin: 'center bottom',
    transform: cfg.transform,
    animation: $promoted ? cfg.promoteAnimation : undefined,
    '@media (prefers-reduced-motion: reduce)': {
      animation: 'none',
    },
    zIndex: cfg.zIndex,
    pointerEvents: 'none',
  };
});

interface CardStackLayersProps {
  /** Number of peeking cards behind the active card (0, 1, or 2). */
  depth: number;
  /** True when the active card was promoted from the stack after a card exit. */
  promoted: boolean;
}

export function CardStackLayers({ depth, promoted }: CardStackLayersProps) {
  if (depth <= 0) return null;

  return (
    <>
      {depth >= 2 && <StackLayer $layer={2} $promoted={promoted} aria-hidden="true" />}
      <StackLayer $layer={1} $promoted={promoted} aria-hidden="true" />
    </>
  );
}
