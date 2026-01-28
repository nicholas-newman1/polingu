import { Box, Paper, Popper, type PopperProps } from '@mui/material';
import { styled } from '../../lib/styled';
import type { RefObject } from 'react';

export const TappableSpan = styled('span')(({ theme }) => ({
  cursor: 'pointer',
  borderRadius: 2,
  padding: '0 2px',
  transition: 'background-color 0.15s',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

export const HighlightedSpan = styled('span')(({ theme }) => ({
  color: theme.palette.primary.main,
  fontWeight: 600,
  cursor: 'pointer',
  borderRadius: 2,
  transition: 'background-color 0.15s',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
}));

export const TooltipPaper = styled(Paper)(({ theme }) => ({
  position: 'relative',
  backgroundColor: theme.palette.tooltip.main,
  maxWidth: 280,
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: -6,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 0,
    height: 0,
    borderLeft: '6px solid transparent',
    borderRight: '6px solid transparent',
    borderTop: `6px solid ${theme.palette.tooltip.main}`,
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

export function WordTooltipPopper({ popperRef, children, ...props }: WordTooltipPopperProps) {
  return (
    <Popper
      placement="top"
      modifiers={[{ name: 'offset', options: { offset: [0, 8] } }]}
      {...props}
    >
      <TooltipPaper ref={popperRef} elevation={8}>
        {children}
      </TooltipPaper>
    </Popper>
  );
}
