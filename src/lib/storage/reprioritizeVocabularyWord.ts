import type { VocabularyReviewDataStore, VocabularyWordId } from '../../types/vocabulary';
import forgetCard from '../fsrsUtils/forgetCard';
import { removeFromDayLists } from '../reviewSession/sessionLists';
import { reviewDataFor } from '../reviewSession/scheduler';
import { vocabularyDeck } from '../reviewSession/reviewDecks';
import { reprioritizeCard } from './reprioritizeCard';

/**
 * "Review again": resets a studied word and puts it first in line among the new words.
 * A word never studied in this direction is left as it is.
 */
export default function reprioritizeVocabularyWord(
  store: VocabularyReviewDataStore,
  wordId: VocabularyWordId,
  now: Date = new Date()
): VocabularyReviewDataStore {
  return reprioritizeCard(store, wordId, now, (entry) => ({
    ...forgetCard(entry, now),
    prioritizedAt: now.getTime(),
  }));
}

/**
 * "Study next": puts a word not yet studied first in line among the new words, so it is
 * introduced before the others. A word already studied is left as it is.
 */
export function prioritizeNewVocabularyWord(
  store: VocabularyReviewDataStore,
  wordId: VocabularyWordId,
  now: Date = new Date()
): VocabularyReviewDataStore {
  const key = String(wordId);
  const entry = reviewDataFor(vocabularyDeck, store, wordId);
  if (entry.fsrsCard.state !== 0) {
    return store;
  }
  const prioritized = {
    ...store,
    cards: { ...store.cards, [key]: { ...entry, prioritizedAt: now.getTime() } },
  };
  return removeFromDayLists(prioritized, wordId, now.getTime());
}
