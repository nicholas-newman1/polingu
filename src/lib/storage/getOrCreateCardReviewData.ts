import { createEmptyCard } from 'ts-fsrs';
import type { ReviewDataStore, CardReviewData } from '../../types';

export default function getOrCreateCardReviewData(
  cardId: number,
  store: ReviewDataStore
): CardReviewData {
  if (store.cards[cardId]) {
    return store.cards[cardId];
  }
  return {
    cardId,
    fsrsCard: createEmptyCard(),
  };
}

