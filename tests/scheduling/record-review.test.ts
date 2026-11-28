import { beforeEach, describe, expect, test } from 'vitest';
import { Rating, type Grade } from 'ts-fsrs';
import { recordCardReview } from '../../src/lib/reviewSession/recordReview';
import rateCard from '../../src/lib/fsrsUtils/rateCard';
import type {
  VocabularyCardReviewData,
  VocabularyReviewDataStore,
} from '../../src/types/vocabulary';
import type { ConjugationReviewDataStore } from '../../src/types/conjugation';
import { freezeTime, graduated, TODAY } from './fixtures';
import { reviewDataFor } from '../../src/lib/reviewSession/scheduler';
import { vocabularyDeck } from '../../src/lib/reviewSession/reviewDecks';

beforeEach(() => freezeTime());

const AGAIN = { isNew: false, completed: false };
const PASSED = { isNew: false, completed: true };
const NEW_AGAIN = { isNew: true, completed: false };
const NEW_PASSED = { isNew: true, completed: true };

const emptyStore = (): VocabularyReviewDataStore => ({
  cards: {},
  reviewedToday: [],
  newCardsToday: [],
  lastReviewDate: TODAY,
});

const rated = (id: number | string, store: VocabularyReviewDataStore, rating: Grade) =>
  rateCard(reviewDataFor(vocabularyDeck, store, id), rating);

describe('recordCardReview', () => {
  test('a new card that is passed counts as introduced and as done for today', () => {
    const store = emptyStore();
    const next = recordCardReview(store, 1, rated(1, store, Rating.Good), NEW_PASSED);

    expect(next.newCardsToday).toEqual([1]);
    expect(next.reviewedToday).toEqual([1]);
    expect(next.cards[1].fsrsCard.state).not.toBe(0);
  });

  test('a new card rated Again uses up an allowance place but is not done for today', () => {
    const store = emptyStore();
    const next = recordCardReview(store, 1, rated(1, store, Rating.Again), NEW_AGAIN);

    expect(next.newCardsToday).toEqual([1]);
    expect(next.reviewedToday).toEqual([]);
  });

  test('a review card rated Again is neither introduced nor done for today', () => {
    const store: VocabularyReviewDataStore = {
      ...emptyStore(),
      cards: { 2: { wordId: 2, fsrsCard: graduated(-1) } },
    };
    const next = recordCardReview(store, 2, rated(2, store, Rating.Again), AGAIN);

    expect(next.newCardsToday).toEqual([]);
    expect(next.reviewedToday).toEqual([]);
    expect(next.cards[2].fsrsCard.lapses).toBe(1);
  });

  test('a card rated several times today is counted once in each list', () => {
    let store = emptyStore();
    store = recordCardReview(store, 3, rated(3, store, Rating.Again), NEW_AGAIN);
    store = recordCardReview(store, 3, rated(3, store, Rating.Again), NEW_AGAIN);
    store = recordCardReview(store, 3, rated(3, store, Rating.Good), NEW_PASSED);
    store = recordCardReview(store, 3, rated(3, store, Rating.Good), PASSED);

    expect(store.newCardsToday).toEqual([3]);
    expect(store.reviewedToday).toEqual([3]);
    expect(store.cards[3].fsrsCard.reps).toBe(4);
  });

  test('a numeric id and its string form are the same card', () => {
    // Counters read back from storage hold built-in ids as strings.
    const store: VocabularyReviewDataStore = {
      ...emptyStore(),
      newCardsToday: ['4'],
      reviewedToday: ['4'],
    };
    const next = recordCardReview(store, 4, rated(4, store, Rating.Good), NEW_PASSED);

    expect(next.newCardsToday).toEqual(['4']);
    expect(next.reviewedToday).toEqual(['4']);
  });

  test('returns a new store with the latest review data, leaving the original untouched', () => {
    const other: VocabularyCardReviewData = { wordId: 'other', fsrsCard: graduated(5) };
    const store: VocabularyReviewDataStore = {
      cards: { other },
      reviewedToday: ['other'],
      newCardsToday: [],
      lastReviewDate: TODAY,
    };
    const snapshot = structuredClone(store);
    const reviewData = rated('custom_9', store, Rating.Easy);

    const next = recordCardReview(store, 'custom_9', reviewData, NEW_PASSED);

    expect(store).toEqual(snapshot);
    expect(next).not.toBe(store);
    expect(next.cards).toEqual({ other, custom_9: reviewData });
    expect(next.cards.other).toBe(other);
    expect(next.reviewedToday).toEqual(['other', 'custom_9']);
    expect(next.lastReviewDate).toBe(TODAY);
  });
});

describe('recordCardReview for conjugation forms', () => {
  const formStore = (): ConjugationReviewDataStore => ({
    cards: {},
    reviewedToday: [],
    newCardsToday: [],
    lastReviewDate: TODAY,
  });
  const formData = (rating: Grade) =>
    rateCard({ formKey: 'byc:present:1sg', fsrsCard: graduated(0) }, rating);

  test('tracks new and done forms by their full form key', () => {
    let store = formStore();
    store = recordCardReview(store, 'byc:present:1sg', formData(Rating.Again), NEW_AGAIN);
    expect(store.newCardsToday).toEqual(['byc:present:1sg']);
    expect(store.reviewedToday).toEqual([]);

    store = recordCardReview(store, 'byc:present:1sg', formData(Rating.Good), NEW_PASSED);
    expect(store.newCardsToday).toEqual(['byc:present:1sg']);
    expect(store.reviewedToday).toEqual(['byc:present:1sg']);
    expect(Object.keys(store.cards)).toEqual(['byc:present:1sg']);
  });

  test('a review form rated Again stays due today and the original store is untouched', () => {
    const store = formStore();
    const next = recordCardReview(store, 'byc:past:3sg_m', formData(Rating.Again), AGAIN);

    expect(next.reviewedToday).toEqual([]);
    expect(next.newCardsToday).toEqual([]);
    expect(next.cards['byc:past:3sg_m']).toBeDefined();
    expect(store.cards).toEqual({});
  });
});
