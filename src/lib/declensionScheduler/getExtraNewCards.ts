import type { Card, ReviewDataStore } from '../../types';
import getOrCreateCardReviewData from '../storage/getOrCreateCardReviewData';
import type { Filters, SessionCard } from './types';
import matchesFilters from './matchesFilters';

export default function getExtraNewCards(
  allCards: Card[],
  reviewStore: ReviewDataStore,
  filters: Filters,
  count: number
): SessionCard[] {
  const newCards: SessionCard[] = [];

  for (const card of allCards) {
    if (!matchesFilters(card, filters)) continue;

    const reviewData = getOrCreateCardReviewData(card.id, reviewStore);
    const isNew = reviewData.fsrsCard.state === 0;

    if (isNew && !reviewStore.newCardsToday.includes(card.id)) {
      newCards.push({ card, reviewData, isNew: true });
      if (newCards.length >= count) break;
    }
  }

  return newCards;
}

