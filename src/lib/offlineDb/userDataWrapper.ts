/**
 * This module provides wrapper functions that integrate IndexedDB caching
 * with the existing Firestore-based storage functions.
 *
 * The strategy is:
 * - SAVE: Save to IndexedDB immediately, then sync to Firestore in background
 * - LOAD: Serve from IndexedDB cache first, fall back to Firestore on cache miss
 * - REFRESH: Background-refresh all cached data from Firestore after initial load
 */

import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { userDb } from './userDb';
import { getUserId } from '../storage/helpers';

/**
 * 1. Save to IndexedDB immediately (works offline)
 * 2. Sync to Firestore in background if online
 */
export async function saveUserData<T>(
  docPath: string,
  data: T,
  serialize?: (data: T) => unknown
): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  const serializedData = serialize ? serialize(data) : data;

  await userDb.userData.put({
    key: docPath,
    data: serializedData,
    lastModified: Date.now(),
    pendingSync: 1,
  });

  if (navigator.onLine) {
    const docRef = doc(db, 'users', userId, 'data', docPath);
    setDoc(docRef, serializedData as object)
      .then(() => {
        userDb.userData.update(docPath, { pendingSync: 0 });
      })
      .catch((e) => {
        console.error(`Failed to sync ${docPath} to Firestore:`, e);
      });
  }
}

/**
 * Cache-first: serve from IndexedDB instantly, fall back to Firestore on cache miss.
 * Background sync is handled separately by refreshAllUserDataFromFirestore().
 */
export async function loadUserData<T>(
  docPath: string,
  defaultValue: T,
  deserialize?: (data: unknown) => T
): Promise<T> {
  const userId = getUserId();
  if (!userId) return defaultValue;

  const localRecord = await userDb.userData.get(docPath);
  if (localRecord) {
    return deserialize ? deserialize(localRecord.data) : (localRecord.data as T);
  }

  if (navigator.onLine) {
    try {
      const docRef = doc(db, 'users', userId, 'data', docPath);
      const docSnap = await getDoc(docRef);
      const rawData = docSnap.exists() ? docSnap.data() : defaultValue;
      await userDb.userData.put({
        key: docPath,
        data: rawData,
        lastModified: Date.now(),
        pendingSync: 0,
      });
      return deserialize ? deserialize(rawData) : (rawData as T);
    } catch (e) {
      console.error(`Failed to load ${docPath} from Firestore:`, e);
    }
  }

  return defaultValue;
}

/**
 * Refresh all cached user data from Firestore and update IndexedDB.
 * Call this in the background after an initial cache-first load.
 */
export async function refreshAllUserDataFromFirestore(): Promise<void> {
  const userId = getUserId();
  if (!userId || !navigator.onLine) return;

  const allRecords = await userDb.userData.toArray();
  const userRecords = allRecords.filter((r) => !r.key.startsWith('__'));
  await Promise.all(
    userRecords.map(async (record) => {
      try {
        const docRef = doc(db, 'users', userId, 'data', record.key);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          await userDb.userData.put({
            key: record.key,
            data: docSnap.data(),
            lastModified: Date.now(),
            pendingSync: 0,
          });
        }
      } catch (e) {
        console.error(`Background refresh failed for ${record.key}:`, e);
      }
    })
  );
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
