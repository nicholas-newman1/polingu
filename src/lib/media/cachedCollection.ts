import { collection, doc, onSnapshot, orderBy, query } from 'firebase/firestore';
import { db } from '../firebase';
import { userDb } from '../offlineDb/userDb';

export type FirestorePath = [string, ...string[]];

interface CachedCollectionOptions {
  /** Where the device copy of the list is kept in the offline database. */
  cacheKey: string;
  /** The collection's path, or null while it can't be read (no one is signed in). */
  path: () => FirestorePath | null;
  /** The list is delivered newest first by this field. */
  newestFirstBy: string;
  /** Names the list in the error logged when its subscription fails. */
  label: string;
}

/** A Firestore collection read newest first, keeping a device copy of the last list for offline use. */
export function cachedCollection<T>({
  cacheKey,
  path,
  newestFirstBy,
  label,
}: CachedCollectionOptions) {
  async function getCached(): Promise<T[]> {
    const record = await userDb.userData.get(cacheKey);
    return record ? (record.data as T[]) : [];
  }

  async function cache(items: T[]): Promise<void> {
    await userDb.userData.put({
      key: cacheKey,
      data: items,
      lastModified: Date.now(),
      pendingSync: 0,
    });
  }

  function subscribe(callback: (items: T[]) => void): () => void {
    const segments = path();
    if (!segments) return () => {};

    return onSnapshot(
      query(collection(db, ...segments), orderBy(newestFirstBy, 'desc')),
      (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as T);
        cache(items);
        callback(items);
      },
      (error) => {
        console.error(`${label} subscription error:`, error);
      }
    );
  }

  /** One item as it changes; null while it does not exist. */
  function subscribeOne(id: string, callback: (item: T | null) => void): () => void {
    const segments = path();
    if (!segments) return () => {};

    return onSnapshot(doc(db, ...segments, id), (snapshot) => {
      callback(snapshot.exists() ? (snapshot.data() as T) : null);
    });
  }

  return { getCached, subscribe, subscribeOne };
}

/**
 * Delivers the device copy of a list, then each live list. A device copy read after a live list
 * has arrived is older than it, so it is dropped.
 */
export function subscribeCachedThenLive<T>(
  getCached: () => Promise<T[]>,
  subscribe: (callback: (items: T[]) => void) => () => void,
  callback: (items: T[]) => void
): () => void {
  let stopped = false;
  let live = false;

  getCached().then((cached) => {
    if (!stopped && !live) callback(cached);
  });
  const unsubscribe = subscribe((items) => {
    live = true;
    if (!stopped) callback(items);
  });

  return () => {
    stopped = true;
    unsubscribe();
  };
}
