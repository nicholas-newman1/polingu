import type { VocabularyCardReviewData } from '../../types/vocabulary';
import type { TranslationDirection } from '../../types/common';
import { createReviewSubcollectionStorage } from './createReviewSubcollectionStorage';
import type { ReviewSubcollectionStorage } from './createReviewSubcollectionStorage';

function serializeVocabularyCard(card: VocabularyCardReviewData): unknown {
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

function deserializeVocabularyCard(raw: unknown): VocabularyCardReviewData {
  const card = raw as VocabularyCardReviewData;
  if (card?.fsrsCard) {
    if (card.fsrsCard.due) card.fsrsCard.due = new Date(card.fsrsCard.due);
    if (card.fsrsCard.last_review) {
      card.fsrsCard.last_review = new Date(card.fsrsCard.last_review);
    }
  }
  return card;
}

const plToEnStorage = createReviewSubcollectionStorage<VocabularyCardReviewData>({
  collectionName: 'vocabularyReviewCards-pl-en',
  serialize: serializeVocabularyCard,
  deserialize: deserializeVocabularyCard,
});

const enToPlStorage = createReviewSubcollectionStorage<VocabularyCardReviewData>({
  collectionName: 'vocabularyReviewCards-en-pl',
  serialize: serializeVocabularyCard,
  deserialize: deserializeVocabularyCard,
});

export function vocabularyReviewStorage(
  direction: TranslationDirection
): ReviewSubcollectionStorage<VocabularyCardReviewData> {
  return direction === 'pl-to-en' ? plToEnStorage : enToPlStorage;
}
