import type { SentenceCardReviewData } from '../../types/sentences';
import type { TranslationDirection } from '../../types/common';
import { createReviewSubcollectionStorage } from './createReviewSubcollectionStorage';
import type { ReviewSubcollectionStorage } from './createReviewSubcollectionStorage';

function serializeSentenceCard(card: SentenceCardReviewData): unknown {
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

function deserializeSentenceCard(raw: unknown): SentenceCardReviewData {
  const card = raw as SentenceCardReviewData;
  if (card?.fsrsCard) {
    if (card.fsrsCard.due) card.fsrsCard.due = new Date(card.fsrsCard.due);
    if (card.fsrsCard.last_review) {
      card.fsrsCard.last_review = new Date(card.fsrsCard.last_review);
    }
  }
  return card;
}

const plToEnStorage = createReviewSubcollectionStorage<SentenceCardReviewData>({
  collectionName: 'sentenceReviewCards-pl-en',
  serialize: serializeSentenceCard,
  deserialize: deserializeSentenceCard,
});

const enToPlStorage = createReviewSubcollectionStorage<SentenceCardReviewData>({
  collectionName: 'sentenceReviewCards-en-pl',
  serialize: serializeSentenceCard,
  deserialize: deserializeSentenceCard,
});

export function sentenceReviewStorage(
  direction: TranslationDirection
): ReviewSubcollectionStorage<SentenceCardReviewData> {
  return direction === 'pl-to-en' ? plToEnStorage : enToPlStorage;
}
