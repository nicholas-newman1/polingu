import { useState, useEffect, useCallback } from 'react';
import { syncAllPendingToFirestore } from '../lib/offlineDb/userDataWrapper';
import { syncContentFromFirestore } from '../lib/offlineDb/contentSync';

interface UseOnlineStatusReturn {
  /** Whether the device is currently online */
  isOnline: boolean;
  /** Whether a sync operation is currently in progress */
  isSyncing: boolean;
  /** Number of pending user data changes waiting to sync */
  pendingSyncCount: number;
  /** Manually trigger a sync operation */
  triggerSync: () => Promise<void>;
}

/**
 * Hook to track online/offline status and handle automatic syncing
 * when the device comes back online.
 */
export function useOnlineStatus(): UseOnlineStatusReturn {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingSyncCount, setPendingSyncCount] = useState(0);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncing) return;

    setIsSyncing(true);
    try {
      // Sync user data and content in parallel
      const [syncedCount] = await Promise.all([
        syncAllPendingToFirestore(),
        syncContentFromFirestore(),
      ]);
      setPendingSyncCount((prev) => Math.max(0, prev - syncedCount));
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      setIsSyncing(false);
    }
  }, [isSyncing]);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-sync when coming back online
      triggerSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [triggerSync]);

  return {
    isOnline,
    isSyncing,
    pendingSyncCount,
    triggerSync,
  };
}
