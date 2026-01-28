import type { Card as FSRSCard, ReviewLog } from 'ts-fsrs';
import type { CustomItemBase } from './customItems';

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

export interface ExampleSentence {
  polish: string;
  english: string;
}

export interface VocabularyWord {
  id: VocabularyWordId;
  polish: string;
  english: string;
  partOfSpeech?: PartOfSpeech;
  gender?: NounGender;
  notes?: string;
  examples?: ExampleSentence[];
  isCustom?: boolean;
}

export interface CustomVocabularyWord extends CustomItemBase {
  polish: string;
  english: string;
  partOfSpeech?: PartOfSpeech;
  gender?: NounGender;
  notes?: string;
  examples?: ExampleSentence[];
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

export interface VocabularyDirectionSettings {
  newCardsPerDay: number;
}

export type VocabularySettings = Record<VocabularyDirection, VocabularyDirectionSettings>;
