/**
 * This module provides wrapper functions that integrate IndexedDB caching
 * with the existing Firestore-based storage functions.
 *
 * The strategy is:
 * - SAVE: Save to IndexedDB immediately, then sync to Firestore in background
 * - LOAD: Serve from IndexedDB cache first, fall back to Firestore on cache miss
 * - REFRESH: Background-refresh all cached data from Firestore after initial load
 */

import { deleteDoc, doc, getDoc, runTransaction, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { userDb } from './userDb';
import { getUserId } from '../storage/helpers';
import { REVIEW_SESSION_DOC_PATHS } from '../storage/reviewDeckDocs';
import { stripUndefinedDeep } from '../storage/firestoreUtils';
import { mergeSessionDocs } from '../reviewSession/sessionLists';
import {
  markSyncedIfUnchanged,
  PENDING_CLEAR_KEY_PREFIX,
  removeIfUnchanged,
  type WrittenRow,
} from './pendingWrites';
import { syncPendingCustomCards } from '../storage/createCustomCollectionStorage';

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
 * Write a session doc without discarding counters another device recorded for
 * the same day. Returns the value that actually landed on the server so the
 * local cache can be brought in line with it.
 */
async function writeSessionData(userId: string, docPath: string, data: unknown): Promise<unknown> {
  const docRef = doc(db, 'users', userId, 'data', docPath);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(docRef);
    const merged = snap.exists() ? mergeSessionDocs(snap.data(), data) : data;
    tx.set(docRef, merged as object);
    return merged;
  });
}

/**
 * Push one cached row to Firestore and clear its pending flag, unless it was saved
 * again while the upload was in flight (that newer save stays pending).
 */
async function pushRow(userId: string, key: string, written: WrittenRow & { deleted?: number }) {
  const docRef = doc(db, 'users', userId, 'data', key);

  if (written.deleted === 1) {
    await deleteDoc(docRef);
    await removeIfUnchanged(userDb.userData, key, written);
    return;
  }

  if (REVIEW_SESSION_DOC_PATHS.has(key)) {
    const merged = await writeSessionData(userId, key, stripUndefinedDeep(written.data));
    // Bring the cache in line with what landed on the server, unless a newer
    // save is waiting: that one is merged with the server when it syncs.
    await userDb.transaction('rw', userDb.userData, async () => {
      const row = await userDb.userData.get(key);
      if (row && (row.lastModified !== written.lastModified || row.pendingSync !== 1)) return;
      await userDb.userData.put({ key, data: merged, lastModified: Date.now(), pendingSync: 0 });
    });
    return;
  }

  // Rows cached before undefined values were stripped on save would otherwise
  // fail on every sync.
  await setDoc(docRef, stripUndefinedDeep(written.data) as object);
  await markSyncedIfUnchanged(userDb.userData, key, written);
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

  const record = {
    key: docPath,
    // Firestore rejects undefined values, so they never go into the cache either.
    data: stripUndefinedDeep(serialize ? serialize(data) : data),
    lastModified: Date.now(),
    pendingSync: 1,
  };
  await userDb.userData.put(record);

  if (!navigator.onLine) return;

  try {
    await pushRow(userId, docPath, record);
  } catch (e) {
    console.error(`Failed to sync ${docPath} to Firestore:`, e);
    throw e;
  }
}

/**
 * Deletes a user doc here and on the server. Offline, or if the server cannot be
 * reached, the delete is queued like any other change, and loads return the
 * default value meanwhile rather than the deleted data.
 */
export async function deleteUserData(docPath: string): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  const record = { key: docPath, data: null, lastModified: Date.now(), pendingSync: 1, deleted: 1 };
  await userDb.userData.put(record);

  if (!navigator.onLine) return;

  try {
    await pushRow(userId, docPath, record);
  } catch (e) {
    console.error(`Failed to delete ${docPath} from Firestore:`, e);
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
  if (localRecord?.deleted === 1) return defaultValue;
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
        if (!docSnap.exists()) return;
        // Leave the row alone if it was saved while the fetch was in flight.
        await userDb.transaction('rw', userDb.userData, async () => {
          const current = await userDb.userData.get(record.key);
          if (!current || current.pendingSync === 1) return;
          if (current.lastModified !== record.lastModified) return;
          await userDb.userData.put({
            key: record.key,
            data: docSnap.data(),
            lastModified: Date.now(),
            pendingSync: 0,
          });
        });
      } catch (e) {
        console.error(`Background refresh failed for ${record.key}:`, e);
      }
    })
  );
}

/**
 * Sync all pending user data to Firestore: user docs and custom items.
 * Call this when coming back online. Returns how many changes were synced.
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
      await pushRow(userId, record.key, record);
      synced++;
    } catch (e) {
      console.error(`Failed to sync ${record.key}:`, e);
    }
  }

  return synced + (await syncPendingCustomCards());
}

/** How many local changes are waiting to reach the server, across every kind of user data. */
export async function countPendingChanges(): Promise<number> {
  const [userData, reviewCards, customCards] = await Promise.all([
    userDb.userData.where('pendingSync').equals(1).toArray(),
    userDb.reviewCards.where('pendingSync').equals(1).count(),
    userDb.customCards.where('pendingSync').equals(1).count(),
  ]);
  const pendingResets = await userDb.userData
    .where('key')
    .startsWith(PENDING_CLEAR_KEY_PREFIX)
    .count();
  const docs = userData.filter((r) => !LEGACY_REVIEW_USER_DATA_KEYS.has(r.key)).length;
  return docs + reviewCards + customCards + pendingResets;
}
