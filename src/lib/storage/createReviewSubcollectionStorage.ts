import { collection, doc, setDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { userDb, type ReviewCardCollection, type ReviewCardRecord } from '../offlineDb/userDb';
import { getUserId } from './helpers';

/**
 * Per-card subcollection storage for review data.
 *
 * Data model:
 *   - Firestore:  users/{uid}/{collectionName}/{cardId}
 *   - IndexedDB:  reviewCards table, one row per card, keyed by `${collection}:${cardId}`
 *
 * Each save diffs the new card map against the previous map (by reference equality
 * for unchanged cards) and only issues per-card writes/deletes for the deltas.
 *
 * Reads are cache-first so the UI paints instantly and works offline. Firestore
 * remains the source of truth, so `refreshFromFirestore` must be called in the
 * background after load to pull in reviews made on other devices.
 */

/** Sync operations that are independent of the card type, so all collections can be driven together. */
export interface ReviewSubcollectionSync {
  refreshFromFirestore(): Promise<void>;
  syncPendingCards(): Promise<void>;
}

export interface ReviewSubcollectionStorage<TCard> extends ReviewSubcollectionSync {
  loadCards(): Promise<Record<string, TCard>>;
  saveCardsDiff(prev: Record<string, TCard> | null, next: Record<string, TCard>): Promise<void>;
  clearAllCards(): Promise<void>;
}

export interface ReviewSubcollectionConfig<TCard> {
  collectionName: ReviewCardCollection;
  serialize: (card: TCard) => unknown;
  deserialize: (raw: unknown) => TCard;
}

function compoundKey(collectionName: ReviewCardCollection, cardId: string): string {
  return `${collectionName}:${cardId}`;
}

async function readCachedCardEntries<TCard>(
  collectionName: ReviewCardCollection,
  deserialize: (raw: unknown) => TCard
): Promise<Record<string, TCard>> {
  const rows = await userDb.reviewCards.where('collection').equals(collectionName).toArray();
  const result: Record<string, TCard> = {};
  for (const row of rows) {
    if (row.pendingDelete) continue;
    result[row.cardId] = deserialize(row.data);
  }
  return result;
}

export function createReviewSubcollectionStorage<TCard>(
  config: ReviewSubcollectionConfig<TCard>
): ReviewSubcollectionStorage<TCard> {
  const { collectionName, serialize, deserialize } = config;

  async function loadCards(): Promise<Record<string, TCard>> {
    const userId = getUserId();
    if (!userId) return {};

    const cached = await readCachedCardEntries(collectionName, deserialize);
    if (Object.keys(cached).length > 0) return cached;

    if (!navigator.onLine) return cached;

    try {
      await refreshFromFirestore();
    } catch (e) {
      console.error(`Failed to load ${collectionName} from Firestore:`, e);
      return cached;
    }

    return readCachedCardEntries(collectionName, deserialize);
  }

  /**
   * Overwrite the local cache with Firestore's copy so reviews made on other
   * devices show up here. Rows that still hold unsynced local changes are left
   * alone, as are rows written while the fetch was in flight.
   */
  async function refreshFromFirestore(): Promise<void> {
    const userId = getUserId();
    if (!userId || !navigator.onLine) return;

    const startedAt = Date.now();
    const snapshot = await getDocs(collection(db, 'users', userId, collectionName));

    const localRows = await userDb.reviewCards.where('collection').equals(collectionName).toArray();
    const protectedKeys = new Set(
      localRows
        .filter((r) => r.pendingSync === 1 || r.pendingDelete === 1 || r.lastModified > startedAt)
        .map((r) => r.compoundKey)
    );

    const serverKeys = new Set<string>();
    const records: ReviewCardRecord[] = [];
    for (const d of snapshot.docs) {
      const key = compoundKey(collectionName, d.id);
      serverKeys.add(key);
      if (protectedKeys.has(key)) continue;
      records.push({
        compoundKey: key,
        collection: collectionName,
        cardId: d.id,
        data: d.data(),
        lastModified: startedAt,
        pendingSync: 0,
        pendingDelete: 0,
      });
    }

    const removedKeys = localRows
      .filter((r) => !serverKeys.has(r.compoundKey) && !protectedKeys.has(r.compoundKey))
      .map((r) => r.compoundKey);

    await userDb.transaction('rw', userDb.reviewCards, async () => {
      if (removedKeys.length > 0) await userDb.reviewCards.bulkDelete(removedKeys);
      if (records.length > 0) await userDb.reviewCards.bulkPut(records);
    });
  }

  /**
   * Retry card writes that never reached Firestore, e.g. reviews done offline.
   * Without this they would stay in the local cache forever and never reach
   * the user's other devices.
   */
  async function syncPendingCards(): Promise<void> {
    const userId = getUserId();
    if (!userId || !navigator.onLine) return;

    const rows = await userDb.reviewCards.where('collection').equals(collectionName).toArray();

    for (const row of rows.filter((r) => r.pendingSync === 1)) {
      const ref = doc(db, 'users', userId, collectionName, row.cardId);
      try {
        if (row.pendingDelete === 1) {
          await deleteDoc(ref);
          await userDb.reviewCards.delete(row.compoundKey);
        } else {
          await setDoc(ref, row.data as object);
          await userDb.reviewCards.update(row.compoundKey, { pendingSync: 0 });
        }
      } catch (e) {
        console.error(`Failed to sync pending ${collectionName}/${row.cardId}:`, e);
      }
    }
  }

  async function upsertCard(cardId: string, card: TCard): Promise<void> {
    const userId = getUserId();
    if (!userId) return;

    const serialized = serialize(card);
    const record: ReviewCardRecord = {
      compoundKey: compoundKey(collectionName, cardId),
      collection: collectionName,
      cardId,
      data: serialized,
      lastModified: Date.now(),
      pendingSync: 1,
      pendingDelete: 0,
    };
    await userDb.reviewCards.put(record);

    if (!navigator.onLine) return;

    try {
      const ref = doc(db, 'users', userId, collectionName, cardId);
      await setDoc(ref, serialized as object);
      await userDb.reviewCards.update(record.compoundKey, { pendingSync: 0 });
    } catch (e) {
      console.error(`Failed to sync ${collectionName}/${cardId}:`, e);
      throw e;
    }
  }

  async function deleteCardById(cardId: string): Promise<void> {
    const userId = getUserId();
    const key = compoundKey(collectionName, cardId);

    if (!userId) {
      await userDb.reviewCards.delete(key);
      return;
    }

    await userDb.reviewCards.update(key, {
      pendingDelete: 1,
      pendingSync: 1,
      lastModified: Date.now(),
    });

    if (!navigator.onLine) return;

    try {
      const ref = doc(db, 'users', userId, collectionName, cardId);
      await deleteDoc(ref);
      await userDb.reviewCards.delete(key);
    } catch (e) {
      console.error(`Failed to delete ${collectionName}/${cardId}:`, e);
      throw e;
    }
  }

  async function saveCardsDiff(
    prev: Record<string, TCard> | null,
    next: Record<string, TCard>
  ): Promise<void> {
    const upserts: Array<Promise<void>> = [];
    const deletes: Array<Promise<void>> = [];

    for (const [id, card] of Object.entries(next)) {
      if (!prev || prev[id] !== card) {
        upserts.push(upsertCard(id, card));
      }
    }

    if (prev) {
      for (const id of Object.keys(prev)) {
        if (!(id in next)) {
          deletes.push(deleteCardById(id));
        }
      }
    }

    await Promise.all([...upserts, ...deletes]);
  }

  async function clearLocalCards(): Promise<void> {
    const cachedRows = await userDb.reviewCards
      .where('collection')
      .equals(collectionName)
      .toArray();
    await userDb.reviewCards.bulkDelete(cachedRows.map((r) => r.compoundKey));
  }

  /**
   * Firestore is emptied before the local cache so a background refresh landing
   * mid-clear cannot resurrect the cards it is still able to read.
   */
  async function clearAllCards(): Promise<void> {
    const userId = getUserId();

    if (!userId || !navigator.onLine) {
      await clearLocalCards();
      return;
    }

    try {
      const snapshot = await getDocs(collection(db, 'users', userId, collectionName));
      const docs = snapshot.docs;
      for (let i = 0; i < docs.length; i += 400) {
        const chunk = docs.slice(i, i + 400);
        const batch = writeBatch(db);
        for (const d of chunk) batch.delete(d.ref);
        await batch.commit();
      }
    } catch (e) {
      console.error(`Failed to clear ${collectionName} from Firestore:`, e);
      throw e;
    } finally {
      await clearLocalCards();
    }
  }

  return { loadCards, saveCardsDiff, clearAllCards, refreshFromFirestore, syncPendingCards };
}
