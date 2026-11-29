import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import { remote } from '../sync/support/fakeFirestore';
import { freezeTime, network, setTime, setupSyncTests, userPath } from '../sync/support/harness';
import { getTodayString } from '../../src/lib/storage/helpers';
import { clearUserData } from '../../src/lib/offlineDb/userSync';
import { userDb } from '../../src/lib/offlineDb/userDb';
import { renderReviewDataProvider } from './support/render';
import { ALL_FEATURES } from './support/features';
import { freshUid, ratedNow, sentence, serverIds, withWordRated, word } from './support/fixtures';
import { contentReads, idle, seedContent, seedServerCard, seedUserDoc } from './support/server';
import {
  loadDeckSettings,
  loadReviewStore,
  vocabularyStorage,
} from '../../src/lib/storage/reviewDeckStorage';

vi.mock('firebase/firestore', () => import('../sync/support/fakeFirestore'));

setupSyncTests();

const VOCAB_PL_EN = 'vocabularyReviewCards-pl-en';
const NOW = '2026-11-26T19:00:00-05:00';

// Fixtures date their cards from now, so the clock is frozen before any is made.
beforeEach(() => freezeTime(NOW));
// Let each test's load or background sync finish while it is still signed in and
// mounted: IndexedDB rows are not keyed by account, so a write landing after the
// next test's reset would show up there.
afterEach(() => act(idle));
/** Past the 60-second throttle on pulling review cards from the server. */
const AFTER_THROTTLE = '2026-11-26T19:05:00-05:00';

type Rendered = ReturnType<typeof renderReviewDataProvider>;

/** Rates `wordId` Good in the pl-to-en direction, the way a review session saves it. */
const rateWord = (h: Rendered, wordId: string) =>
  h.run(() => {
    const next = withWordRated(h.data().vocabulary.progress.stores['pl-to-en'], wordId);
    return h.data().vocabulary.progress.updateStore('pl-to-en', next);
  });

const shownCards = (h: Rendered) =>
  Object.keys(h.data().vocabulary.progress.stores['pl-to-en'].cards).sort();

const focusWindow = () => act(() => void window.dispatchEvent(new Event('focus')));

function setVisibility(state: DocumentVisibilityState) {
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
  return act(() => void document.dispatchEvent(new Event('visibilitychange')));
}

/** Renders for `uid` and waits until the first load and its background sync are over. */
async function renderLoaded(uid: string | null) {
  const h = renderReviewDataProvider(uid);
  await waitFor(() => expect(h.data().loading).toBe(false));
  await act(idle);
  return h;
}

function seedBasics() {
  seedContent({ vocabulary: [word('w1'), word('w2')], sentences: [sentence('s1')] });
}

describe('initial load', () => {
  test('signed in: shows loading, then the review data, settings and custom words from storage with the built-in content', async () => {
    const uid = freshUid();
    seedBasics();
    seedServerCard(uid, VOCAB_PL_EN, 'wordId', 'w1', ratedNow());
    seedUserDoc(uid, 'vocabularyReviewSession-pl-en', {
      reviewedToday: ['w1'],
      newCardsToday: ['w1'],
      lastReviewDate: getTodayString(),
    });
    seedUserDoc(uid, 'vocabularySettings-pl-en', { newCardsPerDay: 15 });
    remote.seed(userPath(uid, 'customVocabulary', 'custom_1'), {
      id: 'custom_1',
      isCustom: true,
      createdAt: 1,
      polish: 'kot',
      english: 'cat',
    });

    const h = renderReviewDataProvider(uid);
    expect(h.data().loading).toBe(true);
    expect(h.data().vocabulary.words).toEqual([]);

    await waitFor(() => expect(h.data().loading).toBe(false));
    const store = h.data().vocabulary.progress.stores['pl-to-en'];
    expect(Object.keys(store.cards)).toEqual(['w1']);
    expect(store.cards.w1.fsrsCard.due).toBeInstanceOf(Date);
    expect(store.reviewedToday).toEqual(['w1']);
    expect(h.data().vocabulary.progress.settings).toEqual({
      'pl-to-en': { newCardsPerDay: 15 },
      'en-to-pl': { newCardsPerDay: 10 },
    });
    expect(h.data().sentences.sentences.map((s) => s.id)).toEqual(['s1']);
    await waitFor(() =>
      expect(h.data().vocabulary.words.map((w) => w.id)).toEqual(['custom_1', 'w1', 'w2'])
    );
  });

  test.each(ALL_FEATURES.map((f) => [f.name, f] as const))(
    '%s: the stored progress and settings load into the context',
    async (_name, f) => {
      const uid = freshUid();
      // Directional features are checked in en-to-pl, the direction not loaded first.
      const direction = f.directional ? 'en-to-pl' : 'pl-to-en';
      seedBasics();
      seedServerCard(uid, f.collection(direction), f.idField, 'k1', ratedNow());
      seedUserDoc(uid, f.sessionDoc(direction), {
        reviewedToday: ['k1'],
        [f.newList]: ['k1'],
        lastReviewDate: getTodayString(),
      });
      seedUserDoc(uid, f.settingsDoc(direction), f.changedSettings as object);

      const h = await renderLoaded(uid);

      const store = f.shownStore(h.data(), direction);
      expect(f.cardIds(store)).toEqual(['k1']);
      expect(f.newIds(store)).toEqual(['k1']);
      expect(f.shownSettings(h.data(), direction)).toEqual(f.changedSettings);
    }
  );

  test('the sentence tags load into the context', async () => {
    seedBasics();
    remote.seed('config/sentenceTags', { topics: ['food'], grammar: [], style: ['formal'] });

    const h = await renderLoaded(freshUid());

    expect(h.data().sentences.tags).toEqual({ topics: ['food'], grammar: [], style: ['formal'] });
  });

  test('a session saved on an earlier day loads as an empty day, keeping the cards', async () => {
    const uid = freshUid();
    seedBasics();
    seedServerCard(uid, VOCAB_PL_EN, 'wordId', 'w1', ratedNow());
    seedUserDoc(uid, 'vocabularyReviewSession-pl-en', {
      reviewedToday: ['w1'],
      newCardsToday: ['w1'],
      lastReviewDate: '2026-11-25',
    });

    const h = await renderLoaded(uid);

    const store = h.data().vocabulary.progress.stores['pl-to-en'];
    expect(Object.keys(store.cards)).toEqual(['w1']);
    expect(store).toMatchObject({
      reviewedToday: [],
      newCardsToday: [],
      lastReviewDate: '2026-11-26',
    });
  });

  test('signed out: shows the built-in content with empty review data and never reads user data', async () => {
    seedBasics();

    const h = await renderLoaded(null);

    expect(h.data().vocabulary.systemWords.map((w) => w.id)).toEqual(['w1', 'w2']);
    expect(h.data().vocabulary.progress.stores['pl-to-en'].cards).toEqual({});
    expect(remote.calls.filter((c) => c.path.startsWith('users/'))).toEqual([]);

    // No background sync either, not even on focus.
    const reads = contentReads();
    await focusWindow();
    await act(idle);
    expect(contentReads()).toBe(reads);
  });

  test('offline: shows what the device has cached and does not contact the server', async () => {
    const uid = freshUid();
    seedBasics();
    seedServerCard(uid, VOCAB_PL_EN, 'wordId', 'w1', ratedNow());
    (await renderLoaded(uid)).unmount();

    network.goOffline();
    const callsBefore = remote.calls.length;
    const h = await renderLoaded(uid);
    await focusWindow();
    await act(idle);

    expect(shownCards(h)).toEqual(['w1']);
    expect(h.data().vocabulary.systemWords.map((w) => w.id)).toEqual(['w1', 'w2']);
    // Custom-item listeners are registered, to hear from the server once it is back.
    const requests = remote.calls.slice(callsBefore).filter((c) => c.op !== 'onSnapshot');
    expect(requests).toEqual([]);
  });
});

describe('background sync', () => {
  test('a sync that finishes during the first load is not overwritten by the older load', async () => {
    const uid = freshUid();
    seedBasics();
    seedServerCard(uid, VOCAB_PL_EN, 'wordId', 'w1', ratedNow());
    (await renderLoaded(uid)).unmount();
    // Another device reviews w2; this device only has w1 cached.
    seedServerCard(uid, VOCAB_PL_EN, 'wordId', 'w2', ratedNow());
    setTime(AFTER_THROTTLE);

    // The first load has read w1 from the device and waits on the server for a
    // collection with nothing cached when the window gains focus.
    const firstLoad = remote.hold('getDocsFromServer');
    const h = renderReviewDataProvider(uid);
    await waitFor(() => expect(remote.callsTo('getDocsFromServer').length).toBeGreaterThan(0));
    await act(idle);
    await focusWindow();
    await waitFor(() => expect(shownCards(h)).toEqual(['w1', 'w2']));
    expect(h.data().loading).toBe(true);

    // The sync that follows the first load would put w2 back, so hold it.
    const syncAfterLoad = remote.hold('getDocs');
    firstLoad.release();
    await waitFor(() => expect(h.data().loading).toBe(false));
    await act(idle);
    expect(shownCards(h)).toEqual(['w1', 'w2']);

    syncAfterLoad.release();
    await act(idle);
    expect(shownCards(h)).toEqual(['w1', 'w2']);
  });

  test('on start, pushes a review saved offline in an earlier visit, then shows a review made on another device', async () => {
    const uid = freshUid();
    seedBasics();
    (await renderLoaded(uid)).unmount();

    // An offline visit: the review is only on this device.
    network.goOffline();
    const offline = await renderLoaded(uid);
    await rateWord(offline, 'w1');
    offline.unmount();
    expect(serverIds(uid, VOCAB_PL_EN)).toEqual([]);

    // Meanwhile another device reviewed w2.
    seedServerCard(uid, VOCAB_PL_EN, 'wordId', 'w2', ratedNow());
    network.goOnline();
    setTime(AFTER_THROTTLE);

    const h = renderReviewDataProvider(uid);
    await waitFor(() => expect(shownCards(h)).toEqual(['w1', 'w2']));
    expect(serverIds(uid, VOCAB_PL_EN)).toEqual(['w1', 'w2']);
    expect(remote.get(userPath(uid, 'data', 'vocabularyReviewSession-pl-en'))).toMatchObject({
      reviewedToday: ['w1'],
      newCardsToday: ['w1'],
    });
  });

  test('regaining focus pushes changes made offline and pulls in other devices’ reviews, settings and new content', async () => {
    const uid = freshUid();
    seedBasics();
    const h = await renderLoaded(uid);

    network.goOffline();
    await rateWord(h, 'w1');
    await h.run(() =>
      h.data().vocabulary.progress.updateSettings('en-to-pl', { newCardsPerDay: 3 })
    );
    // Meanwhile, on another device and in the built-in content:
    seedServerCard(uid, VOCAB_PL_EN, 'wordId', 'w2', ratedNow());
    seedUserDoc(uid, 'vocabularySettings-pl-en', { newCardsPerDay: 30 });
    seedContent({ vocabulary: [word('w3')] });
    network.goOnline();
    setTime(AFTER_THROTTLE);

    await focusWindow();

    await waitFor(() => expect(shownCards(h)).toEqual(['w1', 'w2']));
    expect(h.data().vocabulary.progress.settings).toEqual({
      'pl-to-en': { newCardsPerDay: 30 },
      'en-to-pl': { newCardsPerDay: 3 },
    });
    expect(h.data().vocabulary.systemWords.map((w) => w.id)).toEqual(['w1', 'w2', 'w3']);
    expect(serverIds(uid, VOCAB_PL_EN)).toEqual(['w1', 'w2']);
    expect(remote.get(userPath(uid, 'data', 'vocabularySettings-en-pl'))).toEqual({
      newCardsPerDay: 3,
    });
  });

  test('removes review rows left on the device by the old single-document format', async () => {
    seedBasics();
    await userDb.userData.put({
      key: 'vocabularyReviewData-pl-en',
      data: { cards: {} },
      lastModified: 1,
      pendingSync: 1,
    });

    await renderLoaded(freshUid());

    expect(await userDb.userData.get('vocabularyReviewData-pl-en')).toBeUndefined();
  });

  test('returning to the tab syncs, hiding it does not', async () => {
    const uid = freshUid();
    seedBasics();
    const h = await renderLoaded(uid);
    const reads = contentReads();

    await setVisibility('hidden');
    await act(idle);
    expect(contentReads()).toBe(reads);

    seedServerCard(uid, VOCAB_PL_EN, 'wordId', 'w2', ratedNow());
    setTime(AFTER_THROTTLE);
    await setVisibility('visible');

    await waitFor(() => expect(shownCards(h)).toEqual(['w2']));
    expect(contentReads()).toBe(reads + 1);
  });

  test('a trigger while a sync is running does not start another, and the next one after it does', async () => {
    const uid = freshUid();
    seedBasics();
    await renderLoaded(uid);
    const reads = contentReads();

    const contentFetch = remote.hold('getDocs');
    await focusWindow();
    await waitFor(() => expect(contentReads()).toBe(reads + 1));
    await focusWindow();
    await setVisibility('visible');
    contentFetch.release();
    await act(idle);
    expect(contentReads()).toBe(reads + 1);

    await focusWindow();
    await act(idle);
    expect(contentReads()).toBe(reads + 2);
  });

  test('a failed sync keeps the data shown and logs the failure; the next focus brings the new data in', async () => {
    const uid = freshUid();
    seedBasics();
    seedServerCard(uid, VOCAB_PL_EN, 'wordId', 'w1', ratedNow());
    const h = await renderLoaded(uid);

    seedServerCard(uid, VOCAB_PL_EN, 'wordId', 'w2', ratedNow());
    setTime(AFTER_THROTTLE);
    remote.fail({ op: 'getDocs', path: 'verbs' }, { times: 1, code: 'unavailable' });
    await focusWindow();
    await act(idle);

    expect(console.error).toHaveBeenCalledWith('Background sync failed:', expect.anything());
    expect(shownCards(h)).toEqual(['w1']);

    await focusWindow();
    await waitFor(() => expect(shownCards(h)).toEqual(['w1', 'w2']));
  });

  test('after unmounting, focus and visibility changes no longer sync', async () => {
    const uid = freshUid();
    seedBasics();
    const h = await renderLoaded(uid);
    const reads = contentReads();

    h.unmount();
    window.dispatchEvent(new Event('focus'));
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    await idle();

    expect(contentReads()).toBe(reads);
  });
});

describe('switching accounts', () => {
  async function switchAccount(h: Rendered, uid: string) {
    // AuthProvider clears the previous account's offline data before it reports the new user.
    await clearUserData();
    act(() => h.switchUser(uid));
  }

  test("the previous account's review data disappears at once and the new account's loads", async () => {
    const ania = freshUid('ania');
    const bartek = freshUid('bartek');
    seedBasics();
    seedServerCard(ania, VOCAB_PL_EN, 'wordId', 'w1', ratedNow());
    seedServerCard(bartek, VOCAB_PL_EN, 'wordId', 'w2', ratedNow());
    const h = await renderLoaded(ania);
    expect(shownCards(h)).toEqual(['w1']);

    await switchAccount(h, bartek);

    expect(h.data().loading).toBe(true);
    expect(shownCards(h)).toEqual([]);
    await waitFor(() => expect(h.data().loading).toBe(false));
    expect(shownCards(h)).toEqual(['w2']);
  });

  test('a first load still running for the previous account is not applied after the switch', async () => {
    const ania = freshUid('ania');
    const bartek = freshUid('bartek');
    seedBasics();
    seedServerCard(ania, VOCAB_PL_EN, 'wordId', 'w1', ratedNow());
    seedServerCard(bartek, VOCAB_PL_EN, 'wordId', 'w2', ratedNow());

    // Nothing is cached yet, so each load asks the server for every review collection.
    const aniaLoad = remote.hold('getDocsFromServer');
    const h = renderReviewDataProvider(ania);
    await waitFor(() => expect(remote.callsTo('getDocsFromServer').length).toBeGreaterThan(0));
    await act(idle);

    // Bartek's load is held too, so Ania's finishes first, while Bartek's is the
    // one the provider is waiting for.
    const bartekLoad = remote.hold('getDocsFromServer');
    await switchAccount(h, bartek);
    await act(idle);
    aniaLoad.release();
    await act(idle);
    expect(h.data().loading).toBe(true);
    expect(shownCards(h)).toEqual([]);

    bartekLoad.release();
    await waitFor(() => expect(h.data().loading).toBe(false));
    await act(idle);
    expect(shownCards(h)).toEqual(['w2']);
  });

  test('signing out withdraws the review data at once and leaves the built-in content', async () => {
    const uid = freshUid();
    seedBasics();
    seedServerCard(uid, VOCAB_PL_EN, 'wordId', 'w1', ratedNow());
    seedUserDoc(uid, 'vocabularySettings-pl-en', { newCardsPerDay: 15 });
    const h = await renderLoaded(uid);
    expect(shownCards(h)).toEqual(['w1']);

    await clearUserData();
    act(() => h.switchUser(null));

    expect(h.data().loading).toBe(true);
    expect(shownCards(h)).toEqual([]);
    expect(h.data().vocabulary.progress.settings['pl-to-en']).toEqual({ newCardsPerDay: 10 });
    await waitFor(() => expect(h.data().loading).toBe(false));
    await act(idle);
    expect(shownCards(h)).toEqual([]);
    expect(h.data().vocabulary.systemWords.map((w) => w.id)).toEqual(['w1', 'w2']);
  });

  test("a sync that read the previous account's data is not applied after the switch", async () => {
    const ania = freshUid('ania');
    const bartek = freshUid('bartek');
    seedBasics();
    seedServerCard(ania, VOCAB_PL_EN, 'wordId', 'w1', ratedNow());
    seedServerCard(bartek, VOCAB_PL_EN, 'wordId', 'w2', ratedNow());
    const h = await renderLoaded(ania);

    // A second sync within the refresh throttle only reaches the server, once its
    // local reads are done, for collections this device has nothing cached for.
    const serverReads = remote.callsTo('getDocsFromServer').length;
    const lastRead = remote.hold('getDocsFromServer');
    await focusWindow();
    await waitFor(() =>
      expect(remote.callsTo('getDocsFromServer').length).toBeGreaterThan(serverReads)
    );
    await act(idle);

    await switchAccount(h, bartek);
    await waitFor(() => expect(h.data().loading).toBe(false));
    expect(shownCards(h)).toEqual(['w2']);

    lastRead.release();
    await act(idle);
    expect(shownCards(h)).toEqual(['w2']);
  });
});

describe('changes made while a background sync is running', () => {
  /**
   * Signed in with w0 reviewed, then starts a sync and pauses it after it has
   * read the vocabulary cards and settings from the device but before it hands
   * the fresh data to the contexts: it is waiting on the server for a collection
   * this device has nothing cached for. Relies on the frozen clock: within 60 s
   * of the load's sync, the sync skips the up-front pull of every review
   * collection, so its first server read is one of these.
   */
  async function renderWithSyncPaused() {
    const uid = freshUid();
    seedBasics();
    seedServerCard(uid, VOCAB_PL_EN, 'wordId', 'w0', ratedNow());
    const h = await renderLoaded(uid);

    const serverReads = remote.callsTo('getDocsFromServer').length;
    const sync = remote.hold('getDocsFromServer');
    await focusWindow();
    await waitFor(() =>
      expect(remote.callsTo('getDocsFromServer').length).toBeGreaterThan(serverReads)
    );
    await act(idle);

    const finishSync = async () => {
      sync.release();
      await act(idle);
    };
    return { uid, h, finishSync };
  }

  test('a review reaches the server and the device, and shows at once', async () => {
    const { uid, h, finishSync } = await renderWithSyncPaused();

    await rateWord(h, 'w1');
    expect(shownCards(h)).toEqual(['w0', 'w1']);
    await finishSync();

    expect(serverIds(uid, VOCAB_PL_EN)).toEqual(['w0', 'w1']);
    expect(remote.get(userPath(uid, 'data', 'vocabularyReviewSession-pl-en'))).toMatchObject({
      reviewedToday: ['w1'],
    });
    expect(
      Object.keys((await loadReviewStore(vocabularyStorage['pl-to-en'])).cards).sort()
    ).toEqual(['w0', 'w1']);
  });

  test('a review stays shown when the sync finishes', async () => {
    const { h, finishSync } = await renderWithSyncPaused();

    await rateWord(h, 'w1');
    await finishSync();

    expect(shownCards(h)).toEqual(['w0', 'w1']);
    expect(h.data().vocabulary.progress.stores['pl-to-en'].newCardsToday).toEqual(['w1']);
  });

  test('a settings change shows at once and is stored', async () => {
    const { h, finishSync } = await renderWithSyncPaused();

    await h.run(() =>
      h.data().vocabulary.progress.updateSettings('pl-to-en', { newCardsPerDay: 33 })
    );
    expect(h.data().vocabulary.progress.settings['pl-to-en']).toEqual({ newCardsPerDay: 33 });
    await finishSync();

    expect(await loadDeckSettings(vocabularyStorage['pl-to-en'])).toEqual({ newCardsPerDay: 33 });
  });

  test('a settings change stays shown when the sync finishes', async () => {
    const { h, finishSync } = await renderWithSyncPaused();

    await h.run(() =>
      h.data().vocabulary.progress.updateSettings('pl-to-en', { newCardsPerDay: 33 })
    );
    await finishSync();

    expect(h.data().vocabulary.progress.settings['pl-to-en']).toEqual({ newCardsPerDay: 33 });
  });

  test('a reset clears the shown progress at once and reaches the server and the device', async () => {
    const { uid, h, finishSync } = await renderWithSyncPaused();

    await h.run(() => h.data().vocabulary.progress.clear('pl-to-en'));
    expect(shownCards(h)).toEqual([]);
    await finishSync();

    expect(serverIds(uid, VOCAB_PL_EN)).toEqual([]);
    expect((await loadReviewStore(vocabularyStorage['pl-to-en'])).cards).toEqual({});
  });

  test('a reset stays reset when the sync finishes', async () => {
    const { h, finishSync } = await renderWithSyncPaused();

    await h.run(() => h.data().vocabulary.progress.clear('pl-to-en'));
    await finishSync();

    expect(shownCards(h)).toEqual([]);
  });
});
