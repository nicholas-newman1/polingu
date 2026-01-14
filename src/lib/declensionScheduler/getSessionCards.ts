import type { Card, ReviewDataStore, Settings } from '../../types';
import getOrCreateCardReviewData from '../storage/getOrCreateCardReviewData';
import isDue from '../fsrsUtils/isDue';
import sortByDueDate from '../fsrsUtils/sortByDueDate';
import type { Filters, SessionCard } from './types';
import matchesFilters from './matchesFilters';

export default function getSessionCards(
  allCards: Card[],
  reviewStore: ReviewDataStore,
  filters: Filters,
  settings: Settings
): { reviewCards: SessionCard[]; newCards: SessionCard[] } {
  const reviewCards: SessionCard[] = [];
  const newCards: SessionCard[] = [];
  const remainingNewCardsToday =
    settings.newCardsPerDay - reviewStore.newCardsToday.length;

  for (const card of allCards) {
    const reviewData = getOrCreateCardReviewData(card.id, reviewStore);
    const isNew = reviewData.fsrsCard.state === 0;

    if (isNew) {
      if (
        matchesFilters(card, filters) &&
        !reviewStore.newCardsToday.includes(card.id) &&
        newCards.length < remainingNewCardsToday
      ) {
        newCards.push({ card, reviewData, isNew: true });
      }
    } else if (isDue(reviewData.fsrsCard)) {
      if (!reviewStore.reviewedToday.includes(card.id)) {
        reviewCards.push({ card, reviewData, isNew: false });
      }
    }
  }

  reviewCards.sort(sortByDueDate);

  return { reviewCards, newCards };
}

