import { auth } from '../firebase';
import type { DeclensionReviewDataStore, DeclensionCardId } from '../../types';
import type {
  VocabularyReviewDataStore,
  VocabularyDirection,
  VocabularyWordId,
} from '../../types/vocabulary';

export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function includesWordId(
  array: VocabularyWordId[],
  id: VocabularyWordId
): boolean {
  const idStr = String(id);
  return array.some((item) => String(item) === idStr);
}

export function includesDeclensionCardId(array: DeclensionCardId[], id: DeclensionCardId): boolean {
  const idStr = String(id);
  return array.some((item) => String(item) === idStr);
}

export function getUserId(): string | null {
  return auth.currentUser?.uid ?? null;
}

export function getDefaultDeclensionReviewStore(): DeclensionReviewDataStore {
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

