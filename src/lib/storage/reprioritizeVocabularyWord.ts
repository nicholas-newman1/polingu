import type { VocabularyReviewDataStore, VocabularyWordId } from '../../types/vocabulary';
import type { TranslationDirection } from '../../types/common';
import forgetCard from '../fsrsUtils/forgetCard';
import { removeFromDayLists } from '../reviewSession/sessionLists';
import getOrCreateVocabularyCardReviewData from './getOrCreateVocabularyCardReviewData';

export function canReprioritizeVocabularyWord(
  stores: Record<TranslationDirection, VocabularyReviewDataStore>,
  wordId: VocabularyWordId
): boolean {
  const key = String(wordId);
  const plToEn = stores['pl-to-en'].cards[key];
  const enToPl = stores['en-to-pl'].cards[key];
  return Boolean(
    (plToEn && plToEn.fsrsCard.state !== 0) || (enToPl && enToPl.fsrsCard.state !== 0)
  );
}

/**
 * "Review again": resets a studied word and puts it first in line among the new words.
 * A word never studied in this direction is left as it is.
 */
export default function reprioritizeVocabularyWord(
  store: VocabularyReviewDataStore,
  wordId: VocabularyWordId,
  now: Date = new Date()
): VocabularyReviewDataStore {
  const key = String(wordId);
  const entry = store.cards[key];
  if (!entry || entry.fsrsCard.state === 0) {
    return store;
  }
  const forgotten = { ...forgetCard(entry, now), prioritizedAt: now.getTime() };
  return removeFromDayLists(
    { ...store, cards: { ...store.cards, [key]: forgotten } },
    wordId,
    now.getTime()
  );
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
  const entry = getOrCreateVocabularyCardReviewData(wordId, store);
  if (entry.fsrsCard.state !== 0) {
    return store;
  }
  const prioritized = {
    ...store,
    cards: { ...store.cards, [key]: { ...entry, prioritizedAt: now.getTime() } },
  };
  return removeFromDayLists(prioritized, wordId, now.getTime());
}
