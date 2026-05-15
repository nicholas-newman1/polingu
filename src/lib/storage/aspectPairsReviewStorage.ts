import type { AspectPairsCardReviewData } from '../../types/aspectPairs';
import { createReviewSubcollectionStorage } from './createReviewSubcollectionStorage';

function serializeAspectPairsCard(card: AspectPairsCardReviewData): unknown {
  return {
    ...card,
    fsrsCard: {
      ...card.fsrsCard,
      due: card.fsrsCard.due instanceof Date ? card.fsrsCard.due.toISOString() : card.fsrsCard.due,
      last_review:
        card.fsrsCard.last_review instanceof Date
          ? card.fsrsCard.last_review.toISOString()
          : card.fsrsCard.last_review,
    },
  };
}

function deserializeAspectPairsCard(raw: unknown): AspectPairsCardReviewData {
  const card = raw as AspectPairsCardReviewData;
  if (card?.fsrsCard) {
    if (card.fsrsCard.due) card.fsrsCard.due = new Date(card.fsrsCard.due);
    if (card.fsrsCard.last_review) {
      card.fsrsCard.last_review = new Date(card.fsrsCard.last_review);
    }
  }
  return card;
}

export const aspectPairsReviewStorage = createReviewSubcollectionStorage<AspectPairsCardReviewData>(
  {
    collectionName: 'aspectPairsReviewCards',
    serialize: serializeAspectPairsCard,
    deserialize: deserializeAspectPairsCard,
  }
);
