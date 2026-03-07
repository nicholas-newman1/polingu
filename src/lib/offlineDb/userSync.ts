import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { userDb } from './userDb';
import { getUserId } from '../storage/helpers';

/**
 * Save user data locally first (IndexedDB), then sync to Firestore if online
 * This ensures data is never lost even when offline
 */
export async function saveUserData(key: string, data: unknown): Promise<void> {
  await userDb.userData.put({
    key,
    data,
    lastModified: Date.now(),
    pendingSync: 1,
  });

  // Try to sync immediately if online
  if (navigator.onLine) {
    await syncSingleRecord(key);
  }
}

/**
 * Sync a single record to Firestore
 */
async function syncSingleRecord(key: string): Promise<void> {
  const userId = getUserId();
  if (!userId) return;

  const record = await userDb.userData.get(key);
  if (!record || record.pendingSync === 0) return;

  try {
    const docRef = doc(db, 'users', userId, 'data', key);
    await setDoc(docRef, record.data as object);
    await userDb.userData.update(key, { pendingSync: 0 });
  } catch (e) {
    console.error(`Failed to sync ${key}:`, e);
    // Keep pendingSync = 1 so we retry later
  }
}

/**
 * Sync all pending records to Firestore (call when coming back online)
 */
export async function syncAllPendingUserData(): Promise<void> {
  const pending = await userDb.userData.where('pendingSync').equals(1).toArray();
  await Promise.all(pending.map((r) => syncSingleRecord(r.key)));
}

/**
 * Pull user data from Firestore and save to IndexedDB
 * Use this for initial load when user has existing data on server
 */
export async function pullUserDataFromFirestore(key: string): Promise<unknown | null> {
  const userId = getUserId();
  if (!userId) return null;

  try {
    const docRef = doc(db, 'users', userId, 'data', key);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      await userDb.userData.put({
        key,
        data,
        lastModified: Date.now(),
        pendingSync: 0, // Already synced since it came from server
      });
      return data;
    }
  } catch (e) {
    console.error(`Failed to pull ${key} from Firestore:`, e);
  }
  return null;
}

/**
 * Pull all user data for a list of keys from Firestore
 * Used for initial sync on first load
 */
export async function pullAllUserDataFromFirestore(keys: string[]): Promise<void> {
  await Promise.all(keys.map((key) => pullUserDataFromFirestore(key)));
}

/**
 * Clear all user data from IndexedDB (for logout or reset)
 */
export async function clearUserData(): Promise<void> {
  await userDb.userData.clear();
}

/**
 * Get count of pending sync records
 */
export async function getPendingSyncCount(): Promise<number> {
  return await userDb.userData.where('pendingSync').equals(1).count();
}
