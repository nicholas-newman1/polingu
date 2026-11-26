import type { AspectPairCard, AspectPairsReviewDataStore } from '../../types/aspectPairs';
import getOrCreateAspectPairsCardReviewData from '../storage/getOrCreateAspectPairsCardReviewData';
import { includesVerbId } from '../storage/helpers';
import isPracticeAheadCandidate from '../fsrsUtils/isPracticeAheadCandidate';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import type { AspectPairsSessionCard } from './types';

export default function getAspectPairsPracticeAheadCards(
  aspectPairCards: AspectPairCard[],
  reviewStore: AspectPairsReviewDataStore,
  count: number
): AspectPairsSessionCard[] {
  const practiceCards: AspectPairsSessionCard[] = [];

  for (const card of aspectPairCards) {
    const verbId = card.verb.id;
    const reviewData = getOrCreateAspectPairsCardReviewData(verbId, reviewStore);
    const reviewedToday = includesVerbId(reviewStore.reviewedToday, verbId);
    if (!isPracticeAheadCandidate(reviewData.fsrsCard, reviewedToday)) continue;

    practiceCards.push({ card, reviewData, isNew: false });
  }

  practiceCards.sort(sortByDueDate);

  return practiceCards.slice(0, count);
}
