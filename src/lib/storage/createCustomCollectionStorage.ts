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
import { stripUndefined } from './firestoreUtils';
import type { CustomItemBase } from '../../types/customItems';
import { getUserId } from './helpers';

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
 *   - save(items):            Compat shim — diffs items[] against current cache and issues per-card ops.
 */
export interface CollectionStorage<T extends CustomItemBase> {
  load(): Promise<T[]>;
  subscribe(onChange: (items: T[]) => void): Unsubscribe;
  add(item: T): Promise<void>;
  update(id: string, updates: Partial<T>): Promise<void>;
  delete(id: string): Promise<void>;
  save(items: T[]): Promise<void>;
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
): Promise<void> {
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
}

async function markCachePendingDelete(
  collectionName: CustomCardCollection,
  cardId: string
): Promise<void> {
  await userDb.customCards.update(compoundKey(collectionName, cardId), {
    pendingDelete: 1,
    pendingSync: 1,
    lastModified: Date.now(),
  });
}

async function removeCacheItem(
  collectionName: CustomCardCollection,
  cardId: string
): Promise<void> {
  await userDb.customCards.delete(compoundKey(collectionName, cardId));
}

export function createCustomCollectionStorage<T extends CustomItemBase>(
  collectionName: CustomCardCollection
): CollectionStorage<T> {
  async function load(): Promise<T[]> {
    return readCachedItems<T>(collectionName);
  }

  function subscribe(onChange: (items: T[]) => void): Unsubscribe {
    const userId = getUserId();
    if (!userId) {
      return () => {};
    }
    const colRef = collection(db, 'users', userId, collectionName);
    return onSnapshot(
      colRef,
      async (snapshot) => {
        const items = snapshot.docs.map((d) => d.data() as T);

        const existing = await userDb.customCards
          .where('collection')
          .equals(collectionName)
          .toArray();
        const snapshotIds = new Set(items.map((i) => i.id));

        const staleRows = existing.filter((r) => !snapshotIds.has(r.cardId) && !r.pendingSync);
        if (staleRows.length > 0) {
          await userDb.customCards.bulkDelete(staleRows.map((r) => r.compoundKey));
        }

        const now = Date.now();
        const records: CustomCardRecord[] = items.map((item) => ({
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

        const latest = await readCachedItems<T>(collectionName);
        onChange(latest);
      },
      (error) => {
        console.error(`Snapshot listener failed for ${collectionName}:`, error);
      }
    );
  }

  async function add(item: T): Promise<void> {
    const cleaned = stripUndefined(item);
    await writeCacheItem(collectionName, cleaned, 1);

    const userId = getUserId();
    if (!userId || !navigator.onLine) return;

    try {
      const ref = doc(db, 'users', userId, collectionName, item.id);
      await setDoc(ref, cleaned as object);
      await userDb.customCards.update(compoundKey(collectionName, item.id), {
        pendingSync: 0,
      });
    } catch (e) {
      console.error(`Failed to add ${collectionName}/${item.id}:`, e);
      throw e;
    }
  }

  async function update(id: string, updates: Partial<T>): Promise<void> {
    const existing = await userDb.customCards.get(compoundKey(collectionName, id));
    if (!existing) return;
    const merged = { ...(existing.data as T), ...updates } as T;
    const cleaned = stripUndefined(merged);
    await writeCacheItem(collectionName, cleaned, 1);

    const userId = getUserId();
    if (!userId || !navigator.onLine) return;

    try {
      const ref = doc(db, 'users', userId, collectionName, id);
      const cleanedUpdates = stripUndefined(updates as object) as Partial<T>;
      await updateDoc(ref, cleanedUpdates as Record<string, unknown>);
      await userDb.customCards.update(compoundKey(collectionName, id), {
        pendingSync: 0,
      });
    } catch (e) {
      console.error(`Failed to update ${collectionName}/${id}:`, e);
      throw e;
    }
  }

  async function remove(id: string): Promise<void> {
    const userId = getUserId();
    if (!userId) {
      await removeCacheItem(collectionName, id);
      return;
    }

    await markCachePendingDelete(collectionName, id);

    if (!navigator.onLine) return;

    try {
      const ref = doc(db, 'users', userId, collectionName, id);
      await deleteDoc(ref);
      await removeCacheItem(collectionName, id);
    } catch (e) {
      console.error(`Failed to delete ${collectionName}/${id}:`, e);
      throw e;
    }
  }

  async function save(items: T[]): Promise<void> {
    const existing = await readCachedItems<T>(collectionName);
    const existingById = new Map(existing.map((i) => [i.id, i]));
    const nextById = new Map(items.map((i) => [i.id, i]));

    const ops: Array<Promise<void>> = [];

    for (const item of items) {
      const prev = existingById.get(item.id);
      if (!prev) {
        ops.push(add(item));
      } else if (JSON.stringify(prev) !== JSON.stringify(item)) {
        ops.push(update(item.id, item));
      }
    }

    for (const prev of existing) {
      if (!nextById.has(prev.id)) {
        ops.push(remove(prev.id));
      }
    }

    await Promise.all(ops);
  }

  return { load, subscribe, add, update, delete: remove, save };
}
