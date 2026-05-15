import type { DeclensionCardReviewData } from '../../types';
import { createReviewSubcollectionStorage } from './createReviewSubcollectionStorage';

function serializeDeclensionCard(card: DeclensionCardReviewData): unknown {
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

function deserializeDeclensionCard(raw: unknown): DeclensionCardReviewData {
  const card = raw as DeclensionCardReviewData;
  if (card?.fsrsCard) {
    if (card.fsrsCard.due) card.fsrsCard.due = new Date(card.fsrsCard.due);
    if (card.fsrsCard.last_review) {
      card.fsrsCard.last_review = new Date(card.fsrsCard.last_review);
    }
  }
  return card;
}

export const declensionReviewStorage = createReviewSubcollectionStorage<DeclensionCardReviewData>({
  collectionName: 'declensionReviewCards',
  serialize: serializeDeclensionCard,
  deserialize: deserializeDeclensionCard,
});
