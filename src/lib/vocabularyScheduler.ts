import type {
  VocabularyWord,
  VocabularyCardReviewData,
  VocabularyReviewDataStore,
  VocabularySettings,
} from '../types/vocabulary';
import { getOrCreateVocabularyCardReviewData } from './storage';
import {
  Rating,
  isDue,
  sortByDueDate,
  getNextIntervals as getNextIntervalsBase,
  rateCard,
} from './fsrsUtils';

export { Rating };
export const getVocabularyNextIntervals = getNextIntervalsBase;

export interface VocabularySessionCard {
  word: VocabularyWord;
  reviewData: VocabularyCardReviewData;
  isNew: boolean;
}

export function getVocabularySessionCards(
  allWords: VocabularyWord[],
  reviewStore: VocabularyReviewDataStore,
  settings: VocabularySettings
): { reviewCards: VocabularySessionCard[]; newCards: VocabularySessionCard[] } {
  const reviewCards: VocabularySessionCard[] = [];
  const newCards: VocabularySessionCard[] = [];
  const remainingNewCardsToday =
    settings.newCardsPerDay - reviewStore.newCardsToday.length;

  for (const word of allWords) {
    const reviewData = getOrCreateVocabularyCardReviewData(
      word.id,
      reviewStore
    );
    const isNew = reviewData.fsrsCard.state === 0;

    if (isNew) {
      if (
        !reviewStore.newCardsToday.includes(word.id) &&
        newCards.length < remainingNewCardsToday
      ) {
        newCards.push({ word, reviewData, isNew: true });
      }
    } else if (isDue(reviewData.fsrsCard)) {
      if (!reviewStore.reviewedToday.includes(word.id)) {
        reviewCards.push({ word, reviewData, isNew: false });
      }
    }
  }

  reviewCards.sort(sortByDueDate);

  return { reviewCards, newCards };
}

export function getVocabularyPracticeAheadCards(
  allWords: VocabularyWord[],
  reviewStore: VocabularyReviewDataStore,
  count: number
): VocabularySessionCard[] {
  const practiceCards: VocabularySessionCard[] = [];

  for (const word of allWords) {
    const reviewData = getOrCreateVocabularyCardReviewData(
      word.id,
      reviewStore
    );
    const isNew = reviewData.fsrsCard.state === 0;

    if (isNew) continue;

    const isDueCard = isDue(reviewData.fsrsCard);
    const reviewedToday = reviewStore.reviewedToday.includes(word.id);

    if (!isDueCard || reviewedToday) {
      practiceCards.push({ word, reviewData, isNew: false });
    }
  }

  practiceCards.sort(sortByDueDate);

  return practiceCards.slice(0, count);
}

export function getVocabularyExtraNewCards(
  allWords: VocabularyWord[],
  reviewStore: VocabularyReviewDataStore,
  count: number
): VocabularySessionCard[] {
  const newCards: VocabularySessionCard[] = [];

  for (const word of allWords) {
    const reviewData = getOrCreateVocabularyCardReviewData(
      word.id,
      reviewStore
    );
    const isNew = reviewData.fsrsCard.state === 0;

    if (isNew && !reviewStore.newCardsToday.includes(word.id)) {
      newCards.push({ word, reviewData, isNew: true });
      if (newCards.length >= count) break;
    }
  }

  return newCards;
}

export function rateVocabularyCard(
  reviewData: VocabularyCardReviewData,
  rating: Parameters<typeof rateCard>[1],
  now?: Date
): VocabularyCardReviewData {
  return rateCard(reviewData, rating, now);
}
