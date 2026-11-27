import { useCallback, useEffect, useRef, useState } from 'react';
import { ConfirmDialog, type ConfirmOptions } from '../components/ConfirmDialog';

/**
 * An in-app replacement for `window.confirm`. `confirm(options)` opens the dialog and
 * resolves to true when the action is confirmed, or false when it is cancelled or
 * dismissed. Render `confirmDialog` somewhere in the calling component.
 */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  // Kept after closing so the text does not vanish while the dialog fades out.
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const finish = useCallback((confirmed: boolean) => {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    setOpen(false);
  }, []);

  const confirm = useCallback((next: ConfirmOptions) => {
    resolveRef.current?.(false);
    setOptions(next);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  useEffect(
    () => () => {
      resolveRef.current?.(false);
      resolveRef.current = null;
    },
    []
  );

  const confirmDialog = (
    <ConfirmDialog
      open={open}
      {...options}
      onConfirm={() => finish(true)}
      onCancel={() => finish(false)}
    />
  );

  return { confirm, confirmDialog };
}
