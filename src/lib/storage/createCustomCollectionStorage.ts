import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { userDb, type CustomCardCollection, type CustomCardRecord } from '../offlineDb/userDb';
import { markSyncedIfUnchanged, removeIfUnchanged } from '../offlineDb/pendingWrites';
import { stripUndefined, undefinedToDeleteField } from './firestoreUtils';
import type { CustomItemBase } from '../../types/customItems';
import { getCurrentUserId } from '../cachedAuth';

/**
 * Per-card subcollection storage.
 *
 * Data model:
 *   - Firestore:  users/{uid}/{collection}/{cardId}
 *   - IndexedDB:  customCards table, one row per card, keyed by `${collection}:${cardId}`
 *
 * API:
 *   - load():                 Fast cache read from IndexedDB.
 *   - subscribe(cb):          Firestore onSnapshot listener; updates IndexedDB and invokes cb on every snapshot.
 *   - add/update/delete:      Single-card writes; optimistically update IndexedDB, then sync to Firestore.
 *
 * Writes made offline stay flagged pendingSync=1 and are replayed by
 * syncPendingCustomCards, which runs with the other pending-data syncs. A write the
 * server refuses is undone on this device too, and the error is rethrown.
 */
export interface CollectionStorage<T extends CustomItemBase> {
  load(): Promise<T[]>;
  subscribe(onChange: (items: T[]) => void): Unsubscribe;
  add(item: T): Promise<void>;
  update(id: string, updates: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
}

function compoundKey(collectionName: CustomCardCollection, cardId: string): string {
  return `${collectionName}:${cardId}`;
}

async function readCachedItems<T>(collectionName: CustomCardCollection): Promise<T[]> {
  const rows = await userDb.customCards.where('collection').equals(collectionName).toArray();
  return rows.filter((r) => !r.pendingDelete).map((r) => r.data as T);
}

async function writeCacheItem<T extends CustomItemBase>(
  collectionName: CustomCardCollection,
  item: T,
  pendingSync: number
): Promise<CustomCardRecord> {
  const record: CustomCardRecord = {
    compoundKey: compoundKey(collectionName, item.id),
    collection: collectionName,
    cardId: item.id,
    data: item,
    lastModified: Date.now(),
    pendingSync,
    pendingDelete: 0,
  };
  await userDb.customCards.put(record);
  return record;
}

async function markCachePendingDelete(
  collectionName: CustomCardCollection,
  cardId: string
): Promise<{ record?: CustomCardRecord; previous?: CustomCardRecord }> {
  const key = compoundKey(collectionName, cardId);
  return userDb.transaction('rw', userDb.customCards, async () => {
    const existing = await userDb.customCards.get(key);
    if (!existing) return {};
    const record = { ...existing, pendingDelete: 1, pendingSync: 1, lastModified: Date.now() };
    await userDb.customCards.put(record);
    return { record, previous: existing };
  });
}

/**
 * Puts a cached row back as it was before a write the server refused (`previous`
 * undefined: the row did not exist), unless it was saved again since. A refused
 * write would only fail again, so it is not left pending for the next sync.
 */
async function restoreIfUnchanged(
  written: CustomCardRecord,
  previous: CustomCardRecord | undefined
): Promise<void> {
  await userDb.transaction('rw', userDb.customCards, async () => {
    const row = await userDb.customCards.get(written.compoundKey);
    if (
      !row ||
      row.lastModified !== written.lastModified ||
      JSON.stringify(row.data) !== JSON.stringify(written.data)
    ) {
      return;
    }
    if (previous) await userDb.customCards.put(previous);
    else await userDb.customCards.delete(written.compoundKey);
  });
}

/**
 * Push every custom-item change still waiting in IndexedDB (made offline) to
 * Firestore. Each pending row holds the whole item, so it is written in full.
 * Returns how many changes reached the server.
 */
export async function syncPendingCustomCards(): Promise<number> {
  const userId = getCurrentUserId();
  if (!userId || !navigator.onLine) return 0;

  const rows = await userDb.customCards.where('pendingSync').equals(1).toArray();
  let synced = 0;
  for (const row of rows) {
    const ref = doc(db, 'users', userId, row.collection, row.cardId);
    try {
      if (row.pendingDelete === 1) {
        await deleteDoc(ref);
        await removeIfUnchanged(userDb.customCards, row.compoundKey, row);
      } else {
        await setDoc(ref, row.data as object);
        await markSyncedIfUnchanged(userDb.customCards, row.compoundKey, row);
      }
      synced++;
    } catch (e) {
      console.error(`Failed to sync pending ${row.collection}/${row.cardId}:`, e);
    }
  }
  return synced;
}

async function removeCacheItem(
  collectionName: CustomCardCollection,
  cardId: string
): Promise<void> {
  await userDb.customCards.delete(compoundKey(collectionName, cardId));
}

/** `normalize` is applied to every item as it is written, here and on the server. */
export function createCustomCollectionStorage<T extends CustomItemBase>(
  collectionName: CustomCardCollection,
  normalize: (item: T) => T = (item) => item
): CollectionStorage<T> {
  async function load(): Promise<T[]> {
    return readCachedItems<T>(collectionName);
  }

  function subscribe(onChange: (items: T[]) => void): Unsubscribe {
    const userId = getCurrentUserId();
    if (!userId) {
      return () => {};
    }
    const colRef = collection(db, 'users', userId, collectionName);
    return onSnapshot(
      colRef,
      async (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as T);
        const snapshotIds = new Set(items.map((i) => i.id));

        // Rows with changes not yet on the server (made offline, or still
        // uploading) keep the local version until those changes sync.
        await userDb.transaction('rw', userDb.customCards, async () => {
          const existing = await userDb.customCards
            .where('collection')
            .equals(collectionName)
            .toArray();
          const pendingIds = new Set(existing.filter((r) => r.pendingSync).map((r) => r.cardId));

          const staleRows = existing.filter((r) => !snapshotIds.has(r.cardId) && !r.pendingSync);
          if (staleRows.length > 0) {
            await userDb.customCards.bulkDelete(staleRows.map((r) => r.compoundKey));
          }

          const now = Date.now();
          const records: CustomCardRecord[] = items
            .filter((item) => !pendingIds.has(item.id))
            .map((item) => ({
              compoundKey: compoundKey(collectionName, item.id),
              collection: collectionName,
              cardId: item.id,
              data: item,
              lastModified: now,
              pendingSync: 0,
              pendingDelete: 0,
            }));
          if (records.length > 0) {
            await userDb.customCards.bulkPut(records);
          }
        });

        const latest = await readCachedItems<T>(collectionName);
        onChange(latest);
      },
      (error) => {
        console.error(`Snapshot listener failed for ${collectionName}:`, error);
      }
    );
  }

  async function add(item: T): Promise<void> {
    const cleaned = stripUndefined(normalize(item));
    const previous = await userDb.customCards.get(compoundKey(collectionName, item.id));
    const record = await writeCacheItem(collectionName, cleaned, 1);

    const userId = getCurrentUserId();
    if (!userId || !navigator.onLine) return;

    try {
      const ref = doc(db, 'users', userId, collectionName, item.id);
      await setDoc(ref, cleaned as object);
      await markSyncedIfUnchanged(userDb.customCards, record.compoundKey, record);
    } catch (e) {
      console.error(`Failed to add ${collectionName}/${item.id}:`, e);
      await restoreIfUnchanged(record, previous);
      throw e;
    }
  }

  /** Fields set to `undefined` in `updates` are removed, here and on the server. */
  async function update(id: string, updates: Partial<T>): Promise<void> {
    const existing = await userDb.customCards.get(compoundKey(collectionName, id));
    if (!existing) return;
    const merged = normalize({ ...(existing.data as T), ...updates });
    const cleaned = stripUndefined(merged);
    const record = await writeCacheItem(collectionName, cleaned, 1);

    const userId = getCurrentUserId();
    if (!userId || !navigator.onLine) return;

    // Only the given fields go to the server, normalized as they were cached.
    const changes = Object.fromEntries(
      Object.keys(updates).map((key) => [key, merged[key as keyof T]])
    );
    try {
      const ref = doc(db, 'users', userId, collectionName, id);
      await updateDoc(ref, undefinedToDeleteField(changes));
      await markSyncedIfUnchanged(userDb.customCards, record.compoundKey, record);
    } catch (e) {
      console.error(`Failed to update ${collectionName}/${id}:`, e);
      await restoreIfUnchanged(record, existing);
      throw e;
    }
  }

  async function remove(id: string): Promise<void> {
    const userId = getCurrentUserId();
    if (!userId) {
      await removeCacheItem(collectionName, id);
      return;
    }

    const { record, previous } = await markCachePendingDelete(collectionName, id);

    if (!navigator.onLine) return;

    try {
      const ref = doc(db, 'users', userId, collectionName, id);
      await deleteDoc(ref);
      if (record) await removeIfUnchanged(userDb.customCards, record.compoundKey, record);
      else await removeCacheItem(collectionName, id);
    } catch (e) {
      console.error(`Failed to delete ${collectionName}/${id}:`, e);
      if (record) await restoreIfUnchanged(record, previous);
      throw e;
    }
  }

  return { load, subscribe, add, update, delete: remove };
}
