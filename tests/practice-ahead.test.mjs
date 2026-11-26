import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmptyCard, State } from 'ts-fsrs';
import getVocabularyPracticeAheadCards from '../src/lib/vocabularyScheduler/getVocabularyPracticeAheadCards.ts';
import getDeclensionExtraCards from '../src/lib/declensionScheduler/getExtraCards.ts';
import { DEFAULT_USER_FILTERS } from '../src/types/userFilters.ts';

const DAY = 864e5;
const inDays = (days) => new Date(Date.now() + days * DAY);
const fsrsCard = (state, due) => ({ ...createEmptyCard(), state, due });

// Ids 0-5 cover each case; only 4 and 5 are eligible, and 5 is due sooner.
const cases = [
  [0, fsrsCard(State.New, inDays(0))], // never studied
  [1, fsrsCard(State.Learning, inDays(0.01))], // learning step due in minutes
  [2, fsrsCard(State.Relearning, inDays(0.01))], // lapsed, relearning in minutes
  [3, fsrsCard(State.Review, inDays(-1))], // already due: belongs to the normal session
  [4, fsrsCard(State.Review, inDays(5))],
  [5, fsrsCard(State.Review, inDays(2))],
  [6, fsrsCard(State.Review, inDays(1))], // not due, but already reviewed today
];
const reviewedToday = [6];

test('vocabulary review early only offers graduated, not-due cards not reviewed today', () => {
  const words = cases.map(([id]) => ({ id }));
  const cards = Object.fromEntries(cases.map(([id, card]) => [id, { wordId: id, fsrsCard: card }]));
  const picked = getVocabularyPracticeAheadCards(
    words,
    { cards, reviewedToday, newCardsToday: [], lastReviewDate: '' },
    10
  );
  assert.deepEqual(
    picked.map(({ word }) => word.id),
    [5, 4]
  );
});

test('declension review early only offers graduated, not-due cards not reviewed today', () => {
  const deck = cases.map(([id]) => ({ id, isCustom: false }));
  const cards = Object.fromEntries(cases.map(([id, card]) => [id, { cardId: id, fsrsCard: card }]));
  const { getPracticeAheadCards } = getDeclensionExtraCards(
    deck,
    { cards, reviewedToday, newCardsToday: [] },
    DEFAULT_USER_FILTERS.declension
  );
  assert.deepEqual(
    getPracticeAheadCards(10).map(({ card }) => card.id),
    [5, 4]
  );
});

test('a card reviewed early is not offered again in the next round', () => {
  const words = cases.map(([id]) => ({ id }));
  const cards = Object.fromEntries(cases.map(([id, card]) => [id, { wordId: id, fsrsCard: card }]));
  const store = { cards, reviewedToday: [...reviewedToday], newCardsToday: [], lastReviewDate: '' };
  const [first] = getVocabularyPracticeAheadCards(words, store, 1);
  store.reviewedToday.push(first.word.id);
  const [second] = getVocabularyPracticeAheadCards(words, store, 1);
  assert.notEqual(second.word.id, first.word.id);
});
