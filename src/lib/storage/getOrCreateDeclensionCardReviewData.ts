import { createEmptyCard } from 'ts-fsrs';
import type {
  DeclensionReviewDataStore,
  DeclensionCardReviewData,
  DeclensionCardId,
} from '../../types';

export default function getOrCreateDeclensionCardReviewData(
  cardId: DeclensionCardId,
  store: DeclensionReviewDataStore
): DeclensionCardReviewData {
  if (store.cards[cardId]) {
    return store.cards[cardId];
  }
  return {
    cardId,
    fsrsCard: createEmptyCard(),
  };
}
