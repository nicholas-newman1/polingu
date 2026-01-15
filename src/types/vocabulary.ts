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

export interface VocabularyWord {
  id: number;
  polish: string;
  english: string;
  partOfSpeech: PartOfSpeech;
  gender?: NounGender;
  notes?: string;
}

import type { TranslationDirection } from '../components/DirectionToggle';

export type VocabularyDirection = TranslationDirection;

export interface VocabularyCardReviewData {
  wordId: number;
  fsrsCard: FSRSCard;
  log?: ReviewLog;
}

export interface VocabularyReviewDataStore {
  cards: Record<number, VocabularyCardReviewData>;
  reviewedToday: number[];
  newCardsToday: number[];
  lastReviewDate: string;
}

export interface VocabularySettings {
  newCardsPerDay: number;
  direction: VocabularyDirection;
}
