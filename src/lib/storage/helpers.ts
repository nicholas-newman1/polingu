import type { DeclensionReviewDataStore, DeclensionCardId } from '../../types';
import type { TranslationDirection } from '../../types/common';
import type { VocabularyReviewDataStore, VocabularyWordId } from '../../types/vocabulary';
import type { SentenceReviewDataStore } from '../../types/sentences';
import type { ConjugationReviewDataStore, ConjugationFormKey } from '../../types/conjugation';
import type { AspectPairsReviewDataStore } from '../../types/aspectPairs';
import { getCurrentUserId } from '../cachedAuth';

/**
 * Local calendar date as YYYY-MM-DD. Daily review counters roll over at the
 * user's midnight, not UTC midnight.
 */
export function getTodayString(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
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

export function getVocabularySessionDocPath(direction: TranslationDirection): string {
  return direction === 'pl-to-en'
    ? 'vocabularyReviewSession-pl-en'
    : 'vocabularyReviewSession-en-pl';
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

export function getSentenceSessionDocPath(direction: TranslationDirection): string {
  return direction === 'pl-to-en' ? 'sentenceReviewSession-pl-en' : 'sentenceReviewSession-en-pl';
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

export function getConjugationSessionDocPath(direction: TranslationDirection): string {
  return direction === 'pl-to-en'
    ? 'conjugationReviewSession-pl-en'
    : 'conjugationReviewSession-en-pl';
}

export const ASPECT_PAIRS_SESSION_DOC_PATH = 'aspectPairsReviewSession';
export const DECLENSION_SESSION_DOC_PATH = 'declensionReviewSession';

export function includesVerbId(array: string[], id: string): boolean {
  return array.includes(id);
}

/**
 * Docs holding per-day review counters. Two devices can both append to these on
 * the same day, so writes to them are merged against the server copy rather
 * than overwriting it.
 */
export const REVIEW_SESSION_DOC_PATHS = new Set<string>([
  getSentenceSessionDocPath('pl-to-en'),
  getSentenceSessionDocPath('en-to-pl'),
  getVocabularySessionDocPath('pl-to-en'),
  getVocabularySessionDocPath('en-to-pl'),
  getConjugationSessionDocPath('pl-to-en'),
  getConjugationSessionDocPath('en-to-pl'),
  ASPECT_PAIRS_SESSION_DOC_PATH,
  DECLENSION_SESSION_DOC_PATH,
]);

export function getDefaultAspectPairsReviewStore(): AspectPairsReviewDataStore {
  return {
    cards: {},
    reviewedToday: [],
    newCardsToday: [],
    lastReviewDate: getTodayString(),
  };
}
