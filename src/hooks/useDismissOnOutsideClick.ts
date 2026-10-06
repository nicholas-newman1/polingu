import { useEffect, useRef } from 'react';

/**
 * While `active`, calls `onDismiss` on any mousedown/touchstart for which `isInside` returns false.
 * Listeners attach on the next tick so the click that opened the element doesn't close it.
 */
export function useDismissOnOutsideClick(
  active: boolean,
  isInside: (target: Node) => boolean,
  onDismiss: (() => void) | undefined
) {
  const isInsideRef = useRef(isInside);
  useEffect(() => {
    isInsideRef.current = isInside;
  });

  useEffect(() => {
    if (!active) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (!isInsideRef.current(event.target as Node)) onDismiss?.();
    };

    const timer = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }, 0);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [active, onDismiss]);
}
