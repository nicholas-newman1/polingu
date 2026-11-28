import { beforeEach, describe, expect, test, vi } from 'vitest';
import { act, waitFor } from '@testing-library/react';
import type { Card } from 'ts-fsrs';
import { useProgressStats } from '../../src/hooks/useProgressStats';
import { useReviewData, type ReviewDataContextType } from '../../src/hooks/useReviewData';
import { UserFiltersProvider, useUserFilters } from '../../src/contexts/UserFiltersContext';
import loadUserFilters from '../../src/lib/storage/loadUserFilters';
import { DEFAULT_USER_FILTERS } from '../../src/types/userFilters';
import type { CustomDeclensionCard, DeclensionCard } from '../../src/types';
import type { CustomVocabularyWord, VocabularyWord } from '../../src/types/vocabulary';
import {
  ALL_LEVELS,
  type CEFRLevel,
  type CustomSentence,
  type Sentence,
  type SentenceDirectionSettings,
} from '../../src/types/sentences';
import {
  PRESENT_FORM_KEYS,
  type ConjugationFilters,
  type PastFormKey,
  type PresentFormKey,
  type Verb,
} from '../../src/types/conjugation';
import type { TranslationDirection } from '../../src/types/common';
import { fsrsCard, inDays, State } from '../helpers/fsrs';
import { stub } from '../helpers/stub';
import { renderWithReviewData, type ReviewDataSeed } from './support/reviewDataProviders';
import { getSessionCards } from '../../src/lib/reviewSession/scheduler';
import { conjugationDeck } from '../../src/lib/reviewSession/reviewDecks';
import { getDrillableFormsForVerb } from '../../src/lib/conjugationUtils';

// The providers' live custom-collection listeners are the Firestore boundary.
vi.mock('../../src/lib/storage/customVocabulary', () => ({
  loadCustomVocabulary: vi.fn(),
  subscribeCustomVocabulary: vi.fn(),
}));
vi.mock('../../src/lib/storage/customDeclension', () => ({
  loadCustomDeclension: vi.fn(),
  subscribeCustomDeclension: vi.fn(),
}));
vi.mock('../../src/lib/storage/customSentences', () => ({
  loadCustomSentences: vi.fn(),
  subscribeCustomSentences: vi.fn(),
}));
// Saving a changed setting is the storage boundary; the providers update their state first.
vi.mock('../../src/lib/storage/reviewDeckStorage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../src/lib/storage/reviewDeckStorage')>()),
  saveDeckSettings: vi.fn(),
}));
// The learner's saved session filters.
vi.mock('../../src/lib/storage/loadUserFilters', () => ({ default: vi.fn() }));

const TODAY = '2026-03-10';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00`));
});

// --- Cards in each memory state ------------------------------------------------------

/** In review and not due for weeks: the learner knows it. */
const known = () => fsrsCard(State.Review, inDays(20));
/** In review and past its due date. */
const overdue = () => fsrsCard(State.Review, inDays(-1));
/** Just introduced; learning cards are always due unless already reviewed today. */
const learning = () => fsrsCard(State.Learning, inDays(0));
/** Forgotten after being known. */
const relearning = () => fsrsCard(State.Relearning, inDays(1));

// --- Content -----------------------------------------------------------------------

const word = (id: number | string) =>
  stub<VocabularyWord>({ id, polish: `pl-${id}`, english: `en-${id}` });
const customWord = (id: string) =>
  stub<CustomVocabularyWord>({
    id,
    isCustom: true,
    createdAt: 0,
    polish: `pl-${id}`,
    english: `en-${id}`,
  });
const words = (...ids: Array<number | string>) => ids.map(word);

const declensionCard = (id: number | string) => stub<DeclensionCard>({ id, front: `card ${id}` });
const customDeclensionCard = (id: string) =>
  stub<CustomDeclensionCard>({ id, isCustom: true, createdAt: 0, front: `card ${id}` });

const sentence = (id: string, level: CEFRLevel) =>
  stub<Sentence>({ id, level, polish: `pl-${id}`, english: `en-${id}`, tags: [] });
const customSentence = (id: string, level: CEFRLevel) =>
  stub<CustomSentence>({
    id,
    level,
    isCustom: true,
    createdAt: 0,
    polish: id,
    english: id,
    tags: [],
  });

const conjugated = <K extends string>(id: string, keys: K[]) =>
  Object.fromEntries(keys.map((key) => [key, { pl: `${id}-${key}`, en: [`${id} ${key}`] }]));

/** A verb with the given present-tense forms (all six by default) and past forms (none). */
const verb = (
  id: string,
  {
    aspectPair,
    forms = PRESENT_FORM_KEYS,
    past,
  }: { aspectPair?: string; forms?: PresentFormKey[]; past?: PastFormKey[] } = {}
) =>
  stub<Verb>({
    id,
    infinitive: id,
    aspectPair,
    conjugations: {
      present: conjugated(id, forms) as NonNullable<Verb['conjugations']['present']>,
      ...(past && { past: conjugated(id, past) as NonNullable<Verb['conjugations']['past']> }),
    },
  });
const formKey = (verbId: string, key: PresentFormKey) => `${verbId}:present:${key}`;

// --- Review stores -----------------------------------------------------------------

interface DayLists<Id> {
  reviewedToday?: Id[];
  newCardsToday?: Id[];
  lastReviewDate?: string;
}

const dayLists = <Id,>({
  reviewedToday = [],
  newCardsToday = [],
  lastReviewDate = TODAY,
}: DayLists<Id>) => ({
  reviewedToday,
  newCardsToday,
  lastReviewDate,
});

const vocabularyStore = (
  cards: Record<string, Card> = {},
  lists: DayLists<string | number> = {}
) => ({
  cards: Object.fromEntries(
    Object.entries(cards).map(([id, card]) => [id, { wordId: id, fsrsCard: card }])
  ),
  ...dayLists(lists),
});

const declensionStore = (
  cards: Record<string, Card> = {},
  lists: DayLists<string | number> = {}
) => ({
  cards: Object.fromEntries(
    Object.entries(cards).map(([id, card]) => [id, { cardId: id, fsrsCard: card }])
  ),
  ...dayLists(lists),
});

const sentenceStore = (cards: Record<string, Card> = {}, lists: DayLists<string> = {}) => ({
  cards: Object.fromEntries(
    Object.entries(cards).map(([id, card]) => [id, { sentenceId: id, fsrsCard: card }])
  ),
  ...dayLists(lists),
});

const conjugationStore = (
  forms: Record<string, Card> = {},
  {
    reviewedToday = [],
    newCardsToday = [],
  }: { reviewedToday?: string[]; newCardsToday?: string[] } = {}
) => ({
  cards: Object.fromEntries(
    Object.entries(forms).map(([key, card]) => [key, { formKey: key, fsrsCard: card }])
  ),
  reviewedToday,
  newCardsToday,
  lastReviewDate: TODAY,
});

const aspectPairsStore = (cards: Record<string, Card> = {}, lists: DayLists<string> = {}) => ({
  cards: Object.fromEntries(
    Object.entries(cards).map(([id, card]) => [id, { verbId: id, fsrsCard: card }])
  ),
  ...dayLists(lists),
});

const perDay = (plToEn: number, enToPl: number = plToEn) => ({
  'pl-to-en': { newCardsPerDay: plToEn },
  'en-to-pl': { newCardsPerDay: enToPl },
});

const sentenceSettings = (
  plToEn: Partial<SentenceDirectionSettings>,
  enToPl: Partial<SentenceDirectionSettings> = {}
) => ({
  'pl-to-en': { newCardsPerDay: 10, selectedLevels: [...ALL_LEVELS], ...plToEn },
  'en-to-pl': { newCardsPerDay: 10, selectedLevels: [...ALL_LEVELS], ...enToPl },
});

/** Renders the stats alongside the review data the stats page reads next to them. */
function renderStats(seed: ReviewDataSeed) {
  const h = renderWithReviewData(
    () => ({ stats: useProgressStats(), data: useReviewData() }),
    seed
  );
  return { ...h, stats: () => h.result.current.stats, data: () => h.result.current.data };
}

type Stats = ReturnType<typeof useProgressStats>;

const stats = (total: number, learned: number, mastered: number, due: number) => ({
  total,
  learned,
  mastered,
  due,
});

describe('useProgressStats: vocabulary', () => {
  test('counts each built-in and custom word once, matching the system + custom breakdown', () => {
    const h = renderStats({
      systemWords: words(1, 2, 3),
      customWords: [customWord('custom_a'), customWord('custom_b')],
    });

    expect(h.stats().vocabulary.total).toBe(5);
    expect(h.stats().vocabularyByDirection['pl-to-en'].total).toBe(5);
    expect(h.stats().vocabularyByDirection['en-to-pl'].total).toBe(5);
    // The stats page shows "3 system + 2 custom" under the total.
    expect(h.data().systemWords).toHaveLength(3);
    expect(h.data().customWords).toHaveLength(2);
  });

  test("words with no review data are unlearned, and due only up to each direction's daily allowance", () => {
    const h = renderStats({
      systemWords: words(1, 2, 3, 4, 5),
      vocabularySettings: perDay(3, 10),
    });

    expect(h.stats().vocabularyByDirection).toEqual({
      'pl-to-en': stats(5, 0, 0, 3),
      'en-to-pl': stats(5, 0, 0, 5),
    });
    expect(h.stats().vocabulary).toEqual(stats(5, 0, 0, 8));
  });

  test('a word is learned once started in either direction, and mastered only when known in both', () => {
    const h = renderStats({
      systemWords: words('a', 'b', 'c', 'd', 'e'),
      vocabularyStores: {
        'pl-to-en': vocabularyStore({ a: known(), b: known(), c: learning() }),
        'en-to-pl': vocabularyStore({ b: known(), c: known(), d: relearning() }),
      },
    });

    expect(h.stats().vocabularyByDirection['pl-to-en']).toMatchObject({ learned: 3, mastered: 2 });
    expect(h.stats().vocabularyByDirection['en-to-pl']).toMatchObject({ learned: 3, mastered: 2 });
    // a, b, c and d were started somewhere; only b is known both ways.
    expect(h.stats().vocabulary).toMatchObject({ total: 5, learned: 4, mastered: 1 });
  });

  test('learning and relearning words count as learned but not mastered', () => {
    const h = renderStats({
      systemWords: words('a', 'b'),
      vocabularyStores: { 'pl-to-en': vocabularyStore({ a: learning(), b: relearning() }) },
    });

    expect(h.stats().vocabularyByDirection['pl-to-en']).toMatchObject({ learned: 2, mastered: 0 });
  });

  test('due adds both directions: overdue and learning words count, words reviewed today do not', () => {
    const h = renderStats({
      systemWords: words('a', 'b', 'c', 'd', 'e'),
      vocabularySettings: perDay(0),
      vocabularyStores: {
        'pl-to-en': vocabularyStore(
          { a: overdue(), b: learning(), c: relearning(), d: overdue(), e: known() },
          { reviewedToday: ['c', 'd'] }
        ),
        'en-to-pl': vocabularyStore({
          a: learning(),
          b: known(),
          c: known(),
          d: known(),
          e: known(),
        }),
      },
    });

    expect(h.stats().vocabularyByDirection['pl-to-en'].due).toBe(2);
    expect(h.stats().vocabularyByDirection['en-to-pl'].due).toBe(1);
    expect(h.stats().vocabulary.due).toBe(3);
  });

  test('new words introduced earlier today use up the allowance, and a lowered limit admits none', () => {
    const h = renderStats({
      systemWords: words('w1', 'w2', 'w3', 'w4', 'w5', 'w6'),
      vocabularySettings: perDay(3, 1),
      vocabularyStores: {
        'pl-to-en': vocabularyStore(
          { w1: learning(), w2: learning() },
          { reviewedToday: ['w1', 'w2'], newCardsToday: ['w1', 'w2'] }
        ),
        // Two introduced today, then the limit was lowered to one.
        'en-to-pl': vocabularyStore(
          { w1: learning(), w2: learning() },
          { reviewedToday: ['w1', 'w2'], newCardsToday: ['w1', 'w2'] }
        ),
      },
    });

    expect(h.stats().vocabularyByDirection['pl-to-en'].due).toBe(1);
    expect(h.stats().vocabularyByDirection['en-to-pl'].due).toBe(0);
  });

  test('built-in words with numeric ids find review data and day lists stored under string keys', () => {
    const h = renderStats({
      systemWords: words(7, 8),
      vocabularySettings: perDay(0),
      vocabularyStores: {
        'pl-to-en': vocabularyStore({ 7: overdue(), 8: overdue() }, { reviewedToday: ['8'] }),
      },
    });

    expect(h.stats().vocabularyByDirection['pl-to-en']).toEqual(stats(2, 2, 2, 1));
  });

  test('review data left behind by a deleted custom word is not counted', () => {
    const h = renderStats({
      systemWords: words(1),
      vocabularyStores: {
        'pl-to-en': vocabularyStore({ custom_gone: known() }),
        'en-to-pl': vocabularyStore({ custom_gone: known() }),
      },
    });

    expect(h.stats().vocabulary).toMatchObject({ total: 1, learned: 0, mastered: 0 });
  });

  test('a custom word arriving from the live custom-vocabulary listener joins the totals', () => {
    const h = renderStats({ systemWords: words(1, 2), vocabularySettings: perDay(10) });
    expect(h.stats().vocabulary).toEqual(stats(2, 0, 0, 4));

    h.emitCustomWords([customWord('custom_new')]);

    expect(h.stats().vocabulary).toEqual(stats(3, 0, 0, 6));
    expect(h.data().customWords).toHaveLength(1);
  });

  test('the numbers follow fresh review data when a sync replaces the stores', () => {
    const seed: ReviewDataSeed = { systemWords: words(1, 2), vocabularySettings: perDay(0) };
    const h = renderStats(seed);
    expect(h.stats().vocabulary).toEqual(stats(2, 0, 0, 0));

    h.reseed({
      ...seed,
      vocabularyStores: {
        'pl-to-en': vocabularyStore({ 1: known(), 2: overdue() }),
        'en-to-pl': vocabularyStore({ 1: known() }),
      },
    });

    expect(h.stats().vocabulary).toEqual(stats(2, 2, 1, 1));
  });
});

describe('useProgressStats: sentences', () => {
  test('sentences outside the selected levels still count toward progress but are never due', () => {
    const h = renderStats({
      systemSentences: [sentence('s1', 'A1'), sentence('s2', 'B2'), sentence('s3', 'B2')],
      sentenceSettings: sentenceSettings({ selectedLevels: ['A1'] }),
      sentenceStores: { 'pl-to-en': sentenceStore({ s2: overdue() }) },
    });

    expect(h.stats().sentencesByDirection['pl-to-en'].total).toEqual(stats(3, 1, 1, 1));
    expect(h.stats().sentencesByDirection['en-to-pl'].total).toEqual(stats(3, 0, 0, 3));
    expect(h.stats().sentences).toEqual(stats(3, 1, 0, 4));
  });

  test('the new-card allowance goes only to sentences in the selected levels', () => {
    const h = renderStats({
      systemSentences: [
        sentence('a1', 'A1'),
        sentence('a2', 'A1'),
        sentence('b1', 'B1'),
        sentence('b2', 'B1'),
      ],
      sentenceSettings: sentenceSettings({ selectedLevels: ['B1'], newCardsPerDay: 1 }),
    });

    const plToEn = h.stats().sentencesByDirection['pl-to-en'];
    expect(plToEn.total.due).toBe(1);
    expect(plToEn.byLevel.B1.due).toBe(1);
    expect(plToEn.byLevel.A1.due).toBe(0);
  });

  test('each direction is broken down by CEFR level, listing every level', () => {
    const h = renderStats({
      systemSentences: [sentence('x', 'A1'), sentence('y', 'A1'), sentence('z', 'C1')],
      sentenceSettings: sentenceSettings({ newCardsPerDay: 0 }),
      sentenceStores: {
        'pl-to-en': sentenceStore({ x: relearning(), z: known() }, { reviewedToday: ['x'] }),
      },
    });

    const { byLevel } = h.stats().sentencesByDirection['pl-to-en'];
    expect(Object.keys(byLevel)).toEqual(ALL_LEVELS);
    expect(byLevel.A1).toEqual(stats(2, 1, 0, 0));
    expect(byLevel.C1).toEqual(stats(1, 1, 1, 0));
    for (const level of ['A2', 'B1', 'B2', 'C2'] as const) {
      expect(byLevel[level]).toEqual(stats(0, 0, 0, 0));
    }
  });

  test('custom sentences count alongside built-in ones and are mastered only when known both ways', () => {
    const h = renderStats({
      systemSentences: [sentence('sys', 'A2')],
      customSentences: [customSentence('custom_s', 'A2')],
      sentenceStores: {
        'pl-to-en': sentenceStore({ sys: known(), custom_s: known() }),
        'en-to-pl': sentenceStore({ custom_s: known() }),
      },
    });

    expect(h.stats().sentences).toMatchObject({ total: 2, learned: 2, mastered: 1 });
    expect(h.stats().sentencesByDirection['en-to-pl'].byLevel.A2).toMatchObject({
      total: 2,
      learned: 1,
      mastered: 1,
    });
  });
});

describe('useProgressStats: declension', () => {
  test('built-in and custom cards are counted once, with no second direction', () => {
    const h = renderStats({
      systemDeclensionCards: [declensionCard(1), declensionCard(2), declensionCard(3)],
      customDeclensionCards: [customDeclensionCard('custom_d1'), customDeclensionCard('custom_d2')],
      declensionSettings: { newCardsPerDay: 2 },
      declensionStore: declensionStore(
        { 1: overdue(), 2: learning(), 3: known() },
        // Card 2 was introduced today, so one new card is left for today.
        { reviewedToday: [2], newCardsToday: [2] }
      ),
    });

    // Due: card 1 (overdue) and one of the two unseen custom cards.
    expect(h.stats().declension).toEqual(stats(5, 3, 2, 2));
  });
});

describe('useProgressStats: conjugation', () => {
  test('every drillable form of every verb is a card, learned if started in either direction', () => {
    const h = renderStats({
      verbs: [verb('robic'), verb('musiec', { forms: ['1sg', '3sg'] })],
      conjugationSettings: perDay(0),
      conjugationStores: {
        'pl-to-en': conjugationStore({
          [formKey('robic', '1sg')]: known(),
          [formKey('robic', '2sg')]: known(),
        }),
        'en-to-pl': conjugationStore({
          [formKey('robic', '1sg')]: known(),
          [formKey('musiec', '3sg')]: relearning(),
        }),
      },
    });

    expect(h.stats().conjugationByDirection['pl-to-en']).toEqual(stats(8, 2, 2, 0));
    // The relearning form is due again.
    expect(h.stats().conjugationByDirection['en-to-pl']).toEqual(stats(8, 2, 1, 1));
    expect(h.stats().conjugation).toEqual(stats(8, 3, 1, 1));
  });

  test("new forms are limited by each direction's allowance minus the forms introduced today", () => {
    const introduced = [formKey('robic', '1sg'), formKey('robic', '2sg')];
    const h = renderStats({
      verbs: [verb('robic')],
      conjugationSettings: perDay(3, 2),
      conjugationStores: {
        'pl-to-en': conjugationStore(
          Object.fromEntries(introduced.map((key) => [key, learning()])),
          { reviewedToday: introduced, newCardsToday: introduced }
        ),
      },
    });

    expect(h.stats().conjugationByDirection['pl-to-en'].due).toBe(1);
    expect(h.stats().conjugationByDirection['en-to-pl'].due).toBe(2);
    expect(h.stats().conjugation.due).toBe(3);
  });
});

describe('useProgressStats: aspect pairs', () => {
  test('each aspect pair is one card, tracked under the first verb of the pair', () => {
    const h = renderStats({
      verbs: [
        verb('robic', { aspectPair: 'zrobic' }),
        verb('zrobic', { aspectPair: 'robic' }),
        verb('pisac'),
        verb('czytac', { aspectPair: 'not-loaded' }),
      ],
      aspectPairsStore: aspectPairsStore({ robic: known() }),
    });

    expect(h.stats().aspectPairs).toEqual(stats(1, 1, 1, 0));
  });

  test('unstudied pairs are due up to what is left of the daily allowance', () => {
    const h = renderStats({
      verbs: [
        verb('a1', { aspectPair: 'a2' }),
        verb('a2', { aspectPair: 'a1' }),
        verb('b1', { aspectPair: 'b2' }),
        verb('b2', { aspectPair: 'b1' }),
        verb('c1', { aspectPair: 'c2' }),
        verb('c2', { aspectPair: 'c1' }),
      ],
      aspectPairsSettings: { newCardsPerDay: 2 },
      aspectPairsStore: aspectPairsStore({}, { newCardsToday: ['earlier-pair'] }),
    });

    expect(h.stats().aspectPairs).toEqual(stats(3, 0, 0, 1));
  });
});

describe('useProgressStats: agreement with the review counts', () => {
  test('every due number matches the review count shown in the navigation', () => {
    const h = renderStats({
      systemDeclensionCards: [declensionCard(1), declensionCard(2), declensionCard(3)],
      declensionSettings: { newCardsPerDay: 1 },
      declensionStore: declensionStore({ 1: overdue() }),
      systemWords: words(1, 2, 3, 4),
      customWords: [customWord('custom_w')],
      vocabularySettings: perDay(2, 0),
      vocabularyStores: {
        'pl-to-en': vocabularyStore({ 1: overdue(), 2: learning() }, { reviewedToday: [2] }),
        'en-to-pl': vocabularyStore({ 3: learning() }),
      },
      systemSentences: [sentence('a', 'A1'), sentence('b', 'B2'), sentence('c', 'B2')],
      sentenceSettings: sentenceSettings({ selectedLevels: ['B2'], newCardsPerDay: 1 }),
      sentenceStores: { 'en-to-pl': sentenceStore({ a: overdue() }) },
      verbs: [verb('robic', { aspectPair: 'zrobic' }), verb('zrobic', { aspectPair: 'robic' })],
      conjugationSettings: perDay(4, 0),
      conjugationStores: {
        'en-to-pl': conjugationStore({ [formKey('zrobic', '3pl')]: overdue() }),
      },
      aspectPairsStore: aspectPairsStore({ robic: overdue() }),
    });

    const expected = {
      declension: 2, // card 1 overdue + one new
      vocabulary: 4, // pl-to-en: 1 overdue + 2 new; en-to-pl: 3 learning, no new allowed
      sentences: 4, // pl-to-en: one B2 new; en-to-pl: a overdue + b and c new
      conjugation: 5, // pl-to-en: four new forms; en-to-pl: one overdue form
      aspectPairs: 1,
    };
    expect(h.data().counts).toEqual(expected);
    const s = h.stats();
    expect({
      declension: s.declension.due,
      vocabulary: s.vocabulary.due,
      sentences: s.sentences.due,
      conjugation: s.conjugation.due,
      aspectPairs: s.aspectPairs.due,
    }).toEqual(expected);
  });
});

describe('useProgressStats: settings changes', () => {
  // Each case changes one section's allowance on its own, so a section whose settings
  // were left out of the hook's memo would keep showing the old number.
  test.each<[string, (d: ReviewDataContextType) => Promise<void>, (s: Stats) => number]>([
    [
      'declension',
      (d) => d.updateDeclensionSettings({ newCardsPerDay: 2 }),
      (s) => s.declension.due,
    ],
    [
      'vocabulary',
      (d) => d.updateVocabularySettings('pl-to-en', { newCardsPerDay: 2 }),
      (s) => s.vocabularyByDirection['pl-to-en'].due,
    ],
    [
      'sentences',
      (d) =>
        d.updateSentenceSettings('en-to-pl', {
          newCardsPerDay: 2,
          selectedLevels: [...ALL_LEVELS],
        }),
      (s) => s.sentencesByDirection['en-to-pl'].total.due,
    ],
    [
      'conjugation',
      (d) => d.updateConjugationSettings('en-to-pl', { newCardsPerDay: 2 }),
      (s) => s.conjugationByDirection['en-to-pl'].due,
    ],
    [
      'aspect pairs',
      (d) => d.updateAspectPairsSettings({ newCardsPerDay: 2 }),
      (s) => s.aspectPairs.due,
    ],
  ])('%s: raising the daily allowance shows the extra new cards at once', async (_, raise, due) => {
    const h = renderStats({
      systemDeclensionCards: [declensionCard(1), declensionCard(2), declensionCard(3)],
      declensionSettings: { newCardsPerDay: 0 },
      systemWords: words('a', 'b', 'c'),
      vocabularySettings: perDay(0),
      systemSentences: [sentence('x', 'A1'), sentence('y', 'A1'), sentence('z', 'A1')],
      sentenceSettings: sentenceSettings({ newCardsPerDay: 0 }, { newCardsPerDay: 0 }),
      verbs: [
        verb('a1', { aspectPair: 'a2' }),
        verb('a2', { aspectPair: 'a1' }),
        verb('b1', { aspectPair: 'b2' }),
        verb('b2', { aspectPair: 'b1' }),
        verb('c1', { aspectPair: 'c2' }),
        verb('c2', { aspectPair: 'c1' }),
      ],
      conjugationSettings: perDay(0),
      aspectPairsSettings: { newCardsPerDay: 0 },
    });
    expect(due(h.stats())).toBe(0);

    await act(() => raise(h.data()));

    expect(due(h.stats())).toBe(2);
  });
});

describe('useProgressStats: learner filters', () => {
  // A verb with two present forms and two past forms. In English to Polish, its present
  // 1sg form is overdue; everything else is unseen. Ten new forms a day each way.
  async function renderFiltered(conjugation: ConjugationFilters) {
    const filterVerbs = [verb('robic', { forms: ['1sg', '3sg'], past: ['1sg_m', '3sg_f'] })];
    const filterStores = {
      'pl-to-en': conjugationStore(),
      'en-to-pl': conjugationStore({ [formKey('robic', '1sg')]: overdue() }),
    };
    const filterSettings = perDay(10);
    vi.mocked(loadUserFilters).mockResolvedValue({ ...DEFAULT_USER_FILTERS, conjugation });
    const h = renderWithReviewData(
      () => ({ stats: useProgressStats(), filters: useUserFilters() }),
      {
        verbs: filterVerbs,
        conjugationStores: filterStores,
        conjugationSettings: filterSettings,
      },
      { wrapper: UserFiltersProvider }
    );
    await waitFor(() => expect(h.result.current.filters.filtersLoading).toBe(false));
    expect(h.result.current.filters.filters.conjugation).toEqual(conjugation);

    /** How many cards the conjugation session in `direction` serves with these filters. */
    const sessionSize = (direction: TranslationDirection) => {
      const { reviewCards, newCards } = getSessionCards(
        conjugationDeck,
        filterVerbs.flatMap(getDrillableFormsForVerb),
        filterStores[direction],
        filterSettings[direction],
        conjugation
      );
      return reviewCards.length + newCards.length;
    };
    return {
      due: (d: TranslationDirection) => h.result.current.stats.conjugationByDirection[d].due,
      sessionSize,
    };
  }

  test('without filters, each direction shows as due exactly what its session serves', async () => {
    const h = await renderFiltered(DEFAULT_USER_FILTERS.conjugation);

    expect(h.due('pl-to-en')).toBe(4);
    expect(h.due('en-to-pl')).toBe(4);
    expect(h.due('pl-to-en')).toBe(h.sessionSize('pl-to-en'));
    expect(h.due('en-to-pl')).toBe(h.sessionSize('en-to-pl'));
  });

  test('with a tense filter, the due number matches what the session serves', async () => {
    const h = await renderFiltered({ ...DEFAULT_USER_FILTERS.conjugation, tenses: ['past'] });

    expect(h.due('en-to-pl')).toBe(h.sessionSize('en-to-pl'));
  });
});

describe('useProgressStats: day boundaries', () => {
  const YESTERDAY = '2026-03-09';
  const HOUR = 36e5;

  /**
   * Late yesterday evening, with the app open: word a was reviewed and is due again early
   * this morning, word b was introduced and is still being learned, word c is unseen. One
   * new word a day from Polish to English.
   */
  function renderLateEvening() {
    vi.useRealTimers();
    // Timers too, so the night passing also fires anything scheduled for midnight.
    vi.useFakeTimers({
      toFake: ['Date', 'setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'],
    });
    vi.setSystemTime(new Date(`${YESTERDAY}T23:30:00`));
    const h = renderStats({
      systemWords: words('a', 'b', 'c'),
      vocabularySettings: perDay(1, 0),
      vocabularyStores: {
        'pl-to-en': vocabularyStore(
          { a: fsrsCard(State.Review, new Date(`${TODAY}T06:00:00`)), b: learning() },
          { reviewedToday: ['a', 'b'], newCardsToday: ['b'], lastReviewDate: YESTERDAY }
        ),
      },
    });
    /** Leaves the app open for `hours`, then opens a page showing the numbers. */
    const later = (hours: number) => {
      act(() => vi.advanceTimersByTime(hours * HOUR));
      h.remount();
    };
    return { ...h, later };
  }

  test("before midnight, the day's lists hide the cards already done and the new card used", () => {
    const h = renderLateEvening();
    expect(h.stats().vocabularyByDirection['pl-to-en'].due).toBe(0);
    expect(h.data().counts.vocabulary).toBe(0);

    h.later(0.25);

    expect(h.stats().vocabularyByDirection['pl-to-en'].due).toBe(0);
    expect(h.data().counts.vocabulary).toBe(0);
  });

  test("after midnight, yesterday's lists no longer hide the cards due today", () => {
    const h = renderLateEvening();

    h.later(8.5);

    expect(h.stats().vocabularyByDirection['pl-to-en'].due).toBe(3);
  });

  test('after midnight, the navigation count includes the cards due today', () => {
    const h = renderLateEvening();

    h.later(8.5);

    expect(h.data().counts.vocabulary).toBe(3);
  });
});
