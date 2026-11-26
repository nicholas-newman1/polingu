/**
 * Daily counters (newCardsToday, reviewedToday) belong to the learner's local
 * calendar day. These tests save and reload real review stores through the
 * storage modules, offline, so only the in-memory IndexedDB is involved.
 */
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { Rating } from 'ts-fsrs';
import loadVocabularyReviewData from '../../src/lib/storage/loadVocabularyReviewData';
import saveVocabularyReviewData from '../../src/lib/storage/saveVocabularyReviewData';
import loadConjugationReviewData from '../../src/lib/storage/loadConjugationReviewData';
import saveConjugationReviewData from '../../src/lib/storage/saveConjugationReviewData';
import { getDefaultVocabularyReviewStore, getTodayString } from '../../src/lib/storage/helpers';
import { userDb } from '../../src/lib/offlineDb/userDb';
import getVocabularySessionCards from '../../src/lib/vocabularyScheduler/getVocabularySessionCards';
import getOrCreateVocabularyCardReviewData from '../../src/lib/storage/getOrCreateVocabularyCardReviewData';
import rateCard from '../../src/lib/fsrsUtils/rateCard';
import type { VocabularyReviewDataStore, VocabularyWord } from '../../src/types/vocabulary';
import type { ConjugationReviewDataStore } from '../../src/types/conjugation';
import { signInFakeUser } from '../fakes/firebase';
import { freezeTime, graduated, learning, recordWordReview } from './fixtures';
import { stubs } from '../helpers/stub';

beforeEach(async () => {
  signInFakeUser();
  // Offline, so saves and loads stay in IndexedDB and never reach Firestore.
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  await Promise.all(userDb.tables.map((table) => table.clear()));
});

/** A store dated by the frozen clock: word 1 overdue, 2 learning, 3 studied for the first time. */
function studiedStore(): VocabularyReviewDataStore {
  return {
    ...getDefaultVocabularyReviewStore(),
    cards: {
      1: { wordId: 1, fsrsCard: graduated(-1) },
      2: { wordId: 2, fsrsCard: learning(10) },
      3: { wordId: 3, fsrsCard: learning(10) },
    },
    reviewedToday: [3],
    newCardsToday: [3],
  };
}

async function saveAt(when: string, store?: VocabularyReviewDataStore) {
  freezeTime(when);
  const saved = store ?? studiedStore();
  await saveVocabularyReviewData(null, saved, 'pl-to-en');
  return saved;
}

async function loadAt(when: string, direction: 'pl-to-en' | 'en-to-pl' = 'pl-to-en') {
  freezeTime(when);
  return loadVocabularyReviewData(direction);
}

describe('the local calendar day', () => {
  test.each([
    ['local midnight', '2026-11-26T00:00:00-05:00', '2026-11-26'],
    ['one millisecond before local midnight', '2026-11-26T23:59:59.999-05:00', '2026-11-26'],
    // Already the 27th in UTC.
    ['a late evening', '2026-11-26T21:30:00-05:00', '2026-11-26'],
    ['the night daylight saving starts', '2026-03-08T03:30:00-04:00', '2026-03-08'],
    ['the evening after daylight saving starts', '2026-03-08T23:30:00-04:00', '2026-03-08'],
    ['the repeated hour when daylight saving ends', '2026-11-01T01:30:00-05:00', '2026-11-01'],
  ])('at %s, today is the local date', (_, instant, expected) => {
    freezeTime(instant);
    expect(getTodayString()).toBe(expected);
  });
});

describe('reloading review data', () => {
  test('later the same day, the counters and cards are as saved', async () => {
    const saved = await saveAt('2026-11-26T09:00:00-05:00');
    const loaded = await loadAt('2026-11-26T23:59:59-05:00');

    expect(loaded).toEqual(saved);
    expect(loaded.cards[1].fsrsCard.due).toBeInstanceOf(Date);
  });

  test('after local midnight, the counters start empty but every card keeps its progress', async () => {
    const saved = await saveAt('2026-11-26T23:00:00-05:00');
    const loaded = await loadAt('2026-11-27T00:00:00-05:00');

    expect(loaded.lastReviewDate).toBe('2026-11-27');
    expect(loaded.newCardsToday).toEqual([]);
    expect(loaded.reviewedToday).toEqual([]);
    expect(loaded.cards).toEqual(saved.cards);
  });

  test('the next morning, cards finished yesterday are due again and new cards are allowed', async () => {
    await saveAt('2026-11-26T21:00:00-05:00');
    const loaded = await loadAt('2026-11-27T07:00:00-05:00');
    const words = stubs<VocabularyWord>([1, 2, 3, 4, 5].map((id) => ({ id })));

    const session = getVocabularySessionCards(words, loaded, { newCardsPerDay: 1 });

    expect(session.reviewCards.map((c) => c.word.id)).toEqual([1, 2, 3]);
    expect(session.newCards.map((c) => c.word.id)).toEqual([4]);
  });

  test('the day ends at local midnight, not UTC midnight', async () => {
    const saved = await saveAt('2026-11-26T18:00:00-05:00');
    const loaded = await loadAt('2026-11-26T20:30:00-05:00'); // 01:30 UTC on the 27th

    expect(loaded.newCardsToday).toEqual(saved.newCardsToday);
    expect(loaded.reviewedToday).toEqual(saved.reviewedToday);
  });

  test('on the 25-hour day when daylight saving ends, the counters last until local midnight', async () => {
    const saved = await saveAt('2026-11-01T00:30:00-04:00');
    const lateSameDay = await loadAt('2026-11-01T23:30:00-05:00'); // 24 hours later

    expect(lateSameDay.newCardsToday).toEqual(saved.newCardsToday);

    const nextDay = await loadAt('2026-11-02T00:00:00-05:00');
    expect(nextDay.newCardsToday).toEqual([]);
  });

  test('on the 23-hour day when daylight saving starts, the counters reset at local midnight', async () => {
    const saved = await saveAt('2026-03-08T00:30:00-05:00');
    const lateSameDay = await loadAt('2026-03-08T23:59:00-04:00');

    expect(lateSameDay.newCardsToday).toEqual(saved.newCardsToday);

    const nextDay = await loadAt('2026-03-09T00:00:00-04:00');
    expect(nextDay.newCardsToday).toEqual([]);
  });

  test('recognition and production keep separate counters and cards', async () => {
    await saveAt('2026-11-26T09:00:00-05:00');
    const production = await loadAt('2026-11-26T10:00:00-05:00', 'en-to-pl');

    expect(production.cards).toEqual({});
    expect(production.newCardsToday).toEqual([]);
    expect(production.reviewedToday).toEqual([]);
  });

  test('conjugation forms survive the new day while their counters reset', async () => {
    freezeTime('2026-11-26T22:00:00-05:00');
    const formKey = 'robic:present:1sg';
    const store: ConjugationReviewDataStore = {
      forms: { [formKey]: { formKey, fsrsCard: learning(10) } },
      newFormsToday: [formKey],
      reviewedToday: [formKey],
      lastReviewDate: getTodayString(),
    };
    await saveConjugationReviewData(null, store, 'en-to-pl');

    freezeTime('2026-11-26T23:30:00-05:00');
    expect(await loadConjugationReviewData('en-to-pl')).toEqual(store);
    expect((await loadConjugationReviewData('pl-to-en')).forms).toEqual({});

    freezeTime('2026-11-27T00:30:00-05:00');
    const nextDay = await loadConjugationReviewData('en-to-pl');
    expect(nextDay.forms).toEqual(store.forms);
    expect(nextDay.newFormsToday).toEqual([]);
    expect(nextDay.reviewedToday).toEqual([]);
  });
});

test('a new word first studied just after midnight counts toward that day', async () => {
  freezeTime('2026-11-26T23:50:00-05:00');
  const loadedLastNight = await loadVocabularyReviewData('pl-to-en');

  freezeTime('2026-11-27T00:05:00-05:00');
  const reviewData = rateCard(getOrCreateVocabularyCardReviewData(7, loadedLastNight), Rating.Good);
  const afterReview = recordWordReview(loadedLastNight, 7, reviewData, {
    isNew: true,
    completed: true,
  });
  await saveVocabularyReviewData(loadedLastNight, afterReview, 'pl-to-en');

  const reloaded = await loadAt('2026-11-27T08:00:00-05:00');
  expect(reloaded.newCardsToday).toEqual([7]);
});
