import type { CardReviewData, ReviewDataStore, TranslationDirection } from './common';
import type { CustomItemBase } from './customItems';
import type { CardAudioFields } from './audio';

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export type TagCategory = 'topics' | 'grammar' | 'style';

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
  source?: SentenceSource;
  sourceVocabularyId?: string;
  sourceExampleId?: string;
}

export interface SentenceCardReviewData extends CardReviewData {
  sentenceId: string;
}

export type SentenceReviewDataStore = ReviewDataStore<SentenceCardReviewData>;

export interface SentenceSessionCard {
  sentence: Sentence;
  reviewData: SentenceCardReviewData;
  isNew: boolean;
}

export const ALL_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export interface SentenceDirectionSettings {
  newCardsPerDay: number;
  selectedLevels: CEFRLevel[];
}

export type SentenceSettings = Record<TranslationDirection, SentenceDirectionSettings>;

export const DEFAULT_SENTENCE_SETTINGS: SentenceSettings = {
  'pl-to-en': { newCardsPerDay: 5, selectedLevels: [...ALL_LEVELS] },
  'en-to-pl': { newCardsPerDay: 5, selectedLevels: [...ALL_LEVELS] },
};
