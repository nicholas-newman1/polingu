import type { Card as FSRSCard, ReviewLog } from 'ts-fsrs';
import type { SessionChanges } from './types/common';
import type { CustomItemBase } from './types/customItems';
import type { CardAudioFields } from './types/audio';

export type Case =
  | 'Nominative'
  | 'Genitive'
  | 'Dative'
  | 'Accusative'
  | 'Instrumental'
  | 'Locative'
  | 'Vocative';

export type Gender = 'Masculine' | 'Feminine' | 'Neuter' | 'Pronoun';

export type Number = 'Singular' | 'Plural';

export type DeclensionCardId = number | string;

export interface DeclensionCard extends CardAudioFields {
  id: DeclensionCardId;
  front: string;
  back: string;
  declined: string;
  case: Case;
  gender: Gender;
  number: Number;
  /** Whole-sentence English translation of `back`. Required on built-in cards. */
  english?: string;
  hint?: string;
  isCustom?: boolean;
  translations?: Record<string, string>;
  audioUrl?: string;
}

export interface CustomDeclensionCard extends CustomItemBase {
  front: string;
  back: string;
  declined: string;
  case: Case;
  gender: Gender;
  number: Number;
  english?: string;
  hint?: string;
  translations?: Record<string, string>;
  audioUrl?: string;
}

export interface DeclensionCardReviewData {
  cardId: DeclensionCardId;
  fsrsCard: FSRSCard;
  log?: ReviewLog;
}

export interface DeclensionSettings {
  newCardsPerDay: number;
}

export interface DeclensionReviewDataStore {
  cards: Record<DeclensionCardId, DeclensionCardReviewData>;
  reviewedToday: DeclensionCardId[];
  newCardsToday: DeclensionCardId[];
  lastReviewDate: string;
  /** When each id was added to or removed from the lists above; see sessionLists.ts. */
  changedAt?: SessionChanges;
}
