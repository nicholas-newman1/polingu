import { useEffect, useRef } from 'react';

let backCloseCounter = 0;

export function useBackClose(open: boolean, onClose: () => void): void {
  const idRef = useRef<string | null>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      backCloseCounter += 1;
      const id = `back-close-${backCloseCounter}`;
      idRef.current = id;
      window.history.pushState({ backClose: id }, '');
    }

    if (!open && wasOpenRef.current && idRef.current) {
      const currentState = window.history.state;
      if (currentState?.backClose === idRef.current) {
        window.history.back();
      }
      idRef.current = null;
    }

    wasOpenRef.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const handlePopState = (event: PopStateEvent) => {
      if (idRef.current && event.state?.backClose !== idRef.current) {
        onClose();
        idRef.current = null;
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [open, onClose]);
}

