import { describe, expect, test } from 'vitest';
import {
  ASPECT_PAIRS_SESSION_DOC_PATH,
  DECLENSION_SESSION_DOC_PATH,
  REVIEW_SESSION_DOC_PATHS,
  getConjugationSessionDocPath,
  getDefaultAspectPairsReviewStore,
  getDefaultConjugationReviewStore,
  getDefaultDeclensionReviewStore,
  getDefaultSentenceReviewStore,
  getDefaultVocabularyReviewStore,
  getSentenceSessionDocPath,
  getUserId,
  getVocabularySessionDocPath,
  includesDeclensionCardId,
  includesFormKey,
  includesSentenceId,
  includesVerbId,
  includesWordId,
} from '../../src/lib/storage/helpers';
import type { TranslationDirection } from '../../src/types/common';
import { signInFakeUser } from '../fakes/firebase';
import { freezeTime } from './fixtures';

const DIRECTIONS: TranslationDirection[] = ['pl-to-en', 'en-to-pl'];

test('every fresh review store is empty and dated with the local day', () => {
  freezeTime('2026-11-26T23:45:00-05:00'); // already the 27th in UTC
  const counters = { reviewedToday: [], lastReviewDate: '2026-11-26' };

  for (const store of [
    getDefaultVocabularyReviewStore(),
    getDefaultSentenceReviewStore(),
    getDefaultDeclensionReviewStore(),
    getDefaultAspectPairsReviewStore(),
  ]) {
    expect(store).toEqual({ cards: {}, newCardsToday: [], ...counters });
  }
  expect(getDefaultConjugationReviewStore()).toEqual({ forms: {}, newFormsToday: [], ...counters });
});

test('fresh stores never share their lists, so one direction cannot leak into another', () => {
  const a = getDefaultVocabularyReviewStore();
  const b = getDefaultVocabularyReviewStore();
  a.newCardsToday.push(1);
  a.reviewedToday.push(1);
  expect(b.newCardsToday).toEqual([]);
  expect(b.reviewedToday).toEqual([]);
  expect(b.cards).not.toBe(a.cards);
});

describe('session counter documents', () => {
  const paths = [
    ...DIRECTIONS.map(getVocabularySessionDocPath),
    ...DIRECTIONS.map(getSentenceSessionDocPath),
    ...DIRECTIONS.map(getConjugationSessionDocPath),
    ASPECT_PAIRS_SESSION_DOC_PATH,
    DECLENSION_SESSION_DOC_PATH,
  ];

  test('each module and direction keeps its daily counters in its own document', () => {
    expect(new Set(paths).size).toBe(paths.length);
  });

  test('every counter document is merged across devices rather than overwritten', () => {
    expect([...REVIEW_SESSION_DOC_PATHS].sort()).toEqual([...paths].sort());
  });
});

describe('id lookups in the daily counters', () => {
  test('word and declension ids match whether stored as numbers or strings', () => {
    expect(includesWordId(['12'], 12)).toBe(true);
    expect(includesWordId([12], '12')).toBe(true);
    expect(includesWordId([12, 'custom_5'], 'custom_5')).toBe(true);
    expect(includesWordId([12], 1)).toBe(false);
    expect(includesWordId([], 12)).toBe(false);

    expect(includesDeclensionCardId(['7'], 7)).toBe(true);
    expect(includesDeclensionCardId([7], '7')).toBe(true);
    expect(includesDeclensionCardId([70], 7)).toBe(false);
  });

  test('sentence ids, verb ids and form keys must match exactly', () => {
    expect(includesSentenceId(['s1', 's10'], 's10')).toBe(true);
    expect(includesSentenceId(['s10'], 's1')).toBe(false);
    expect(includesVerbId(['robic'], 'robic')).toBe(true);
    expect(includesVerbId(['zrobic'], 'robic')).toBe(false);
    expect(includesFormKey(['robic:past:3sg_m'], 'robic:past:3sg_m')).toBe(true);
    expect(includesFormKey(['robic:past:3sg_m'], 'robic:past:3sg_f')).toBe(false);
  });
});

describe('getUserId', () => {
  test('is the signed-in user', () => {
    signInFakeUser('learner-1');
    expect(getUserId()).toBe('learner-1');
  });

  test('falls back to the last signed-in user while offline', () => {
    localStorage.setItem(
      'polingu_cached_user',
      JSON.stringify({ uid: 'cached-learner', email: null })
    );
    expect(getUserId()).toBe('cached-learner');
  });

  test('is null when nobody has signed in', () => {
    expect(getUserId()).toBeNull();
  });
});
