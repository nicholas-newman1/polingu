import { createEmptyCard } from 'ts-fsrs';
import type {
  VocabularyReviewDataStore,
  VocabularyCardReviewData,
} from '../../types/vocabulary';

export default function getOrCreateVocabularyCardReviewData(
  wordId: number,
  store: VocabularyReviewDataStore
): VocabularyCardReviewData {
  if (store.cards[wordId]) {
    return store.cards[wordId];
  }
  return {
    wordId,
    fsrsCard: createEmptyCard(),
  };
}

