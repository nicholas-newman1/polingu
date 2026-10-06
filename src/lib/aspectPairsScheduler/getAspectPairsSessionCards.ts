import type {
  AspectPairCard,
  AspectPairsReviewDataStore,
  AspectPairsSettings,
} from '../../types/aspectPairs';
import getOrCreateAspectPairsCardReviewData from '../storage/getOrCreateAspectPairsCardReviewData';
import { includesVerbId } from '../storage/helpers';
import getReviewBucket from '../fsrsUtils/getReviewBucket';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import type { AspectPairsSessionCard } from './types';

export default function getAspectPairsSessionCards(
  aspectPairCards: AspectPairCard[],
  reviewStore: AspectPairsReviewDataStore,
  settings: AspectPairsSettings
): { reviewCards: AspectPairsSessionCard[]; newCards: AspectPairsSessionCard[] } {
  const reviewCards: AspectPairsSessionCard[] = [];
  const newCards: AspectPairsSessionCard[] = [];
  const remainingNewCardsToday = settings.newCardsPerDay - reviewStore.newCardsToday.length;

  for (const card of aspectPairCards) {
    const verbId = card.verb.id;
    const reviewData = getOrCreateAspectPairsCardReviewData(verbId, reviewStore);
    const bucket = getReviewBucket(
      reviewData.fsrsCard,
      includesVerbId(reviewStore.newCardsToday, verbId),
      includesVerbId(reviewStore.reviewedToday, verbId)
    );

    if (bucket === 'new' && newCards.length < remainingNewCardsToday) {
      newCards.push({ card, reviewData, isNew: true });
    } else if (bucket === 'review') {
      reviewCards.push({ card, reviewData, isNew: false });
    }
  }

  reviewCards.sort(sortByDueDate);

  return { reviewCards, newCards };
}
