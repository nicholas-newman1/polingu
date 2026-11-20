import { useEffect, useState } from 'react';
import type { DialogProps } from '@mui/material/Dialog';
import { styled } from '../lib/styled';
import { ModalDialog } from './modalStyles';

interface KeyboardViewport {
  height: number;
  top: number;
}

function useKeyboardViewport(open: boolean) {
  const [keyboardViewport, setKeyboardViewport] = useState<KeyboardViewport | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!open || !viewport || !window.matchMedia('(any-pointer: coarse)').matches) return;

    const baseline = { width: window.innerWidth, height: window.innerHeight };
    const update = () => {
      if (window.innerWidth !== baseline.width) {
        baseline.width = window.innerWidth;
        baseline.height = window.innerHeight;
      }
      baseline.height = Math.max(baseline.height, window.innerHeight);

      const keyboardOpen =
        viewport.scale === 1 &&
        baseline.height - viewport.height > Math.max(100, baseline.height * 0.15);
      const next = keyboardOpen ? { height: viewport.height, top: viewport.offsetTop } : null;
      setKeyboardViewport((current) =>
        current?.height === next?.height && current?.top === next?.top ? current : next
      );
    };

    const frame = window.requestAnimationFrame(update);
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      window.cancelAnimationFrame(frame);
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [open]);

  return open ? keyboardViewport : null;
}

const PositionedDialog = styled(ModalDialog)<{ $viewport: KeyboardViewport | null }>(
  ({ theme, $viewport }) =>
    $viewport
      ? {
          top: $viewport.top,
          bottom: 'auto',
          height: $viewport.height,
          '& .MuiDialog-container': { alignItems: 'flex-start' },
          '& .MuiDialog-paper': { maxHeight: `calc(100% - ${theme.spacing(4)})` },
        }
      : {}
);

export function KeyboardAwareModalDialog({ open, ...props }: DialogProps) {
  const viewport = useKeyboardViewport(open);
  return <PositionedDialog {...props} open={open} $viewport={viewport} />;
}
