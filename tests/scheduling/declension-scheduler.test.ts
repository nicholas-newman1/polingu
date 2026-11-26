import { beforeEach, expect, test } from 'vitest';
import getDeclensionSessionCards from '../../src/lib/declensionScheduler/getSessionCards';
import getDeclensionExtraCards from '../../src/lib/declensionScheduler/getExtraCards';
import matchesDeclensionFilters from '../../src/lib/declensionScheduler/matchesFilters';
import type { DeclensionFilters } from '../../src/lib/declensionScheduler/types';
import type { DeclensionCard, DeclensionReviewDataStore } from '../../src/types';
import { freezeTime, graduated, learning, TODAY } from './fixtures';
import { stub } from '../helpers/stub';

beforeEach(() => freezeTime());

const noFilters: DeclensionFilters = { cases: [], genders: [], number: 'All' };

const card = (id: DeclensionCard['id'], overrides: Partial<DeclensionCard> = {}) =>
  stub<DeclensionCard>({
    id,
    case: 'Genitive',
    gender: 'Feminine',
    number: 'Singular',
    ...overrides,
  });

const store = (overrides: Partial<DeclensionReviewDataStore> = {}) =>
  stub<DeclensionReviewDataStore>({
    cards: {},
    reviewedToday: [],
    newCardsToday: [],
    lastReviewDate: TODAY,
    ...overrides,
  });

const reviewData = (cardId: DeclensionCard['id'], fsrsCard = graduated(-1)) => ({
  cardId,
  fsrsCard,
});

test.each<[string, DeclensionFilters, boolean]>([
  ['no filters', noFilters, true],
  ['its case among several', { ...noFilters, cases: ['Dative', 'Genitive'] }, true],
  ['another case', { ...noFilters, cases: ['Dative'] }, false],
  ['its gender', { ...noFilters, genders: ['Feminine'] }, true],
  ['another gender', { ...noFilters, genders: ['Masculine', 'Neuter'] }, false],
  ['its number', { ...noFilters, number: 'Singular' }, true],
  ['the other number', { ...noFilters, number: 'Plural' }, false],
  [
    'its case but another gender',
    { cases: ['Genitive'], genders: ['Masculine'], number: 'All' },
    false,
  ],
  [
    'case, gender and number all matching',
    { cases: ['Genitive'], genders: ['Feminine'], number: 'Singular' },
    true,
  ],
])('a feminine genitive singular card with %s matches: %s', (_, filters, expected) => {
  expect(matchesDeclensionFilters(card(1), filters)).toBe(expected);
});

test('filters narrow the new cards but never hide a due review', () => {
  const deck = [
    card(1, { case: 'Dative' }),
    card(2, { case: 'Genitive' }),
    card(3, { case: 'Dative' }),
    card(4, { case: 'Genitive' }),
  ];
  const session = getDeclensionSessionCards(
    deck,
    store({ cards: { 3: reviewData(3), 4: reviewData(4) } }),
    { ...noFilters, cases: ['Genitive'] },
    { newCardsPerDay: 10 }
  );

  expect(session.newCards.map(({ card }) => card.id)).toEqual([2]);
  expect(session.reviewCards.map(({ card }) => card.id).sort()).toEqual([3, 4]);
});

test('new cards introduced today under another filter still use up the daily allowance', () => {
  // The learner introduced two Dative cards, then switched the filter to Genitive.
  const deck = [
    card(1, { case: 'Dative' }),
    card(2, { case: 'Dative' }),
    ...[3, 4, 5, 6].map((id) => card(id, { case: 'Genitive' })),
  ];
  const session = getDeclensionSessionCards(
    deck,
    store({
      cards: { 1: reviewData(1, learning(10)), 2: reviewData(2, learning(10)) },
      newCardsToday: [1, 2],
      reviewedToday: [1, 2],
    }),
    { ...noFilters, cases: ['Genitive'] },
    { newCardsPerDay: 3 }
  );

  expect(session.newCards).toHaveLength(1);
  expect(session.newCards[0].card.case).toBe('Genitive');
  expect(session.reviewCards).toEqual([]);
});

test('review early and extra new cards only offer cards matching the filters', () => {
  const deck = [
    card(1, { number: 'Plural' }),
    card(2, { number: 'Singular' }),
    card(3, { number: 'Plural' }),
    card(4, { number: 'Singular' }),
  ];
  const extras = getDeclensionExtraCards(
    deck,
    store({ cards: { 3: reviewData(3, graduated(2)), 4: reviewData(4, graduated(2)) } }),
    { ...noFilters, number: 'Plural' }
  );

  expect(extras.getPracticeAheadCards(10).map(({ card }) => card.id)).toEqual([3]);
  expect(extras.getExtraNewCards(10).map(({ card }) => card.id)).toEqual([1]);
});

test('custom cards take the new-card places even when listed after built-in ones', () => {
  const deck = [
    ...Array.from({ length: 6 }, (_, i) => card(i)),
    card('custom_1', { isCustom: true }),
    card('custom_2', { isCustom: true }),
  ];
  const session = getDeclensionSessionCards(deck, store(), noFilters, { newCardsPerDay: 3 });
  const picked = session.newCards.map(({ card }) => card);

  expect(picked).toHaveLength(3);
  expect(picked.slice(0, 2).map(({ id }) => id)).toEqual(
    expect.arrayContaining(['custom_1', 'custom_2'])
  );
  expect(picked[2].isCustom).toBeFalsy();
});

test('extra new cards also put custom cards first when listed after built-in ones', () => {
  const deck = [card(1), card(2), card('custom_1', { isCustom: true })];
  const [first, ...rest] = getDeclensionExtraCards(deck, store(), noFilters).getExtraNewCards(3);
  expect(first.card.id).toBe('custom_1');
  expect(rest.map(({ card }) => card.id).sort()).toEqual([1, 2]);
});

test('a built-in card with a numeric id matches counters stored as strings', () => {
  // Ids come back from Firestore and IndexedDB as strings for built-in cards too.
  const deck = [card(7), card(8), card(9)];
  const session = getDeclensionSessionCards(
    deck,
    store({
      cards: { 7: reviewData(7, graduated(-1)), 8: reviewData(8, learning(10)) },
      reviewedToday: ['7'],
      newCardsToday: ['8', '9'],
    }),
    noFilters,
    { newCardsPerDay: 10 }
  );

  expect(session.reviewCards.map(({ card }) => card.id)).toEqual([8]);
  expect(session.newCards).toEqual([]);
});

test('every session card carries the review data the store holds for it', () => {
  const stored = reviewData(5, graduated(-2));
  const session = getDeclensionSessionCards(
    [card(5), card(6)],
    store({ cards: { 5: stored } }),
    noFilters,
    { newCardsPerDay: 10 }
  );

  expect(session.reviewCards).toEqual([{ card: card(5), reviewData: stored, isNew: false }]);
  expect(session.newCards).toEqual([
    { card: card(6), reviewData: { cardId: 6, fsrsCard: expect.anything() }, isNew: true },
  ]);
  expect(session.newCards[0].reviewData.fsrsCard.state).toBe(0);
});
