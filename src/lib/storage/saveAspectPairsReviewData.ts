import type { AspectPairsReviewDataStore } from '../../types/aspectPairs';
import { saveUserData } from '../offlineDb/userDataWrapper';

function serializeAspectPairsReviewData(data: AspectPairsReviewDataStore): unknown {
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

export default async function saveAspectPairsReviewData(
  data: AspectPairsReviewDataStore
): Promise<void> {
  await saveUserData('aspectPairsReviewData', data, serializeAspectPairsReviewData);
}
