import { createEmptyCard } from 'ts-fsrs';
import type { SentenceReviewDataStore, SentenceCardReviewData } from '../../types/sentences';

export default function getOrCreateSentenceCardReviewData(
  sentenceId: string,
  store: SentenceReviewDataStore
): SentenceCardReviewData {
  if (store.cards[sentenceId]) {
    return store.cards[sentenceId];
  }
  return {
    sentenceId,
    fsrsCard: createEmptyCard(),
  };
}
