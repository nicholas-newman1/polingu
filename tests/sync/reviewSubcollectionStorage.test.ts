import { describe, expect, test, vi } from 'vitest';
import { createReviewSubcollectionStorage } from '../../src/lib/storage/createReviewSubcollectionStorage';
import { vocabularyReviewStorage } from '../../src/lib/storage/vocabularyReviewStorage';
import { declensionReviewStorage } from '../../src/lib/storage/declensionReviewStorage';
import type { VocabularyCardReviewData } from '../../src/types/vocabulary';
import type { DeclensionCardReviewData } from '../../src/types';
import { remote, Timestamp } from './support/fakeFirestore';
import {
  freezeTime,
  network,
  ratedCard,
  setTime,
  setupSyncTests,
  signIn,
  userPath,
} from './support/harness';

vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));

setupSyncTests();

const UID = 'learner-a';
const COLLECTION = 'declensionReviewCards';
const cardsPath = userPath(UID, COLLECTION);

const card = (cardId: number, ratedAt: string): DeclensionCardReviewData => ({
  cardId,
  fsrsCard: ratedCard(ratedAt),
});

/** The form a card takes on the server: dates as ISO strings. */
const serverCard = (cardId: number, ratedAt: string) => {
  const { fsrsCard } = card(cardId, ratedAt);
  return {
    cardId,
    fsrsCard: {
      ...fsrsCard,
      due: fsrsCard.due.toISOString(),
      last_review: fsrsCard.last_review!.toISOString(),
    },
  };
};

const storage = () => createReviewSubcollectionStorage<DeclensionCardReviewData>(COLLECTION);

const lastReviewOf = (cards: Record<string, DeclensionCardReviewData>) =>
  Object.fromEntries(
    Object.entries(cards).map(([id, c]) => [id, c.fsrsCard.last_review?.toISOString()])
  );

describe('loading cards', () => {
  test('a guest has no cards and the server is never asked', async () => {
    remote.seed(`${cardsPath}/1`, serverCard(1, '2026-11-20T10:00:00Z'));

    expect(await storage().loadCards()).toEqual({});
    expect(remote.calls).toEqual([]);
  });

  test('with an empty cache, cards come from the server with their dates restored', async () => {
    signIn(UID);
    remote.seed(`${cardsPath}/1`, serverCard(1, '2026-11-20T10:00:00Z'));

    const cards = await storage().loadCards();

    expect(cards[1].fsrsCard.due).toBeInstanceOf(Date);
    expect(cards[1].fsrsCard.last_review).toEqual(new Date('2026-11-20T10:00:00Z'));
    expect(cards[1].fsrsCard.due).toEqual(card(1, '2026-11-20T10:00:00Z').fsrsCard.due);
  });

  test('once cached, cards load offline exactly as saved', async () => {
    signIn(UID);
    const saved = { 1: card(1, '2026-11-20T10:00:00Z'), 2: card(2, '2026-11-21T10:00:00Z') };
    await storage().saveCardsDiff(null, saved);
    network.goOffline();

    expect(await storage().loadCards()).toEqual(saved);
    expect(remote.callsTo('getDocs', 'getDocsFromServer')).toEqual([]);
  });

  test('offline with nothing cached returns no cards without calling the server', async () => {
    signIn(UID);
    network.goOffline();

    expect(await storage().loadCards()).toEqual({});
    expect(remote.calls).toEqual([]);
  });

  test('falls back to the SDK cache when the server read fails', async () => {
    signIn(UID);
    remote.seed(`${cardsPath}/1`, serverCard(1, '2026-11-20T10:00:00Z'));
    remote.fail({ op: 'getDocsFromServer' });

    expect(Object.keys(await storage().loadCards())).toEqual(['1']);
  });

  test('returns no cards, rather than throwing, when every read fails', async () => {
    signIn(UID);
    remote.seed(`${cardsPath}/1`, serverCard(1, '2026-11-20T10:00:00Z'));
    remote.fail({ op: ['getDocsFromServer', 'getDocs'] });

    expect(await storage().loadCards()).toEqual({});
  });
});

describe('saving reviews', () => {
  test('a review is written to the server with dates as ISO strings', async () => {
    signIn(UID);
    await storage().saveCardsDiff(null, { 1: card(1, '2026-11-20T10:00:00Z') });

    expect(remote.get(`${cardsPath}/1`)).toEqual(serverCard(1, '2026-11-20T10:00:00Z'));
  });

  test('only cards that changed since the previous store are written', async () => {
    signIn(UID);
    const prev = { 1: card(1, '2026-11-20T10:00:00Z'), 2: card(2, '2026-11-20T10:00:00Z') };
    await storage().saveCardsDiff(null, prev);
    remote.calls.length = 0;

    await storage().saveCardsDiff(prev, { ...prev, 2: card(2, '2026-11-21T10:00:00Z') });

    expect(remote.callsTo('setDoc', 'deleteDoc')).toEqual([`setDoc ${cardsPath}/2`]);
    expect(remote.get(`${cardsPath}/2`)).toEqual(serverCard(2, '2026-11-21T10:00:00Z'));
  });

  test('a card dropped from the store is deleted locally and on the server', async () => {
    signIn(UID);
    const prev = { 1: card(1, '2026-11-20T10:00:00Z'), 2: card(2, '2026-11-20T10:00:00Z') };
    await storage().saveCardsDiff(null, prev);

    await storage().saveCardsDiff(prev, { 1: prev[1] });

    expect(Object.keys(remote.list(cardsPath))).toEqual(['1']);
    network.goOffline();
    expect(Object.keys(await storage().loadCards())).toEqual(['1']);
  });

  test('a review saved offline is visible at once and reaches the server on the next sync', async () => {
    signIn(UID);
    network.goOffline();
    await storage().saveCardsDiff(null, { 1: card(1, '2026-11-20T10:00:00Z') });

    expect(lastReviewOf(await storage().loadCards())).toEqual({ 1: '2026-11-20T10:00:00.000Z' });
    expect(remote.list(cardsPath)).toEqual({});

    network.goOnline();
    await storage().syncPendingCards();
    expect(remote.get(`${cardsPath}/1`)).toEqual(serverCard(1, '2026-11-20T10:00:00Z'));
  });

  test('a card deleted offline disappears at once and is deleted on the server on the next sync', async () => {
    signIn(UID);
    const prev = { 1: card(1, '2026-11-20T10:00:00Z'), 2: card(2, '2026-11-20T10:00:00Z') };
    await storage().saveCardsDiff(null, prev);
    network.goOffline();

    await storage().saveCardsDiff(prev, { 1: prev[1] });
    expect(Object.keys(await storage().loadCards())).toEqual(['1']);

    network.goOnline();
    await storage().syncPendingCards();
    expect(Object.keys(remote.list(cardsPath))).toEqual(['1']);
  });

  test('a rejected write surfaces the error and the review is retried by the next sync', async () => {
    signIn(UID);
    remote.fail({ op: 'setDoc' }, { times: 1 });

    await expect(
      storage().saveCardsDiff(null, { 1: card(1, '2026-11-20T10:00:00Z') })
    ).rejects.toThrow();
    expect(Object.keys(await storage().loadCards())).toEqual(['1']);

    await storage().syncPendingCards();
    expect(remote.get(`${cardsPath}/1`)).toEqual(serverCard(1, '2026-11-20T10:00:00Z'));
  });

  // BUG: upsertCard() marks the row synced (pendingSync: 0) once its setDoc resolves,
  // without checking that the row still holds what it uploaded. If the connection drops
  // while that upload is in flight and the learner rates the same card again (an Again
  // card coming back later in the session), the newer review is stored as pending, and
  // then the older upload's acknowledgement clears the flag. syncPendingCards skips it,
  // and the next refresh replaces it with the server's older copy. The same pattern is
  // in saveUserData (setDoc branch) and the custom-item add/update.
  // Expected: the newer review reaches the server. Actual: the server keeps the older
  // review and this device reverts to it.
  test.fails(
    'a review saved offline while an earlier upload of that card is in flight is not lost',
    async () => {
      signIn(UID);
      const first = { 1: card(1, '2026-11-20T10:00:00Z') };
      const upload = remote.hold('setDoc');
      const uploading = storage().saveCardsDiff(null, first);
      await vi.waitFor(() => expect(remote.callsTo('setDoc')).toHaveLength(1));

      network.goOffline();
      await storage().saveCardsDiff(first, { 1: card(1, '2026-11-20T10:05:00Z') });
      upload.release();
      await uploading;

      network.goOnline();
      await storage().syncPendingCards();
      expect(remote.get(`${cardsPath}/1`)).toEqual(serverCard(1, '2026-11-20T10:05:00Z'));
      await storage().refreshFromFirestore();
      expect(lastReviewOf(await storage().loadCards())).toEqual({ 1: '2026-11-20T10:05:00.000Z' });
    }
  );

  test('the two study directions are stored in separate collections', async () => {
    signIn(UID);
    const plEn = vocabularyReviewStorage('pl-to-en');
    const enPl = vocabularyReviewStorage('en-to-pl');
    const word: VocabularyCardReviewData = {
      wordId: 7,
      fsrsCard: ratedCard('2026-11-20T10:00:00Z'),
    };

    await plEn.saveCardsDiff(null, { 7: word });

    expect(Object.keys(remote.list(userPath(UID, 'vocabularyReviewCards-pl-en')))).toEqual(['7']);
    expect(remote.list(userPath(UID, 'vocabularyReviewCards-en-pl'))).toEqual({});
    expect(Object.keys(await plEn.loadCards())).toEqual(['7']);
    expect(await enPl.loadCards()).toEqual({});
  });
});

describe('refreshing from the server', () => {
  test('pulls reviews from other devices, adds new cards and drops cards deleted elsewhere', async () => {
    signIn(UID);
    await storage().saveCardsDiff(null, {
      1: card(1, '2026-11-20T10:00:00Z'),
      2: card(2, '2026-11-20T10:00:00Z'),
    });
    remote.seed(`${cardsPath}/1`, serverCard(1, '2026-11-22T10:00:00Z'));
    remote.remove(`${cardsPath}/2`);
    remote.seed(`${cardsPath}/3`, serverCard(3, '2026-11-22T10:00:00Z'));

    await storage().refreshFromFirestore();

    expect(lastReviewOf(await storage().loadCards())).toEqual({
      1: '2026-11-22T10:00:00.000Z',
      3: '2026-11-22T10:00:00.000Z',
    });
  });

  test('does not roll back a review that is still waiting to sync', async () => {
    signIn(UID);
    const prev = { 1: card(1, '2026-11-20T10:00:00Z') };
    await storage().saveCardsDiff(null, prev);
    network.goOffline();
    await storage().saveCardsDiff(prev, { 1: card(1, '2026-11-23T10:00:00Z') });
    network.goOnline();

    await storage().refreshFromFirestore();

    expect(lastReviewOf(await storage().loadCards())).toEqual({ 1: '2026-11-23T10:00:00.000Z' });
  });

  test('does not resurrect a card whose deletion is still waiting to sync', async () => {
    signIn(UID);
    const prev = { 1: card(1, '2026-11-20T10:00:00Z'), 2: card(2, '2026-11-20T10:00:00Z') };
    await storage().saveCardsDiff(null, prev);
    network.goOffline();
    await storage().saveCardsDiff(prev, { 1: prev[1] });
    network.goOnline();

    await storage().refreshFromFirestore();

    expect(Object.keys(await storage().loadCards())).toEqual(['1']);
  });

  test('keeps a new card that is only local because its upload is still pending', async () => {
    signIn(UID);
    network.goOffline();
    await storage().saveCardsDiff(null, { 5: card(5, '2026-11-20T10:00:00Z') });
    network.goOnline();

    await storage().refreshFromFirestore();

    expect(Object.keys(await storage().loadCards())).toEqual(['5']);
  });

  test('a review saved while a refresh is in flight is not overwritten by the older snapshot', async () => {
    freezeTime('2026-11-24T10:00:00Z');
    signIn(UID);
    const prev = { 1: card(1, '2026-11-20T10:00:00Z') };
    await storage().saveCardsDiff(null, prev);

    const fetch = remote.hold('getDocsFromServer');
    const refreshing = storage().refreshFromFirestore();
    await vi.waitFor(() => expect(remote.callsTo('getDocsFromServer')).toHaveLength(1));

    setTime('2026-11-24T10:00:05Z');
    await storage().saveCardsDiff(prev, { 1: card(1, '2026-11-24T10:00:05Z') });
    fetch.release();
    await refreshing;

    expect(lastReviewOf(await storage().loadCards())).toEqual({ 1: '2026-11-24T10:00:05.000Z' });
  });

  test('a server failure leaves the cache as it was and is reported to the caller', async () => {
    signIn(UID);
    await storage().saveCardsDiff(null, { 1: card(1, '2026-11-20T10:00:00Z') });
    remote.remove(`${cardsPath}/1`);
    remote.fail({ op: 'getDocsFromServer' });

    await expect(storage().refreshFromFirestore()).rejects.toThrow();
    expect(Object.keys(await storage().loadCards())).toEqual(['1']);
  });

  test('a snapshot served from the SDK cache is ignored', async () => {
    signIn(UID);
    await storage().saveCardsDiff(null, { 1: card(1, '2026-11-20T10:00:00Z') });
    remote.remove(`${cardsPath}/1`);
    remote.serverSnapshotsFromCache = true;

    await storage().refreshFromFirestore();

    expect(Object.keys(await storage().loadCards())).toEqual(['1']);
  });

  test('does nothing for a guest or while offline', async () => {
    await storage().refreshFromFirestore();
    signIn(UID);
    network.goOffline();
    await storage().refreshFromFirestore();

    expect(remote.calls).toEqual([]);
  });
});

describe('pushing pending reviews (conflicts with other devices)', () => {
  const pendingLocalReview = async (ratedAt: string) => {
    signIn(UID);
    network.goOffline();
    await storage().saveCardsDiff(null, { 1: card(1, ratedAt) });
    network.goOnline();
  };

  test('a newer review from another device wins over an older offline review', async () => {
    await pendingLocalReview('2026-11-20T10:00:00Z');
    remote.seed(`${cardsPath}/1`, serverCard(1, '2026-11-22T10:00:00Z'));

    await storage().syncPendingCards();

    expect(remote.get(`${cardsPath}/1`)).toEqual(serverCard(1, '2026-11-22T10:00:00Z'));
    await storage().refreshFromFirestore();
    expect(lastReviewOf(await storage().loadCards())).toEqual({ 1: '2026-11-22T10:00:00.000Z' });
  });

  test('a newer offline review overwrites an older review on the server', async () => {
    await pendingLocalReview('2026-11-23T10:00:00Z');
    remote.seed(`${cardsPath}/1`, serverCard(1, '2026-11-22T10:00:00Z'));

    await storage().syncPendingCards();

    expect(remote.get(`${cardsPath}/1`)).toEqual(serverCard(1, '2026-11-23T10:00:00Z'));
  });

  test('a server copy whose rating date is a Firestore Timestamp is compared correctly', async () => {
    await pendingLocalReview('2026-11-20T10:00:00Z');
    const newer = serverCard(1, '2026-11-22T10:00:00Z');
    remote.seed(`${cardsPath}/1`, {
      ...newer,
      fsrsCard: {
        ...newer.fsrsCard,
        last_review: Timestamp.fromDate(new Date(newer.fsrsCard.last_review)),
      },
    });

    await storage().syncPendingCards();

    const onServer = remote.get(`${cardsPath}/1`) as { fsrsCard: { last_review: Timestamp } };
    expect(onServer.fsrsCard.last_review.toMillis()).toBe(Date.parse('2026-11-22T10:00:00Z'));
  });

  test('after a successful push the review is no longer pending', async () => {
    await pendingLocalReview('2026-11-23T10:00:00Z');
    await storage().syncPendingCards();
    remote.calls.length = 0;

    await storage().syncPendingCards();

    expect(remote.calls).toEqual([]);
  });

  test('one card failing to push does not block the others, and is retried later', async () => {
    signIn(UID);
    network.goOffline();
    await storage().saveCardsDiff(null, {
      1: card(1, '2026-11-20T10:00:00Z'),
      2: card(2, '2026-11-20T10:00:00Z'),
    });
    network.goOnline();
    remote.fail({ op: 'runTransaction' }, { times: 1 });

    await storage().syncPendingCards();
    expect(Object.keys(remote.list(cardsPath))).toHaveLength(1);

    await storage().syncPendingCards();
    expect(Object.keys(remote.list(cardsPath)).sort()).toEqual(['1', '2']);
  });

  test('does nothing for a guest or while offline', async () => {
    await storage().syncPendingCards();
    await pendingLocalReview('2026-11-20T10:00:00Z');
    network.goOffline();
    remote.calls.length = 0;

    await storage().syncPendingCards();

    expect(remote.calls).toEqual([]);
  });
});

describe('clearing all cards', () => {
  test('removes every card on the server and locally, leaving other collections alone', async () => {
    signIn(UID);
    const many = Object.fromEntries(
      Array.from({ length: 450 }, (_, i) => [i, card(i, '2026-11-20T10:00:00Z')])
    );
    await declensionReviewStorage.saveCardsDiff(null, many);
    const other = vocabularyReviewStorage('pl-to-en');
    await other.saveCardsDiff(null, {
      1: { wordId: 1, fsrsCard: ratedCard('2026-11-20T10:00:00Z') },
    });

    await declensionReviewStorage.clearAllCards();

    expect(remote.list(cardsPath)).toEqual({});
    expect(await declensionReviewStorage.loadCards()).toEqual({});
    expect(Object.keys(await other.loadCards())).toEqual(['1']);
    expect(Object.keys(remote.list(userPath(UID, 'vocabularyReviewCards-pl-en')))).toEqual(['1']);
  });

  test('a server failure is reported to the caller', async () => {
    signIn(UID);
    await storage().saveCardsDiff(null, { 1: card(1, '2026-11-20T10:00:00Z') });
    remote.fail({ op: 'batch.commit' });

    await expect(storage().clearAllCards()).rejects.toThrow();
  });

  test('a guest clears only the local cache', async () => {
    await storage().clearAllCards();
    expect(remote.calls).toEqual([]);
  });

  // BUG: clearAllCards() only empties the local cache when offline and records
  // nothing to replay later. The server keeps every card, so the next refresh
  // brings back the progress the learner chose to reset.
  // Expected: no cards after coming back online and refreshing. Actual: card 1 returns.
  test.fails('a reset done offline is not undone by the next refresh', async () => {
    signIn(UID);
    await storage().saveCardsDiff(null, { 1: card(1, '2026-11-20T10:00:00Z') });
    network.goOffline();

    await storage().clearAllCards();
    expect(await storage().loadCards()).toEqual({});

    network.goOnline();
    await storage().syncPendingCards();
    await storage().refreshFromFirestore();
    expect(await storage().loadCards()).toEqual({});
  });
});
