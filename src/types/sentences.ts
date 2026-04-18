import type { Card as FSRSCard, ReviewLog } from 'ts-fsrs';
import type { TranslationDirection } from './common';
import type { CustomItemBase } from './customItems';
import type { CardAudioFields } from './audio';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type TagCategory = 'topics' | 'grammar' | 'style';

export const TAG_CATEGORY_NAMES: Record<TagCategory, string> = {
  topics: 'Topics',
  grammar: 'Grammar',
  style: 'Style',
};

export type SentenceSource = 'vocab-example';

export interface Sentence extends CardAudioFields {
  id: string;
  polish: string;
  english: string;
  level: CEFRLevel;
  tags: string[];
  translations?: Record<string, string>;
  audioUrl?: string;
  createdAt?: unknown;
  isCustom?: boolean;
  source?: SentenceSource;
  sourceVocabularyId?: string;
  sourceExampleId?: string;
}

export interface CustomSentence extends CustomItemBase {
  polish: string;
  english: string;
  level: CEFRLevel;
  tags: string[];
  translations?: Record<string, string>;
  audioUrl?: string;
}

export interface SentenceBank {
  sentences: Sentence[];
}

export interface SentenceCardReviewData {
  sentenceId: string;
  fsrsCard: FSRSCard;
  log?: ReviewLog;
}

export interface SentenceReviewDataStore {
  cards: Record<string, SentenceCardReviewData>;
  reviewedToday: string[];
  newCardsToday: string[];
  lastReviewDate: string;
}

export const ALL_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export interface SentenceDirectionSettings {
  newCardsPerDay: number;
  selectedLevels: CEFRLevel[];
}

export type SentenceSettings = Record<TranslationDirection, SentenceDirectionSettings>;
