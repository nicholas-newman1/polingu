import type { Card as FSRSCard, ReviewLog } from 'ts-fsrs';

export type PartOfSpeech =
  | 'noun'
  | 'verb'
  | 'adjective'
  | 'adverb'
  | 'pronoun'
  | 'preposition'
  | 'conjunction'
  | 'particle'
  | 'numeral'
  | 'proper noun';

export type NounGender = 'masculine' | 'feminine' | 'neuter';

export type VocabularyWordId = number | string;

export interface VocabularyWord {
  id: VocabularyWordId;
  polish: string;
  english: string;
  partOfSpeech?: PartOfSpeech;
  gender?: NounGender;
  notes?: string;
  isCustom?: boolean;
}

export interface CustomVocabularyWord {
  id: string;
  polish: string;
  english: string;
  partOfSpeech?: PartOfSpeech;
  gender?: NounGender;
  notes?: string;
  isCustom: true;
  createdAt: number;
}

import type { TranslationDirection } from '../components/DirectionToggle';

export type VocabularyDirection = TranslationDirection;

export interface VocabularyCardReviewData {
  wordId: VocabularyWordId;
  fsrsCard: FSRSCard;
  log?: ReviewLog;
}

export interface VocabularyReviewDataStore {
  cards: Record<string, VocabularyCardReviewData>;
  reviewedToday: VocabularyWordId[];
  newCardsToday: VocabularyWordId[];
  lastReviewDate: string;
}

export interface VocabularySettings {
  newCardsPerDay: number;
  direction: VocabularyDirection;
}
