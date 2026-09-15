import { useEffect, useRef } from 'react';
import { registerSW } from 'virtual:pwa-register';
import { useSnackbar } from '../hooks/useSnackbar';

export function PwaUpdatePrompt() {
  const { showSnackbar } = useSnackbar();
  const updateSWRef = useRef<((reloadPage?: boolean) => Promise<void>) | undefined>(undefined);

  useEffect(() => {
    updateSWRef.current = registerSW({
      onNeedRefresh() {
        showSnackbar('A new version is available.', 'info', {
          action: {
            label: 'Reload',
            onClick: () => {
              void updateSWRef.current?.(true);
            },
          },
        });
      },
    });
  }, [showSnackbar]);

  return null;
}
