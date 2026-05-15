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
 * Legacy single-document review data keys. These were per-user docs that held
 * the entire `cards`/`forms` map and were migrated to per-card subcollections.
 * The keys may still exist in IndexedDB for users who were active before the
 * migration; we must skip them during background sync (re-pushing them would
 * trip the Firestore index limit again) and remove the stale rows on load.
 */
const LEGACY_REVIEW_USER_DATA_KEYS = new Set<string>([
  'vocabularyReviewData-pl-en',
  'vocabularyReviewData-en-pl',
  'sentenceReviewData-pl-en',
  'sentenceReviewData-en-pl',
  'conjugationReviewData-pl-en',
  'conjugationReviewData-en-pl',
  'aspectPairsReviewData',
  'reviewData',
]);

export async function cleanupLegacyReviewUserDataRows(): Promise<void> {
  await Promise.all(
    Array.from(LEGACY_REVIEW_USER_DATA_KEYS).map((key) => userDb.userData.delete(key))
  );
}

/**
 * 1. Save to IndexedDB immediately (works offline)
 * 2. Await Firestore write when online so callers know the server has it
 *    before we move on. If offline or if the write fails, the record stays
 *    flagged pendingSync=1 and will be retried by syncAllPendingToFirestore.
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

  if (!navigator.onLine) return;

  try {
    const docRef = doc(db, 'users', userId, 'data', docPath);
    await setDoc(docRef, serializedData as object);
    await userDb.userData.update(docPath, { pendingSync: 0 });
  } catch (e) {
    console.error(`Failed to sync ${docPath} to Firestore:`, e);
    throw e;
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
  const userRecords = allRecords.filter(
    (r) =>
      !r.key.startsWith('__') && r.pendingSync !== 1 && !LEGACY_REVIEW_USER_DATA_KEYS.has(r.key)
  );
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

  const pending = (await userDb.userData.where('pendingSync').equals(1).toArray()).filter(
    (r) => !LEGACY_REVIEW_USER_DATA_KEYS.has(r.key)
  );
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
