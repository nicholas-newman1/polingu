import { useEffect, useState } from 'react';
import {
  getCachedAudioItems,
  getCachedSystemAudioItems,
  subscribeToAudioItemsUpdates,
  subscribeToSystemAudioItems,
} from '../../lib/audio';
import { subscribeCachedThenLive } from '../../lib/media/cachedCollection';
import type { AudioItem, SystemAudioItem } from '../../types/audio';

/** User and system audio items: cached copies first, then live Firestore updates. */
export function useAudioLibrary() {
  const [items, setItems] = useState<AudioItem[]>([]);
  const [systemItems, setSystemItems] = useState<SystemAudioItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  useEffect(() => {
    const unsubItems = subscribeCachedThenLive(
      getCachedAudioItems,
      subscribeToAudioItemsUpdates,
      (next) => {
        setItems(next);
        setLibraryLoading(false);
      }
    );
    const unsubSystem = subscribeCachedThenLive(
      getCachedSystemAudioItems,
      subscribeToSystemAudioItems,
      setSystemItems
    );
    return () => {
      unsubItems();
      unsubSystem();
    };
  }, []);

  return { items, systemItems, libraryLoading };
}
