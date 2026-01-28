import { auth } from '../firebase';
import type { DeclensionReviewDataStore, DeclensionCardId } from '../../types';
import type {
  VocabularyReviewDataStore,
  VocabularyDirection,
  VocabularyWordId,
} from '../../types/vocabulary';
import type { SentenceReviewDataStore, SentenceDirection } from '../../types/sentences';
import type {
  ConjugationReviewDataStore,
  ConjugationDirection,
  ConjugationFormKey,
} from '../../types/conjugation';

export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

export function includesWordId(array: VocabularyWordId[], id: VocabularyWordId): boolean {
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
  return direction === 'pl-to-en' ? 'vocabularyReviewData-pl-en' : 'vocabularyReviewData-en-pl';
}

export function includesSentenceId(array: string[], id: string): boolean {
  return array.includes(id);
}

export function getDefaultSentenceReviewStore(): SentenceReviewDataStore {
  return {
    cards: {},
    reviewedToday: [],
    newCardsToday: [],
    lastReviewDate: getTodayString(),
  };
}

export function getSentenceDocPath(direction: SentenceDirection): string {
  return direction === 'pl-to-en' ? 'sentenceReviewData-pl-en' : 'sentenceReviewData-en-pl';
}

export function includesFormKey(array: ConjugationFormKey[], key: ConjugationFormKey): boolean {
  return array.includes(key);
}

export function getDefaultConjugationReviewStore(): ConjugationReviewDataStore {
  return {
    forms: {},
    reviewedToday: [],
    newFormsToday: [],
    lastReviewDate: getTodayString(),
  };
}

export function getConjugationDocPath(direction: ConjugationDirection): string {
  return direction === 'pl-to-en' ? 'conjugationReviewData-pl-en' : 'conjugationReviewData-en-pl';
}
