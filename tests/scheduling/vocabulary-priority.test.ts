import { beforeEach, describe, expect, test } from 'vitest';
import { createEmptyCard } from 'ts-fsrs';
import getVocabularySessionCards from '../../src/lib/vocabularyScheduler/getVocabularySessionCards';
import getVocabularyExtraNewCards from '../../src/lib/vocabularyScheduler/getVocabularyExtraNewCards';
import { prioritizeNewVocabularyWord } from '../../src/lib/storage/reprioritizeVocabularyWord';
import { getDefaultVocabularyReviewStore } from '../../src/lib/storage/helpers';
import type { VocabularySessionCard } from '../../src/lib/vocabularyScheduler/types';
import type { VocabularyReviewDataStore, VocabularyWord } from '../../src/types/vocabulary';
import { stubs } from '../helpers/stub';
import { freezeTime, NOW } from './fixtures';

beforeEach(() => freezeTime());

/** Two custom words, then built-in words 1-5, none of them seen yet. */
const words = stubs<VocabularyWord>([
  { id: 'custom_a', isCustom: true },
  { id: 'custom_b', isCustom: true },
  ...[1, 2, 3, 4, 5].map((id) => ({ id })),
]);

const ids = (cards: VocabularySessionCard[]) => cards.map((c) => c.word.id);

const prioritized = (store: VocabularyReviewDataStore, wordId: number, at: number) => ({
  ...store,
  cards: {
    ...store.cards,
    [wordId]: { wordId, fsrsCard: createEmptyCard(NOW), prioritizedAt: at },
  },
});

describe('words asked to be studied next', () => {
  test('without any, custom words come first, then built-in words in deck order', () => {
    const { newCards } = getVocabularySessionCards(words, getDefaultVocabularyReviewStore(), {
      newCardsPerDay: 4,
    });
    expect(ids(newCards)).toEqual(['custom_a', 'custom_b', 1, 2]);
  });

  test('are introduced before every other new word, most recent request first', () => {
    let store = getDefaultVocabularyReviewStore();
    store = prioritized(store, 5, NOW.getTime() - 1000);
    store = prioritized(store, 4, NOW.getTime());

    const { newCards } = getVocabularySessionCards(words, store, { newCardsPerDay: 4 });
    expect(ids(newCards)).toEqual([4, 5, 'custom_a', 'custom_b']);
  });

  test('still count toward the daily new-word limit', () => {
    const store = prioritizeNewVocabularyWord(getDefaultVocabularyReviewStore(), 5, NOW);

    const { newCards } = getVocabularySessionCards(words, store, { newCardsPerDay: 1 });
    expect(ids(newCards)).toEqual([5]);
  });

  test('are also first when learning extra words', () => {
    const store = prioritizeNewVocabularyWord(getDefaultVocabularyReviewStore(), 3, NOW);

    expect(ids(getVocabularyExtraNewCards(words, store, 2))).toEqual([3, 'custom_a']);
  });
});
