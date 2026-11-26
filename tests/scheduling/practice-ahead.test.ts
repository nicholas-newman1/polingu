import { expect, test } from 'vitest';
import getVocabularyPracticeAheadCards from '../../src/lib/vocabularyScheduler/getVocabularyPracticeAheadCards';
import getDeclensionExtraCards from '../../src/lib/declensionScheduler/getExtraCards';
import { DEFAULT_USER_FILTERS } from '../../src/types/userFilters';
import type { DeclensionCard, DeclensionReviewDataStore } from '../../src/types';
import type { VocabularyReviewDataStore, VocabularyWord } from '../../src/types/vocabulary';
import { fsrsCard, inDays, State } from '../helpers/fsrs';
import { stub, stubs } from '../helpers/stub';

// Ids 0-6 cover each case; only 4 and 5 are eligible, and 5 is due sooner.
const cases = [
  [0, fsrsCard(State.New, inDays(0))], // never studied
  [1, fsrsCard(State.Learning, inDays(0.01))], // learning step due in minutes
  [2, fsrsCard(State.Relearning, inDays(0.01))], // lapsed, relearning in minutes
  [3, fsrsCard(State.Review, inDays(-1))], // already due: belongs to the normal session
  [4, fsrsCard(State.Review, inDays(5))],
  [5, fsrsCard(State.Review, inDays(2))],
  [6, fsrsCard(State.Review, inDays(1))], // not due, but already reviewed today
] as const;
const reviewedToday = [6];

const words = stubs<VocabularyWord>(cases.map(([id]) => ({ id })));
const vocabularyStore = () =>
  stub<VocabularyReviewDataStore>({
    cards: Object.fromEntries(cases.map(([id, card]) => [id, { wordId: id, fsrsCard: card }])),
    reviewedToday: [...reviewedToday],
    newCardsToday: [],
    lastReviewDate: '',
  });

test('vocabulary review early only offers graduated, not-due cards not reviewed today', () => {
  const picked = getVocabularyPracticeAheadCards(words, vocabularyStore(), 10);
  expect(picked.map(({ word }) => word.id)).toEqual([5, 4]);
});

test('declension review early only offers graduated, not-due cards not reviewed today', () => {
  const deck = stubs<DeclensionCard>(cases.map(([id]) => ({ id, isCustom: false })));
  const cards = Object.fromEntries(cases.map(([id, card]) => [id, { cardId: id, fsrsCard: card }]));
  const { getPracticeAheadCards } = getDeclensionExtraCards(
    deck,
    stub<DeclensionReviewDataStore>({ cards, reviewedToday, newCardsToday: [] }),
    DEFAULT_USER_FILTERS.declension
  );
  expect(getPracticeAheadCards(10).map(({ card }) => card.id)).toEqual([5, 4]);
});

test('a card reviewed early is not offered again in the next round', () => {
  const store = vocabularyStore();
  const [first] = getVocabularyPracticeAheadCards(words, store, 1);
  store.reviewedToday.push(first.word.id);
  const [second] = getVocabularyPracticeAheadCards(words, store, 1);
  expect(second.word.id).not.toBe(first.word.id);
});
