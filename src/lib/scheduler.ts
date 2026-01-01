import {
  fsrs,
  Rating,
  type Card as FSRSCard,
  type RecordLogItem,
  type Grade,
} from 'ts-fsrs';
import type {
  Card,
  CardReviewData,
  ReviewDataStore,
  Settings,
  Case,
  Gender,
  Number,
} from '../types';
import { getOrCreateCardReviewData } from './storage';

const f = fsrs();

export { Rating };

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

function isDue(fsrsCard: FSRSCard): boolean {
  if (fsrsCard.state === 0) return false;
  return new Date(fsrsCard.due) <= new Date();
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

  reviewCards.sort((a, b) => {
    const dateA = new Date(a.reviewData.fsrsCard.due).getTime();
    const dateB = new Date(b.reviewData.fsrsCard.due).getTime();
    return dateA - dateB;
  });

  return { reviewCards, newCards };
}

export function rateCard(
  reviewData: CardReviewData,
  rating: Grade,
  now: Date = new Date()
): CardReviewData {
  const result = f.repeat(reviewData.fsrsCard, now);
  const item: RecordLogItem = result[rating];
  return {
    ...reviewData,
    fsrsCard: item.card,
    log: item.log,
  };
}

export function getNextIntervals(
  fsrsCard: FSRSCard,
  now: Date = new Date()
): Record<Grade, string> {
  const result = f.repeat(fsrsCard, now);

  const formatInterval = (card: FSRSCard): string => {
    const due = new Date(card.due);
    const diffMs = due.getTime() - now.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);

    if (diffMins < 1) return '<1m';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  return {
    [Rating.Again]: formatInterval(result[Rating.Again].card),
    [Rating.Hard]: formatInterval(result[Rating.Hard].card),
    [Rating.Good]: formatInterval(result[Rating.Good].card),
    [Rating.Easy]: formatInterval(result[Rating.Easy].card),
  };
}
