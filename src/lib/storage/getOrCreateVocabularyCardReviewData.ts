import { createEmptyCard } from 'ts-fsrs';
import type {
  VocabularyReviewDataStore,
  VocabularyCardReviewData,
  VocabularyWordId,
} from '../../types/vocabulary';

export default function getOrCreateVocabularyCardReviewData(
  wordId: VocabularyWordId,
  store: VocabularyReviewDataStore
): VocabularyCardReviewData {
  const key = String(wordId);
  if (store.cards[key]) {
    return store.cards[key];
  }
  return {
    wordId,
    fsrsCard: createEmptyCard(),
  };
}
