import { useMemo, useState, type RefObject } from 'react';
import { Box, Paper, Popper, type PopperProps } from '@mui/material';
import { styled } from '../../lib/styled';

/** Matches sticky app bar height in Layout.tsx and ReaderPage TextViewer. */
const STICKY_APP_BAR_HEIGHT = 64;
const VIEWPORT_EDGE_PADDING = 8;
const APP_BAR_CLEARANCE = STICKY_APP_BAR_HEIGHT + VIEWPORT_EDGE_PADDING;

type TooltipPlacement = 'top' | 'bottom';

/** Gap between anchor and tooltip (Popper offset skidding, distance). */
const TOOLTIP_OFFSET: [number, number] = [0, 6];

const TooltipPaper = styled(Paper, {
  shouldForwardProp: (prop) => prop !== '$placement',
})<{ $placement?: TooltipPlacement }>(({ theme, $placement = 'top' }) => ({
  position: 'relative',
  backgroundColor: theme.palette.tooltip.main,
  maxWidth: 280,
  '&::after': {
    content: '""',
    position: 'absolute',
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    ...($placement === 'bottom'
      ? {
          top: -6,
          borderBottom: `6px solid ${theme.palette.tooltip.main}`,
        }
      : {
          bottom: -6,
          borderTop: `6px solid ${theme.palette.tooltip.main}`,
        }),
  },
}));

export const TooltipContent = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1, 1.5),
  minWidth: 60,
  textAlign: 'center',
  color: theme.palette.tooltip.text,
  display: 'flex',
  alignItems: 'center',
  gap: theme.spacing(0.5),
}));

export const TooltipContentRich = styled(Box)(({ theme }) => ({
  padding: theme.spacing(1.5),
  color: theme.palette.tooltip.text,
}));

interface WordTooltipPopperProps extends Omit<PopperProps, 'ref' | 'popperRef'> {
  popperRef: RefObject<HTMLDivElement | null>;
  children: React.ReactNode;
}

export function WordTooltipPopper({ popperRef, children, open, ...props }: WordTooltipPopperProps) {
  const [resolvedPlacement, setResolvedPlacement] = useState<TooltipPlacement>('top');

  // Each opening starts from the preferred placement; Popper flips it if needed.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setResolvedPlacement('top');
  }

  const modifiers = useMemo(
    () => [
      { name: 'offset', options: { offset: TOOLTIP_OFFSET } },
      {
        name: 'flip',
        options: {
          fallbackPlacements: ['bottom', 'top'],
          padding: APP_BAR_CLEARANCE,
        },
      },
      {
        name: 'preventOverflow',
        options: {
          padding: {
            top: APP_BAR_CLEARANCE,
            bottom: VIEWPORT_EDGE_PADDING,
            left: VIEWPORT_EDGE_PADDING,
            right: VIEWPORT_EDGE_PADDING,
          },
        },
      },
      {
        name: 'trackPlacement',
        enabled: true,
        phase: 'afterWrite' as const,
        fn({ state }: { state: { placement: string } }) {
          const next: TooltipPlacement = state.placement.startsWith('bottom') ? 'bottom' : 'top';
          setResolvedPlacement((prev) => (prev === next ? prev : next));
        },
      },
    ],
    []
  );

  return (
    <Popper placement="top" open={open} modifiers={modifiers} {...props}>
      <TooltipPaper ref={popperRef} elevation={8} $placement={resolvedPlacement}>
        {children}
      </TooltipPaper>
    </Popper>
  );
}
