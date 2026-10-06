import { useEffect, useRef, useState } from 'react';
import {
  getCachedAudioItems,
  getCachedSystemAudioItems,
  subscribeToAudioItemsUpdates,
  subscribeToSystemAudioItems,
} from '../../lib/audio';
import type { AudioItem, SystemAudioItem } from '../../types/audio';

/** User and system audio items: cached copies first, then live Firestore updates. */
export function useAudioLibrary() {
  const [items, setItems] = useState<AudioItem[]>([]);
  const [systemItems, setSystemItems] = useState<SystemAudioItem[]>([]);
  const systemItemsRef = useRef<SystemAudioItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const applyItems = (next: AudioItem[]) => {
      if (cancelled) return;
      setItems(next);
      setLibraryLoading(false);
    };
    const applySystemItems = (next: SystemAudioItem[]) => {
      if (cancelled) return;
      setSystemItems(next);
      systemItemsRef.current = next;
    };

    getCachedAudioItems().then(applyItems);
    getCachedSystemAudioItems().then(applySystemItems);
    const unsubItems = subscribeToAudioItemsUpdates(applyItems);
    const unsubSystem = subscribeToSystemAudioItems(applySystemItems);

    return () => {
      cancelled = true;
      unsubItems();
      unsubSystem();
    };
  }, []);

  return { items, systemItems, systemItemsRef, libraryLoading };
}
