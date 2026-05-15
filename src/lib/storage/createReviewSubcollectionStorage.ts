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
 */
export interface ReviewSubcollectionStorage<TCard> {
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
      const snapshot = await getDocs(collection(db, 'users', userId, collectionName));
      if (snapshot.empty) return cached;

      const now = Date.now();
      const records: ReviewCardRecord[] = snapshot.docs.map((d) => ({
        compoundKey: compoundKey(collectionName, d.id),
        collection: collectionName,
        cardId: d.id,
        data: d.data(),
        lastModified: now,
        pendingSync: 0,
        pendingDelete: 0,
      }));
      await userDb.reviewCards.bulkPut(records);

      const fresh: Record<string, TCard> = {};
      for (const d of snapshot.docs) {
        fresh[d.id] = deserialize(d.data());
      }
      return fresh;
    } catch (e) {
      console.error(`Failed to load ${collectionName} from Firestore:`, e);
      return cached;
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

  async function clearAllCards(): Promise<void> {
    const userId = getUserId();

    const cachedRows = await userDb.reviewCards
      .where('collection')
      .equals(collectionName)
      .toArray();
    await userDb.reviewCards.bulkDelete(cachedRows.map((r) => r.compoundKey));

    if (!userId || !navigator.onLine) return;

    try {
      const snapshot = await getDocs(collection(db, 'users', userId, collectionName));
      if (snapshot.empty) return;

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
    }
  }

  return { loadCards, saveCardsDiff, clearAllCards };
}
