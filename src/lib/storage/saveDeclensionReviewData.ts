import type { DeclensionReviewDataStore } from '../../types';
import { saveUserDataOfflineFirst } from '../offlineDb/userDataWrapper';

function serializeDeclensionReviewData(data: DeclensionReviewDataStore): unknown {
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

export default async function saveDeclensionReviewData(
  data: DeclensionReviewDataStore
): Promise<void> {
  await saveUserDataOfflineFirst('reviewData', data, serializeDeclensionReviewData);
}
