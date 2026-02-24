/**
 * This module provides wrapper functions that integrate IndexedDB-first storage
 * with the existing Firestore-based storage functions.
 *
 * The strategy is:
 * - SAVE: Save to IndexedDB immediately, then sync to Firestore in background
 * - LOAD: Load from IndexedDB first, then pull from Firestore if needed
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { userDb } from './userDb';
import { getUserId } from '../storage/helpers';
import { showOfflineModeNotification } from '../storage/errorHandler';

const FETCH_TIMEOUT_MS = 5000;

let offlineNotificationShown = false;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms)),
  ]);
}

function notifyOfflineOnce(): void {
  if (!offlineNotificationShown) {
    offlineNotificationShown = true;
    showOfflineModeNotification();
  }
}

/**
 * Save user data with offline-first strategy
 * 1. Save to IndexedDB immediately (works offline)
 * 2. Sync to Firestore in background if online
 */
export async function saveUserDataOfflineFirst<T>(
  docPath: string,
  data: T,
  serialize?: (data: T) => unknown
): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  const serializedData = serialize ? serialize(data) : data;

  // Save to IndexedDB immediately
  await userDb.userData.put({
    key: docPath,
    data: serializedData,
    lastModified: Date.now(),
    pendingSync: 1,
  });

  // Sync to Firestore if online (don't await - fire and forget)
  if (navigator.onLine) {
    const docRef = doc(db, 'users', userId, 'data', docPath);
    setDoc(docRef, serializedData as object)
      .then(() => {
        // Mark as synced
        userDb.userData.update(docPath, { pendingSync: 0 });
      })
      .catch((e) => {
        console.error(`Failed to sync ${docPath} to Firestore:`, e);
        // Keep pendingSync = 1 so we retry later
      });
  }
}

/**
 * Load user data with online-first strategy
 * 1. If online, fetch from Firestore (ensures cross-device sync)
 * 2. If offline, use IndexedDB cache
 */
export async function loadUserDataOfflineFirst<T>(
  docPath: string,
  defaultValue: T,
  deserialize?: (data: unknown) => T
): Promise<T> {
  const userId = getUserId();
  if (!userId) return defaultValue;

  // If online, try to fetch fresh from Firestore with timeout
  if (navigator.onLine) {
    try {
      const docRef = doc(db, 'users', userId, 'data', docPath);
      const docSnap = await withTimeout(getDoc(docRef), FETCH_TIMEOUT_MS);
      if (docSnap.exists()) {
        const rawData = docSnap.data();
        // Update local cache
        await userDb.userData.put({
          key: docPath,
          data: rawData,
          lastModified: Date.now(),
          pendingSync: 0,
        });
        // Reset offline notification so it shows again next time
        offlineNotificationShown = false;
        return deserialize ? deserialize(rawData) : (rawData as T);
      }
    } catch (e) {
      console.error(`Failed to load ${docPath} from Firestore, falling back to cache:`, e);
      // Fall through to local cache on error
    }
  }

  // Offline or Firestore failed - use local cache
  console.log(`[UserData] Attempting to load ${docPath} from local cache...`);
  const localRecord = await userDb.userData.get(docPath);
  if (localRecord) {
    console.log(`[UserData] Found ${docPath} in local cache`);
    notifyOfflineOnce();
    return deserialize ? deserialize(localRecord.data) : (localRecord.data as T);
  }

  console.log(`[UserData] No local cache found for ${docPath}, using default`);
  return defaultValue;
}

/**
 * Sync all pending user data to Firestore
 * Call this when coming back online
 */
export async function syncAllPendingToFirestore(): Promise<number> {
  const userId = getUserId();
  if (!userId) return 0;

  const pending = await userDb.userData.where('pendingSync').equals(1).toArray();
  let synced = 0;

  for (const record of pending) {
    try {
      const docRef = doc(db, 'users', userId, 'data', record.key);
      await setDoc(docRef, record.data as object);
      await userDb.userData.update(record.key, { pendingSync: 0 });
      synced++;
    } catch (e) {
      console.error(`Failed to sync ${record.key}:`, e);
    }
  }

  return synced;
}

/**
 * Get count of pending sync records
 */
export async function getPendingSyncCount(): Promise<number> {
  return await userDb.userData.where('pendingSync').equals(1).count();
}
