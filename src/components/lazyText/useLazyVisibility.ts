import { useState, useEffect, useRef, useCallback } from 'react';

interface LazyVisibilityOptions {
  initiallyVisible: boolean;
  rootMargin: string;
  index: number;
  registerRef: (index: number, el: HTMLDivElement | null) => void;
}

/**
 * Tracks whether a lazily rendered row has ever scrolled near the viewport. Once it has,
 * it stays rendered so scroll positions and word refs remain stable.
 */
export function useLazyVisibility({
  initiallyVisible,
  rootMargin,
  index,
  registerRef,
}: LazyVisibilityOptions) {
  const [hasBeenVisible, setHasBeenVisible] = useState(initiallyVisible);
  const placeholderRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (hasBeenVisible) return;
    const el = placeholderRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setHasBeenVisible(true);
      },
      { rootMargin }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasBeenVisible, rootMargin]);

  const setPlaceholder = useCallback(
    (el: HTMLDivElement | null) => {
      placeholderRef.current = el;
      registerRef(index, el);
    },
    [registerRef, index]
  );

  return { hasBeenVisible, setHasBeenVisible, setPlaceholder };
}
