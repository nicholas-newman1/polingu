import { useState, useEffect, useCallback, useRef } from 'react';
import { syncAllPendingToFirestore } from '../lib/offlineDb/userDataWrapper';
import { syncContentFromFirestore } from '../lib/offlineDb/contentSync';

const SYNC_TIMEOUT_MS = 10000;

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
  const isSyncingRef = useRef(false);

  const triggerSync = useCallback(async () => {
    if (!navigator.onLine || isSyncingRef.current) return;

    isSyncingRef.current = true;
    setIsSyncing(true);
    try {
      const timeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Sync timed out')), SYNC_TIMEOUT_MS)
      );
      const [syncedCount] = await Promise.race([
        Promise.all([syncAllPendingToFirestore(), syncContentFromFirestore()]),
        timeout,
      ]);
      setPendingSyncCount((prev) => Math.max(0, prev - syncedCount));
    } catch (e) {
      console.error('Sync failed:', e);
    } finally {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
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
