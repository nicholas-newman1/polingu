import type { Card, ReviewDataStore, Settings } from '../../types';
import getOrCreateCardReviewData from '../storage/getOrCreateCardReviewData';
import { includesCardId } from '../storage/helpers';
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
  const customReviewCards: SessionCard[] = [];
  const customNewCards: SessionCard[] = [];
  const systemReviewCards: SessionCard[] = [];
  const systemNewCards: SessionCard[] = [];
  const remainingNewCardsToday =
    settings.newCardsPerDay - reviewStore.newCardsToday.length;

  for (const card of allCards) {
    const reviewData = getOrCreateCardReviewData(card.id, reviewStore);
    const state = reviewData.fsrsCard.state;
    const isNew = state === 0;
    const isLearning = state === 1 || state === 3;
    const isCustom = card.isCustom === true;
    const targetNewCards = isCustom ? customNewCards : systemNewCards;
    const targetReviewCards = isCustom ? customReviewCards : systemReviewCards;

    if (isNew) {
      if (
        matchesFilters(card, filters) &&
        !includesCardId(reviewStore.newCardsToday, card.id) &&
        customNewCards.length + systemNewCards.length < remainingNewCardsToday
      ) {
        targetNewCards.push({ card, reviewData, isNew: true });
      }
    } else if (isLearning) {
      if (!includesCardId(reviewStore.reviewedToday, card.id)) {
        targetReviewCards.push({ card, reviewData, isNew: false });
      }
    } else if (isDue(reviewData.fsrsCard)) {
      if (!includesCardId(reviewStore.reviewedToday, card.id)) {
        targetReviewCards.push({ card, reviewData, isNew: false });
      }
    }
  }

  customReviewCards.sort(sortByDueDate);
  systemReviewCards.sort(sortByDueDate);

  return {
    reviewCards: [...customReviewCards, ...systemReviewCards],
    newCards: [...customNewCards, ...systemNewCards],
  };
}
