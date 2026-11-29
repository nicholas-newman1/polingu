import { describe, expect, test } from 'vitest';
import { getCurrentUserId } from '../../src/lib/cachedAuth';
import { REVIEW_SESSION_DOC_PATHS } from '../../src/lib/storage/reviewDeckDocs';
import {
  aspectPairsStorage,
  conjugationStorage,
  declensionStorage,
  emptyReviewStore,
  sentenceStorage,
  vocabularyStorage,
} from '../../src/lib/storage/reviewDeckStorage';
import { placeItems } from '../../src/lib/reviewSession/scheduler';
import { sentenceDeck, vocabularyDeck } from '../../src/lib/reviewSession/reviewDecks';
import type { VocabularyReviewDataStore, VocabularyWord } from '../../src/types/vocabulary';
import type { Sentence, SentenceReviewDataStore } from '../../src/types/sentences';
import { signInFakeUser } from '../fakes/firebase';
import { stub, stubs } from '../helpers/stub';
import { freezeTime } from './fixtures';

const ALL_PARTS = [
  ...Object.values(vocabularyStorage),
  ...Object.values(sentenceStorage),
  ...Object.values(conjugationStorage),
  declensionStorage.all,
  aspectPairsStorage.all,
];

test('a fresh review store is empty and dated with the local day', () => {
  freezeTime('2026-11-26T23:45:00-05:00'); // already the 27th in UTC

  expect(emptyReviewStore()).toEqual({
    cards: {},
    reviewedToday: [],
    newCardsToday: [],
    lastReviewDate: '2026-11-26',
  });
});

test('fresh stores never share their lists, so one direction cannot leak into another', () => {
  const a = emptyReviewStore();
  const b = emptyReviewStore();
  a.newCardsToday.push(1);
  a.reviewedToday.push(1);
  expect(b.newCardsToday).toEqual([]);
  expect(b.reviewedToday).toEqual([]);
  expect(b.cards).not.toBe(a.cards);
});

describe('session counter documents', () => {
  const paths = ALL_PARTS.map((part) => part.sessionDocPath);

  test('each module and direction keeps its daily counters in its own document', () => {
    expect(new Set(paths).size).toBe(paths.length);
  });

  test('every counter document is merged across devices rather than overwritten', () => {
    expect([...REVIEW_SESSION_DOC_PATHS].sort()).toEqual([...paths].sort());
  });
});

describe('id lookups in the daily counters', () => {
  test('word ids match whether stored as numbers or strings', () => {
    const words = stubs<VocabularyWord>([{ id: 12 }, { id: 1 }, { id: 'custom_5' }]);
    const store = stub<VocabularyReviewDataStore>({
      cards: {},
      reviewedToday: [],
      newCardsToday: ['12', 'custom_5'],
    });
    expect(placeItems(vocabularyDeck, words, store).map((p) => p.bucket)).toEqual([
      null,
      'new',
      null,
    ]);
  });

  test('string ids must match exactly', () => {
    const sentences = stubs<Sentence>([{ id: 's1' }, { id: 's10' }]);
    const store = stub<SentenceReviewDataStore>({
      cards: {},
      reviewedToday: [],
      newCardsToday: ['s10'],
    });
    expect(placeItems(sentenceDeck, sentences, store).map((p) => p.bucket)).toEqual(['new', null]);
  });
});

describe('getCurrentUserId', () => {
  test('is the signed-in user', () => {
    signInFakeUser('learner-1');
    expect(getCurrentUserId()).toBe('learner-1');
  });

  test('falls back to the last signed-in user while offline', () => {
    localStorage.setItem(
      'polingu_cached_user',
      JSON.stringify({ uid: 'cached-learner', email: null })
    );
    expect(getCurrentUserId()).toBe('cached-learner');
  });

  test('is null when nobody has signed in', () => {
    expect(getCurrentUserId()).toBeNull();
  });
});
