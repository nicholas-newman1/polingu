import { describe, expect, test, vi } from 'vitest';
import { State } from 'ts-fsrs';
import reprioritizeVocabularyWord from '../../src/lib/storage/reprioritizeVocabularyWord';
import { getTodayString } from '../../src/lib/storage/helpers';
import { syncAllPendingToFirestore } from '../../src/lib/offlineDb/userDataWrapper';
import {
  refreshAllReviewCardsFromFirestore,
  syncAllPendingReviewCards,
} from '../../src/lib/storage/reviewStorageRegistry';
import type { TranslationDirection } from '../../src/types/common';
import type { VocabularyReviewDataStore, VocabularyWord } from '../../src/types/vocabulary';
import { remote } from './support/fakeFirestore';
import {
  freezeTime,
  network,
  ratedCard,
  setTime,
  setupSyncTests,
  signIn,
  userPath,
} from './support/harness';
import { stubs } from '../helpers/stub';
import {
  aspectPairsStorage,
  conjugationStorage,
  declensionStorage,
  loadReviewStore,
  saveReviewStore,
  sentenceStorage,
  vocabularyStorage,
} from '../../src/lib/storage/reviewDeckStorage';
import { getSessionCards, reviewDataFor } from '../../src/lib/reviewSession/scheduler';
import { vocabularyDeck } from '../../src/lib/reviewSession/reviewDecks';

vi.mock('firebase/firestore', () => import('./support/fakeFirestore'));

setupSyncTests();

interface Snapshot {
  cards: string[];
  reviewed: string[];
  introduced: string[];
  date: string;
}

interface Feature {
  name: string;
  cardCollection: string;
  sessionDoc: string;
  /** Save `ids` as rated cards that were also reviewed and introduced on `date`. */
  save(ids: string[], date: string): Promise<void>;
  load(): Promise<Snapshot>;
}

const snapshot = (
  cards: Record<string, unknown>,
  reviewed: Array<string | number>,
  introduced: Array<string | number>,
  date: string
): Snapshot => ({
  cards: Object.keys(cards).sort(),
  reviewed: reviewed.map(String),
  introduced: introduced.map(String),
  date,
});

const rated = () => ratedCard(new Date());

const vocabulary = (direction: TranslationDirection): Feature => ({
  name: `vocabulary ${direction}`,
  cardCollection: `vocabularyReviewCards-${direction === 'pl-to-en' ? 'pl-en' : 'en-pl'}`,
  sessionDoc: `vocabularyReviewSession-${direction === 'pl-to-en' ? 'pl-en' : 'en-pl'}`,
  save: (ids, date) =>
    saveReviewStore(vocabularyStorage[direction], null, {
      cards: Object.fromEntries(ids.map((id) => [id, { wordId: id, fsrsCard: rated() }])),
      reviewedToday: ids,
      newCardsToday: ids,
      lastReviewDate: date,
    }),
  load: async () => {
    const s = await loadReviewStore(vocabularyStorage[direction]);
    return snapshot(s.cards, s.reviewedToday, s.newCardsToday, s.lastReviewDate);
  },
});

const sentences = (direction: TranslationDirection): Feature => ({
  name: `sentences ${direction}`,
  cardCollection: `sentenceReviewCards-${direction === 'pl-to-en' ? 'pl-en' : 'en-pl'}`,
  sessionDoc: `sentenceReviewSession-${direction === 'pl-to-en' ? 'pl-en' : 'en-pl'}`,
  save: (ids, date) =>
    saveReviewStore(sentenceStorage[direction], null, {
      cards: Object.fromEntries(ids.map((id) => [id, { sentenceId: id, fsrsCard: rated() }])),
      reviewedToday: ids,
      newCardsToday: ids,
      lastReviewDate: date,
    }),
  load: async () => {
    const s = await loadReviewStore(sentenceStorage[direction]);
    return snapshot(s.cards, s.reviewedToday, s.newCardsToday, s.lastReviewDate);
  },
});

const conjugation = (direction: TranslationDirection): Feature => ({
  name: `conjugation ${direction}`,
  cardCollection: `conjugationReviewForms-${direction === 'pl-to-en' ? 'pl-en' : 'en-pl'}`,
  sessionDoc: `conjugationReviewSession-${direction === 'pl-to-en' ? 'pl-en' : 'en-pl'}`,
  save: (ids, date) =>
    saveReviewStore(conjugationStorage[direction], null, {
      cards: Object.fromEntries(ids.map((id) => [id, { formKey: id, fsrsCard: rated() }])),
      reviewedToday: ids,
      newCardsToday: ids,
      lastReviewDate: date,
    }),
  load: async () => {
    const s = await loadReviewStore(conjugationStorage[direction]);
    return snapshot(s.cards, s.reviewedToday, s.newCardsToday, s.lastReviewDate);
  },
});

const FEATURES: Feature[] = [
  {
    name: 'declension',
    cardCollection: 'declensionReviewCards',
    sessionDoc: 'declensionReviewSession',
    save: (ids, date) =>
      saveReviewStore(declensionStorage.all, null, {
        cards: Object.fromEntries(ids.map((id) => [id, { cardId: id, fsrsCard: rated() }])),
        reviewedToday: ids,
        newCardsToday: ids,
        lastReviewDate: date,
      }),
    load: async () => {
      const s = await loadReviewStore(declensionStorage.all);
      return snapshot(s.cards, s.reviewedToday, s.newCardsToday, s.lastReviewDate);
    },
  },
  {
    name: 'aspect pairs',
    cardCollection: 'aspectPairsReviewCards',
    sessionDoc: 'aspectPairsReviewSession',
    save: (ids, date) =>
      saveReviewStore(aspectPairsStorage.all, null, {
        cards: Object.fromEntries(ids.map((id) => [id, { verbId: id, fsrsCard: rated() }])),
        reviewedToday: ids,
        newCardsToday: ids,
        lastReviewDate: date,
      }),
    load: async () => {
      const s = await loadReviewStore(aspectPairsStorage.all);
      return snapshot(s.cards, s.reviewedToday, s.newCardsToday, s.lastReviewDate);
    },
  },
  vocabulary('pl-to-en'),
  vocabulary('en-to-pl'),
  sentences('pl-to-en'),
  sentences('en-to-pl'),
  conjugation('pl-to-en'),
  conjugation('en-to-pl'),
];

describe.each(FEATURES)('$name', (feature) => {
  test("a reload on the same day restores the cards and today's counters", async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn();
    await feature.save(['a', 'b'], '2026-11-26');

    expect(await feature.load()).toEqual({
      cards: ['a', 'b'],
      reviewed: ['a', 'b'],
      introduced: ['a', 'b'],
      date: '2026-11-26',
    });
  });

  test('counters reset on the next local day while the cards are kept', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn();
    await feature.save(['a', 'b'], '2026-11-26');

    setTime('2026-11-27T00:00:01-05:00');

    expect(await feature.load()).toEqual({
      cards: ['a', 'b'],
      reviewed: [],
      introduced: [],
      date: '2026-11-27',
    });
  });

  test('reviews and counters saved offline reach the server once synced', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn('learner-offline');
    network.goOffline();
    await feature.save(['a'], '2026-11-26');
    expect(remote.calls).toEqual([]);

    network.goOnline();
    await Promise.all([syncAllPendingReviewCards(), syncAllPendingToFirestore()]);
    expect(Object.keys(remote.list(userPath('learner-offline', feature.cardCollection)))).toEqual([
      'a',
    ]);
    expect(remote.get(userPath('learner-offline', 'data', feature.sessionDoc))).toMatchObject({
      reviewedToday: ['a'],
      lastReviewDate: '2026-11-26',
    });
  });
});

describe('the daily rollover follows the local calendar', () => {
  const vocab = vocabulary('pl-to-en');

  test('counters survive until 23:59:59 local and reset one second later', async () => {
    freezeTime('2026-11-26T08:00:00-05:00');
    signIn();
    await vocab.save(['a'], getTodayString());

    setTime('2026-11-26T23:59:59-05:00');
    expect((await vocab.load()).reviewed).toEqual(['a']);

    setTime('2026-11-27T00:00:00-05:00');
    expect((await vocab.load()).reviewed).toEqual([]);
  });

  test('an evening session (already the next day in UTC) still counts for today', async () => {
    freezeTime('2026-11-26T21:00:00-05:00'); // 02:00 UTC on the 27th
    signIn();
    await vocab.save(['a'], getTodayString());

    setTime('2026-11-26T23:30:00-05:00');
    expect(await vocab.load()).toMatchObject({ reviewed: ['a'], date: '2026-11-26' });
  });

  test('the spring-forward night (23-hour day) still resets at local midnight', async () => {
    freezeTime('2026-03-07T23:30:00-05:00');
    signIn();
    await vocab.save(['a'], getTodayString());

    setTime('2026-03-08T03:30:00-04:00'); // after clocks jump from 2:00 to 3:00
    expect(await vocab.load()).toMatchObject({ reviewed: [], date: '2026-03-08' });
  });

  test('the fall-back night (repeated 1 a.m. hour) does not reset the counters', async () => {
    freezeTime('2026-11-01T01:30:00-04:00'); // first 1:30, daylight time
    signIn();
    await vocab.save(['a'], getTodayString());

    setTime('2026-11-01T01:30:00-05:00'); // second 1:30, standard time
    expect(await vocab.load()).toMatchObject({ reviewed: ['a'], date: '2026-11-01' });
  });

  test('a day with no saved session yet starts with empty counters dated today', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn();

    expect(await vocab.load()).toEqual({
      cards: [],
      reviewed: [],
      introduced: [],
      date: '2026-11-26',
    });
  });
});

describe('study directions are independent', () => {
  test('counters and cards saved for one direction do not appear in the other', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn();
    await vocabulary('pl-to-en').save(['a'], '2026-11-26');
    await sentences('en-to-pl').save(['s'], '2026-11-26');

    expect(await vocabulary('en-to-pl').load()).toMatchObject({ cards: [], reviewed: [] });
    expect(await sentences('pl-to-en').load()).toMatchObject({ cards: [], reviewed: [] });
  });
});

describe('guest', () => {
  test('loads an empty store and saving neither stores nor sends anything', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    const vocab = vocabulary('pl-to-en');

    await vocab.save(['a'], '2026-11-26');

    expect(await vocab.load()).toEqual({
      cards: [],
      reviewed: [],
      introduced: [],
      date: '2026-11-26',
    });
    expect(remote.calls).toEqual([]);
  });
});

describe('numeric word ids', () => {
  test('a built-in word (numeric id) finds its saved progress after a reload', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn();
    const fsrsCard = ratedCard('2026-11-26T10:00:00-05:00');
    await saveReviewStore(vocabularyStorage['pl-to-en'], null, {
      cards: { 5: { wordId: 5, fsrsCard } },
      reviewedToday: [5],
      newCardsToday: [5],
      lastReviewDate: '2026-11-26',
    });

    const loaded = await loadReviewStore(vocabularyStorage['pl-to-en']);

    expect(reviewDataFor(vocabularyDeck, loaded, 5).fsrsCard.state).toBe(State.Learning);
    expect(reviewDataFor(vocabularyDeck, loaded, 5).fsrsCard.last_review).toEqual(
      fsrsCard.last_review
    );
  });
});

describe('"Review again" (reprioritize) on a word introduced today', () => {
  test('the word is still offered as a new card after reloading the same day', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn();
    const studied: VocabularyReviewDataStore = {
      cards: { 5: { wordId: 5, fsrsCard: ratedCard('2026-11-26T09:00:00-05:00') } },
      reviewedToday: [5],
      newCardsToday: [5],
      lastReviewDate: '2026-11-26',
    };
    await saveReviewStore(vocabularyStorage['pl-to-en'], null, studied);

    const requeued = reprioritizeVocabularyWord(studied, 5);
    expect(requeued.newCardsToday).toEqual([]);
    await saveReviewStore(vocabularyStorage['pl-to-en'], studied, requeued);

    const reloaded = await loadReviewStore(vocabularyStorage['pl-to-en']);
    const words = stubs<VocabularyWord>([{ id: 5 }]);
    const session = getSessionCards(vocabularyDeck, words, reloaded, { newCardsPerDay: 10 });
    expect(session.newCards.map(({ word }) => word.id)).toEqual([5]);
  });
});

describe('review registry (all eight collections)', () => {
  const ALL_COLLECTIONS = [
    'declensionReviewCards',
    'aspectPairsReviewCards',
    'sentenceReviewCards-pl-en',
    'sentenceReviewCards-en-pl',
    'vocabularyReviewCards-pl-en',
    'vocabularyReviewCards-en-pl',
    'conjugationReviewForms-pl-en',
    'conjugationReviewForms-en-pl',
  ];

  const seedEveryCollection = (uid: string, id: string) => {
    for (const name of ALL_COLLECTIONS) {
      const fsrsCard = ratedCard('2026-11-20T10:00:00Z');
      remote.seed(`${userPath(uid, name)}/${id}`, {
        fsrsCard: {
          ...fsrsCard,
          due: fsrsCard.due.toISOString(),
          last_review: fsrsCard.last_review!.toISOString(),
        },
      });
    }
  };

  const loadEveryFeature = () => Promise.all(FEATURES.map((f) => f.load()));

  test('a refresh pulls cards from other devices into every collection', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn('registry-1');
    seedEveryCollection('registry-1', 'x');

    await refreshAllReviewCardsFromFirestore();

    network.goOffline();
    for (const loaded of await loadEveryFeature()) expect(loaded.cards).toEqual(['x']);
  });

  test('a second refresh within a minute is skipped, and one after a minute runs', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn('registry-2');
    await refreshAllReviewCardsFromFirestore();
    remote.calls.length = 0;

    setTime('2026-11-26T10:00:59-05:00');
    await refreshAllReviewCardsFromFirestore();
    expect(remote.calls).toEqual([]);

    setTime('2026-11-26T10:01:01-05:00');
    await refreshAllReviewCardsFromFirestore();
    expect(remote.callsTo('getDocsFromServer')).toHaveLength(8);
  });

  test('switching to another account is not held back by the previous account’s refresh', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn('registry-3');
    await refreshAllReviewCardsFromFirestore();
    remote.calls.length = 0;

    signIn('registry-4');
    await refreshAllReviewCardsFromFirestore();

    expect(remote.callsTo('getDocsFromServer')).toHaveLength(8);
    expect(remote.calls.every((c) => c.path.startsWith('users/registry-4/'))).toBe(true);
  });

  test('when the server was unreachable, the next refresh retries straight away', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn('registry-5');
    network.serverUnreachable();
    await refreshAllReviewCardsFromFirestore();

    network.goOnline();
    seedEveryCollection('registry-5', 'y');
    await refreshAllReviewCardsFromFirestore();

    network.goOffline();
    for (const loaded of await loadEveryFeature()) expect(loaded.cards).toEqual(['y']);
  });

  test('a guest refresh never reaches the server', async () => {
    await refreshAllReviewCardsFromFirestore();
    expect(remote.calls).toEqual([]);
  });

  test('pending reviews in every collection are pushed, even if one collection fails', async () => {
    freezeTime('2026-11-26T10:00:00-05:00');
    signIn('registry-6');
    network.goOffline();
    for (const feature of FEATURES) await feature.save(['p'], '2026-11-26');
    network.goOnline();
    remote.fail({ op: 'runTransaction' }, { times: 1 });

    await syncAllPendingReviewCards();

    const pushed = ALL_COLLECTIONS.filter(
      (name) => remote.get(`${userPath('registry-6', name)}/p`) !== undefined
    );
    expect(pushed).toHaveLength(7);

    await syncAllPendingReviewCards();
    const pushedAfterRetry = ALL_COLLECTIONS.filter(
      (name) => remote.get(`${userPath('registry-6', name)}/p`) !== undefined
    );
    expect(pushedAfterRetry).toHaveLength(8);
  });
});
