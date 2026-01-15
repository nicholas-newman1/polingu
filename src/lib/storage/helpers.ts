import { auth } from '../firebase';
import type { ReviewDataStore } from '../../types';
import type {
  VocabularyReviewDataStore,
  VocabularyDirection,
} from '../../types/vocabulary';

export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function getUserId(): string | null {
  return auth.currentUser?.uid ?? null;
}

export function getDefaultReviewStore(): ReviewDataStore {
  return {
    cards: {},
    reviewedToday: [],
    newCardsToday: [],
    lastReviewDate: getTodayString(),
  };
}

export function getDefaultVocabularyReviewStore(): VocabularyReviewDataStore {
  return {
    cards: {},
    reviewedToday: [],
    newCardsToday: [],
    lastReviewDate: getTodayString(),
  };
}

export function getVocabularyDocPath(direction: VocabularyDirection): string {
  return direction === 'pl-to-en'
    ? 'vocabularyReviewData-pl-en'
    : 'vocabularyReviewData-en-pl';
}

