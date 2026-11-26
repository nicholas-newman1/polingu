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
    // A device copy read after a live snapshot is older than it, so it is ignored.
    let haveLiveItems = false;
    let haveLiveSystemItems = false;
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

    getCachedAudioItems().then((cached) => {
      if (!haveLiveItems) applyItems(cached);
    });
    getCachedSystemAudioItems().then((cached) => {
      if (!haveLiveSystemItems) applySystemItems(cached);
    });
    const unsubItems = subscribeToAudioItemsUpdates((live) => {
      haveLiveItems = true;
      applyItems(live);
    });
    const unsubSystem = subscribeToSystemAudioItems((live) => {
      haveLiveSystemItems = true;
      applySystemItems(live);
    });

    return () => {
      cancelled = true;
      unsubItems();
      unsubSystem();
    };
  }, []);

  return { items, systemItems, systemItemsRef, libraryLoading };
}
