import type { SentenceReviewDataStore } from '../../types/sentences';
import type { TranslationDirection } from '../../types/common';
import { getSentenceDocPath } from './helpers';
import { saveUserDataOfflineFirst } from '../offlineDb/userDataWrapper';

function serializeSentenceReviewData(data: SentenceReviewDataStore): unknown {
  return {
    ...data,
    cards: Object.fromEntries(
      Object.entries(data.cards).map(([key, card]) => [
        key,
        {
          ...card,
          fsrsCard: {
            ...card.fsrsCard,
            due:
              card.fsrsCard.due instanceof Date
                ? card.fsrsCard.due.toISOString()
                : card.fsrsCard.due,
            last_review:
              card.fsrsCard.last_review instanceof Date
                ? card.fsrsCard.last_review.toISOString()
                : card.fsrsCard.last_review,
          },
        },
      ])
    ),
  };
}

export default async function saveSentenceReviewData(
  data: SentenceReviewDataStore,
  direction: TranslationDirection
): Promise<void> {
  await saveUserDataOfflineFirst(getSentenceDocPath(direction), data, serializeSentenceReviewData);
}
