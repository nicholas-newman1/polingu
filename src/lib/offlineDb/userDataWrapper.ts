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
 * Load user data with offline-first strategy
 * 1. Check IndexedDB first (instant, works offline)
 * 2. If no local data and online, pull from Firestore
 */
export async function loadUserDataOfflineFirst<T>(
  docPath: string,
  defaultValue: T,
  deserialize?: (data: unknown) => T
): Promise<T> {
  const userId = getUserId();
  if (!userId) return defaultValue;

  // Try IndexedDB first
  const localRecord = await userDb.userData.get(docPath);
  if (localRecord) {
    return deserialize ? deserialize(localRecord.data) : (localRecord.data as T);
  }

  // No local data - try Firestore if online
  if (navigator.onLine) {
    try {
      const docRef = doc(db, 'users', userId, 'data', docPath);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const rawData = docSnap.data();
        // Cache in IndexedDB for next time
        await userDb.userData.put({
          key: docPath,
          data: rawData,
          lastModified: Date.now(),
          pendingSync: 0,
        });
        return deserialize ? deserialize(rawData) : (rawData as T);
      }
    } catch (e) {
      console.error(`Failed to load ${docPath} from Firestore:`, e);
    }
  }

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
