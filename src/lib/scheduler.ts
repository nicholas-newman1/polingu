import type { Card, CardReviewData, ReviewDataStore, Settings } from '../types';
import { getOrCreateCardReviewData } from './storage';
import {
  Rating,
  isDue,
  sortByDueDate,
  getNextIntervals,
  rateCard,
} from './fsrsUtils';
import type { Case, Gender, Number } from '../types';

export { Rating, getNextIntervals };

export interface Filters {
  case: Case | 'All';
  gender: Gender | 'All';
  number: Number | 'All';
}

export interface SessionCard {
  card: Card;
  reviewData: CardReviewData;
  isNew: boolean;
}

function matchesFilters(card: Card, filters: Filters): boolean {
  if (filters.case !== 'All' && card.case !== filters.case) return false;
  if (filters.gender !== 'All' && card.gender !== filters.gender) return false;
  if (filters.number !== 'All' && card.number !== filters.number) return false;
  return true;
}

export function getSessionCards(
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

export function getPracticeAheadCards(
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

export function getExtraNewCards(
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

export { rateCard };
