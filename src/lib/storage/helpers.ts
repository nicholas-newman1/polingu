import type { DeclensionReviewDataStore, DeclensionCardId } from '../../types';
import type { TranslationDirection } from '../../types/common';
import type { VocabularyReviewDataStore, VocabularyWordId } from '../../types/vocabulary';
import type { SentenceReviewDataStore } from '../../types/sentences';
import type { ConjugationReviewDataStore, ConjugationFormKey } from '../../types/conjugation';
import type { AspectPairsReviewDataStore } from '../../types/aspectPairs';
import { getCurrentUserId } from '../cachedAuth';

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
  return getCurrentUserId();
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

export function getVocabularyDocPath(direction: TranslationDirection): string {
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

export function getSentenceDocPath(direction: TranslationDirection): string {
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

export function getConjugationDocPath(direction: TranslationDirection): string {
  return direction === 'pl-to-en' ? 'conjugationReviewData-pl-en' : 'conjugationReviewData-en-pl';
}

export function includesVerbId(array: string[], id: string): boolean {
  return array.includes(id);
}

export function getDefaultAspectPairsReviewStore(): AspectPairsReviewDataStore {
  return {
    cards: {},
    reviewedToday: [],
    newCardsToday: [],
    lastReviewDate: getTodayString(),
  };
}
