import type { Card, ReviewDataStore } from '../../types';
import getOrCreateCardReviewData from '../storage/getOrCreateCardReviewData';
import isDue from '../fsrsUtils/isDue';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import type { Filters, SessionCard } from './types';
import matchesFilters from './matchesFilters';

export default function getPracticeAheadCards(
  allCards: Card[],
  reviewStore: ReviewDataStore,
  filters: Filters,
  count: number
): SessionCard[] {
  const practiceCards: SessionCard[] = [];

  for (const card of allCards) {
    if (!matchesFilters(card, filters)) continue;

    const reviewData = getOrCreateCardReviewData(card.id, reviewStore);
    const isNew = reviewData.fsrsCard.state === 0;

    if (isNew) continue;

    const isDueCard = isDue(reviewData.fsrsCard);
    const reviewedToday = reviewStore.reviewedToday.includes(card.id);

    if (!isDueCard || reviewedToday) {
      practiceCards.push({ card, reviewData, isNew: false });
    }
  }

  practiceCards.sort(sortByDueDate);

  return practiceCards.slice(0, count);
}

